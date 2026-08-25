# Architecture Decision Record — AI Reassignment Engine

Each entry records one decision as it was made during the build, not a
retrospective summary. Format: **Context → Options considered → Decision →
Tradeoffs accepted**.

---

## ADR-1: Where does routing logic live?

**Context**
The routing engine needs to pick a recommended agent for an order, and that
picking logic has to be reachable from two independent callers: the
on-demand `POST /orders/{id}/suggest` endpoint (T-2) and the async
agent-offline listener (T-4). It also needs to stay testable in isolation
and swappable per sprint 2's roadmap.

**Options considered**
- **(a) Put routing logic directly in a `SuggestionService`/`OrderService`**
  — simplest to write, but that service would end up owning routing
  decisions, persistence, and (later) event publishing all at once — the
  exact "service that quietly grows" smell the brief warns about.
- **(b) Domain model methods on `Order`/`Agent`** — keeps logic close to the
  entities, but an entity reaching across to query the full agent roster and
  call an LLM doesn't fit a JPA entity's lifecycle or transaction boundary.
- **(c) A dedicated `RoutingStrategy` interface (Strategy pattern) with a
  separate orchestration service** — strategies contain only the decision
  (order + candidate agents + context → ranked recommendations); a
  `SuggestionGenerationService` owns loading data, calling the active
  strategy, persisting the result, and transitioning order state.

**Decision**
Chose (c). `RoutingStrategy` (`routing` package) is a pure function with no
persistence or I/O — `RuleBasedRoutingStrategy` and `AiRoutingStrategy` both
implement it and are trivially unit-testable in isolation.
`SuggestionGenerationService` (`suggestion` package) is the single
orchestration point both callers go through: it loads available agents,
calls `RoutingStrategyRegistry.active().recommend(...)`, persists the
`ReassignmentSuggestion`, and transitions the order — including the
AGENT_OFFLINE idempotency check (AGT-4), since that's a property of
*generating* a suggestion, not of whichever caller triggered it.

**Tradeoffs accepted**
This is two extra classes per routing concern (a strategy + the shared
orchestration) instead of one service method. In exchange, strategies stay
side-effect-free and the orchestration logic (idempotency, state
transitions, persistence) is written exactly once instead of duplicated
between the HTTP path and the async path.

---

## ADR-2: How does runtime strategy switching work?

**Context**
The active strategy (rule-based vs. AI, and a third — zone-affinity — in
sprint 2) must be changeable without a restart, and both callers (HTTP
endpoint, async listener) must see the same active strategy without extra
wiring per caller.

**Options considered**
- **(a) Spring `@Qualifier` + a config property read once at startup** —
  simplest, but requires a restart to change and doesn't scale to N
  strategies without touching wiring code.
- **(b) An auto-wired `Map<String, RoutingStrategy>` bean map**, keyed by
  Spring bean name, with a small registry holding a `volatile` active-name
  field. Adding a strategy means implementing the interface and registering
  it as a named bean — nothing else changes.
- **(c) A manual factory with a `switch` statement** — explicit, but the
  factory needs editing every time a strategy is added, which is exactly
  the coupling sprint 2 needs to avoid.

**Decision**
Chose (b): `RoutingStrategyRegistry` receives `Map<String, RoutingStrategy>`
via constructor injection (Spring populates it automatically from every
`RoutingStrategy` bean, keyed by bean name — `"rule-based"`, `"ai"`), plus
an initial `routing.strategy` config value. The active name is a
`volatile String`, flippable at runtime via
`PATCH /config/routing-strategy {"strategy": "ai"}` — a live HTTP call, not
just a claim. Both callers (`OrderController` and `ReassignmentPlanner`) go
through the same registry, so neither needs its own switching logic.
Sprint 2's `ZoneAffinityStrategy` becomes `@Component("zone-affinity")` —
zero changes here.

**Tradeoffs accepted**
The registry is slightly less explicit than a factory — a reader has to
know Spring auto-populates the map by bean name. We also lose compile-time
guarantees that `routing.strategy` names a real bean; a typo only surfaces
at startup. Mitigated by validating the name in the constructor itself
(`RoutingStrategyRegistry` throws `InvalidRoutingStrategyException` if the
configured or requested name isn't a registered bean), so a misconfiguration
fails fast at boot rather than silently on first use.

---

## ADR-3: How does the system stay resilient when the LLM is unavailable?

**Context**
The AI strategy calls a local Ollama model over HTTP. That call can fail in
several distinct ways — connection refused/timeout, malformed output, a
hallucinated agent id, or output that's syntactically JSON but semantically
wrong (confidence out of range, blank reasoning). The async re-plan path
especially must never silently drop a suggestion because the LLM had a bad
moment.

**Options considered**
- **(a) Prompt the model to return JSON and hope, catch a generic exception
  on parse failure.** Simplest, but "hallucinated agent id" and "confidence
  = 1.4" both parse as valid JSON and would slip through untouched.
- **(b) Constrain the model's output at the decoding level (JSON Schema via
  Ollama's native `format` field) + a second validation pass through
  Spring's own `jakarta.validation.Validator`, + an explicit roster
  membership check for the agent id.**
- **(c) Add a circuit breaker library (Resilience4j)** on top of either —
  more resilience machinery than a single local LLM call, on a fixed
  timeout, actually needs.

**Decision**
Chose (b), skipped (c) as disproportionate for this scope. `OllamaClient`
uses `/api/chat`'s `format` field so the model is structurally constrained
to `{agentId, confidence, reasoning}` rather than merely asked for it (with
`think: false` to suppress qwen3's reasoning-model preamble). The parsed
`AiRecommendationPayload` is then re-validated through Spring's actual
`Validator` bean (`@NotBlank`, `@DecimalMin/@DecimalMax`) — literal
Bean-Validation, not hand-rolled `if`s. The agent id is separately checked
against the real `availableAgents` list passed into the call, independent
of both the schema and Bean Validation, since an LLM can return a
structurally valid but hallucinated id. Every failure mode maps to an
`AiFailureReason` (`TIMEOUT`, `PROVIDER_ERROR`, `MALFORMED_RESPONSE`,
`HALLUCINATED_AGENT`, `VALIDATION_FAILED`), caught in exactly one place —
`AiRoutingStrategy` — which falls back to `RuleBasedRoutingStrategy` and
logs why. Both the on-demand and the async re-plan paths get this fallback
for free, since both go through the same strategy.

**Tradeoffs accepted**
Schema-constrained decoding is Ollama-specific — if the project moves to a
provider without this feature, prompt-based JSON coaxing plus stricter
parsing would be needed instead. We also chose a single bounded HTTP
timeout over retry/backoff: a local model's failure mode is "slow to load"
or "down," not "transiently flaky," so a retry adds latency without adding
much real resilience here.

---

## ADR-4: How is the agentic loop triggered and kept off the request path?

**Context**
`PATCH /agents/{id}/status` must return immediately even though setting an
agent OFFLINE can imply re-planning several orders, each potentially
involving an LLM call. The trigger also has to be a state change, not a
timer, and must not fire twice for the same outage.

**Options considered**
- **(a) Do the re-planning synchronously inside the PATCH handler.**
  Simplest, but directly violates "off the request path" — the endpoint
  would block on N routing calls (some LLM-backed) before responding.
- **(b) A `@Scheduled` poller checking for OFFLINE agents periodically.**
  Decouples the work, but reacts to a timer tick, not to the actual event —
  latency is bounded by the poll interval, and it's unnecessary API/DB load
  when nothing changed.
- **(c) `ApplicationEventPublisher` + `@TransactionalEventListener(phase =
  AFTER_COMMIT)` + `@Async` on a dedicated executor.**

**Decision**
Chose (c). `AgentService.updateStatus` publishes `AgentWentOfflineEvent`
only on a genuine transition into `OFFLINE` (not on a redundant
`OFFLINE → OFFLINE` PATCH). `ReassignmentPlanner.onAgentOffline` is
`@TransactionalEventListener(AFTER_COMMIT)` — so it only ever sees the
status change once it's durably committed — and `@Async("reassignmentExecutor")`,
a small bounded `ThreadPoolTaskExecutor` (not Spring's default unbounded
`SimpleAsyncTaskExecutor`). It finds every `ASSIGNED` order still pinned to
that agent and re-plans each through the same `SuggestionGenerationService`
the HTTP path uses, catching and logging per-order failures so one bad
order doesn't abort the batch. Idempotency has two layers: the query only
picks up orders still `ASSIGNED` (once re-planned, an order moves to
`REASSIGNMENT_PENDING` and won't be picked up by a second same-agent
offline event), plus a partial unique index
(`uq_pending_offline_suggestion`) at the database layer as a backstop
against a genuine race between two concurrent listener firings.

**Tradeoffs accepted**
`@TransactionalEventListener(AFTER_COMMIT)` means a failure inside the
listener can't roll back the original status change — by design, since the
status change is real regardless of whether re-planning succeeds, but it
does mean re-planning failures are only visible in logs, not surfaced back
to the PATCH caller. Verified live: `PATCH /agents/{id}/status` returned in
12–37ms in testing regardless of whether the rule-based or AI strategy was
active, confirming the async boundary actually holds.

---

## ADR-5: What did you design to extend, and what did you deliberately leave for later?

**Extension seams already in place:**
- **Zone affinity / capacity (sprint 2).** `Agent.currentZone`/`maxCapacity`
  and `Order.pickupZone`/`dropoffZone`/`weightClass` are nullable columns in
  `V1__init.sql` today, unread by any current logic. `ZoneAffinityStrategy`
  arrives as `@Component("zone-affinity")` implementing `RoutingStrategy` —
  no change to the registry, either controller, or the async listener.
- **Proactive SLA loop (sprint 3).** `Order.slaDeadline` exists as a
  nullable column now. `RoutingContext` already models *why* a
  recommendation is being requested (`triggerReason`, `offlineAgentId`,
  `strandedOrderCount`) rather than inferring it from order state — a
  future `OrderSlaApproachingEvent` would feed the exact same
  `SuggestionGenerationService.generate(orderId, context)` call that
  `ReassignmentPlanner` uses today, just from a scheduled monitor instead
  of an offline-agent listener.
- **Multi-step re-plan (sprint 3).** `RoutingStrategy.recommend()` already
  returns a ranked `List<RoutingRecommendation>`, not a single pick — a
  future strategy weighing downstream queue pressure returns a richer list
  without an interface change.

**Deliberately not built, and why:**
- **UI ceiling** (full dispatch board, SLA countdown, zone roster, agent
  load visualization) — deferred because the agentic loop and its
  visibility (the re-plan badge) is a correctness/demo requirement; the
  ceiling is a visibility enhancement on top of a floor that already proves
  the system works end-to-end.
- **SSE token-streaming bonus** — same reasoning, one level further down
  the priority list: it's additive UI polish with no bearing on whether the
  reassignment loop is correct.
- **Zone/capacity/SLA *enforcement logic*** — the nullable columns exist:
  the enforcement itself (a strategy filtering by zone or capacity, a
  monitor checking deadlines) is sprint 2/3 scope, not this sprint's.
- **Auth/login** — `spring-boot-starter-security` was removed outright
  rather than configured around, since Boot auto-generates a login wall for
  every endpoint the moment that starter is on the classpath, and there's
  no auth requirement in scope. Adding real auth later is additive, not a
  rework.
- **Resilience4j / retry-with-backoff** — a single bounded timeout plus an
  explicit fallback (ADR-3) was judged proportionate to one local LLM
  dependency; a circuit breaker library would be solving a problem this
  system doesn't have yet.

---

## ADR-6: Platform version choices (bonus)

**Context**
The brief names Spring Boot 3.x, Angular 17, and a generic multi-provider
LLM gateway (Addendum B) as reference points. The actual scaffolded/chosen
stack is newer on every axis, which surfaced a few real behavioral
differences worth recording so they don't look like bugs in the walkthrough.

**Decision and consequences**
- **Spring Boot 4.1.1 (Spring Framework 7, Jackson 3).** Jackson's base
  packages moved from `com.fasterxml.jackson.*` to `tools.jackson.*`, and
  `ObjectMapper.readValue`'s failure type (`JacksonException`) is now
  *unchecked* rather than the old checked `JsonProcessingException`. Both
  surfaced compiling `AiAdvisorService`/`OllamaClient` and were fixed
  in place. `spring-boot-starter-web` is now `spring-boot-starter-webmvc`.
- **Chose Ollama's native `/api/chat` with JSON-schema-constrained decoding
  over Addendum B's generic text-in/text-out multi-provider gateway** —
  the addendum's approach (prompt the model, hope for JSON) is strictly
  weaker than a mode where the model is structurally unable to return
  anything else. The tradeoff is provider portability: this integration is
  Ollama-specific and would need rework to add Gemini/Groq back.
- **Angular 22, not 17.** Used `rxResource()` (stable as of this version)
  for every data-fetching service instead of hand-rolled
  `Subject`/`merge` polling — it exposes `.value`/`.isLoading`/`.error`/
  `.reload()` directly. Also used the `@Service()` decorator (this
  version's auto-provided-at-root alternative to
  `@Injectable({providedIn:'root'})`) throughout.
- **springdoc-openapi 3.1.0**, the line built for Boot 4/Spring 7/Jakarta
  EE 11 (the 2.x line only targets Boot 3) — confirmed against Maven
  Central's metadata rather than assumed, since guessing wrong here fails
  at class-loading time, not compile time.

**Tradeoffs accepted**
None of this changes any graded behavior, but a reviewer expecting the
brief's exact reference versions would otherwise see unfamiliar package
names and API shapes without an obvious reason. Recording it here is
cheaper than re-deriving it live in the walkthrough.

---

## ADR-7: `activeOrderCount` is denormalized — and the seed data drifted from it

**Context**
`Agent.activeOrderCount` is a stored counter, not a live `COUNT(*)` over
`orders` — kept denormalized deliberately, so `RuleBasedRoutingStrategy`
can rank agents by load without a query per candidate. It's kept correct
at runtime by `Agent.incrementLoad()`/`decrementLoad()`, called from
`OrderService.createOrder` and `Order.reassignTo`. The seed script
(`V2__seed_data.sql`) sets this counter by hand, independently of the
orders it inserts in the same file — nothing enforces the two lists agree.

**What actually happened**
They didn't agree. Priya Sharma (AGT-001) was seeded with
`active_order_count = 2` while the same script assigns her 3 orders
(ORD-001, ORD-002, ORD-008); Ananya Iyer (AGT-003) was seeded at `1` against
2 real orders. The roster panel had been silently showing the wrong number
since T-1 — the Orders by Agent screen (built afterward) was the first
place that actually counted real orders per agent, which is what surfaced
the mismatch: "2 active" in the roster next to "3 order(s)" for the same
agent. When first reviewing this seed script, I noticed the mismatch and
judged it "a quirk of the demo seed, not a bug" — that judgment was wrong;
it was a real data-integrity bug that just happened to live in seed data
instead of application code, and it produced a genuinely confusing UI
until someone using the app actually caught it.

**Decision**
Fixed the seed values to match the seed script's own order assignments
(AGT-001: 2 → 3, AGT-003: 1 → 2; AGT-002/004/005 were already correct).
Verified post-fix: a clean reset now shows `activeOrderCount` exactly
matching the real per-agent order count for all 5 seeded agents.

**Tradeoffs accepted / lesson**
The denormalized-counter design itself is still the right call for T-2's
routing strategies (ADR unchanged there). What this really argues for is
that any hand-maintained seed data with a derivable invariant (here:
"agent's count should equal how many orders below assign to them") should
either be generated from a single source of truth or checked, rather than
typed twice and trusted to stay in sync — worth remembering before adding
more seed rows for sprint 2 (e.g. `maxCapacity` vs. actual load).

---

## ADR-8: What happens when ops rejects a recovery suggestion?

**Context**
Rejecting an AGENT_OFFLINE suggestion used to just revert the order to
`ASSIGNED` — but the order's `assignedAgent` never changes on reject (only
`Order.reassignTo()` does, and that's accept-only), so the order silently
ended up `ASSIGNED` to an agent who was still `OFFLINE`. Nothing re-triggers
the agentic loop for it (that only fires on an `OFFLINE` *transition*,
which already happened once), so the order becomes an invisible orphan:
not in the reassignment queue (no pending suggestion), looking ordinary
everywhere else. This is the same silent-failure shape the brief's whole
scenario is about, just relocated to after a reject instead of before the
system existed.

**Options considered**
- **(a) Leave revert-to-ASSIGNED as the only behavior**, and only add
  visibility (a "needs attention" flag) so a human eventually notices.
- **(b) Immediately ask routing for a fresh recommendation when rejecting
  an AGENT_OFFLINE suggestion whose agent is still offline**, keeping the
  loop's observe → reason → act → checkpoint shape intact instead of
  quietly exiting it - falling back to (a)'s flagged `ASSIGNED` state only
  if no replacement can be found.
- **(c) A scheduled reconciliation sweep** as a backstop under the
  event-driven design, independent of what reject does. Deferred - (b)
  covers the actual reject case, and adding a poller "just in case" without
  a concrete second failure mode to justify it would be exactly the kind of
  unrequested resilience machinery ADR-3 already argued against for
  Resilience4j.

**Decision**
Implemented (b) with (a) as its fallback. `SuggestionService.reject()`
commits the rejection first, then - only if `triggerReason == AGENT_OFFLINE`
and the order's agent is still `OFFLINE` - calls
`SuggestionGenerationService.generate()` again for a fresh candidate,
catching `NoAvailableAgentException` (or any other failure) and leaving the
order `ASSIGNED`-to-an-offline-agent if so. The Orders-by-Agent screen
flags exactly that state (`order.status === 'ASSIGNED' && agent.status ===
'OFFLINE'`) with a visible warning, computed client-side from data the
screen already has - no new API field, no schema change.

**What this actually took to get right**
The first implementation called `generate()` from *inside* the same
`@Transactional` method that rejected the suggestion. Two distinct bugs
came from that, in order:
1. `generate()` is itself `@Transactional`, and by default a nested call
   joins the *same* transaction. When it threw `NoAvailableAgentException`,
   Spring's proxy marked that shared transaction rollback-only *before* my
   `catch` block ever ran - the PATCH returned 500 even though the
   exception was "handled." Fixed by making `generate()`
   `@Transactional(propagation = REQUIRES_NEW)`, so a failure inside it
   only rolls back its own transaction.
2. That fix alone wasn't enough: `generate()`'s idempotency check reads
   suggestion state from the database, and the reject's own change was
   still sitting uncommitted in the outer transaction when the inner one
   queried - so it saw the original suggestion as still `PENDING`, decided
   a duplicate existed, and silently returned it instead of creating
   anything new. No error, just nothing happening. Fixed by moving the
   reject into its own bean (`SuggestionStatusTransitioner`) with its own
   `@Transactional` method, called from `SuggestionService`, so it
   genuinely commits (cross-bean call → real proxy interception) before
   the regeneration attempt ever runs.

Both bugs share one root cause: a call from one method to another *on the
same bean* never goes through Spring's transactional proxy, so splitting
"things that need independent transactional boundaries" only works when
the split is across beans, not just across methods. Caught both live,
against a real Postgres database, by deliberately forcing the
zero-available-agents case rather than trusting the happy path.

**Tradeoffs accepted**
The reject path now spans two committed transactions instead of one -
there's a small window where a concurrent read could see neither the
rejected suggestion nor its replacement in a fully consistent snapshot.
Judged acceptable: the window is milliseconds, and this system has no real
concurrent load. Also worth naming for the walkthrough: this fix was found
by intentionally trying to break the fallback path (forcing zero available
agents), not by the happy path looking fine - the happy path did look fine
right up until it didn't.

## ADR-9: The regenerate-on-reject fix from ADR-8 could spam the same suggestion forever

**The bug**
Right after shipping ADR-8's fix, live testing surfaced a second-order bug
in it: `SuggestionGenerationService.generate()` picks the routing
strategy's top candidate with no memory of what was already tried for this
order. `SuggestionService.reject()` regenerates immediately whenever the
order's agent is still offline - but "still offline" doesn't change just
because ops rejected a name. The rule-based strategy is deterministic
(fewest active orders), so rejecting fed back into the exact same inputs
and produced the exact same recommendation, forever. Reproduced live:
rejecting an AGT-004 suggestion for ORD-007 twice in a row returned a brand
new `PENDING` suggestion recommending AGT-004 again each time - clicking
Reject was, functionally, a no-op that looked like it might be doing
something (a new UUID, a new timestamp) while never actually changing the
outcome.

**The fix**
`generate()` now excludes agents that already have a `REJECTED` suggestion
for this order's `AGENT_OFFLINE` incident before calling the routing
strategy (`ReassignmentSuggestionRepository.findByOrder_IdAndTriggerReason`,
filtered to `REJECTED` in the service). Each reject now either surfaces a
genuinely different candidate or - once every available agent has been
tried and rejected - hits the existing `NoAvailableAgentException` fallback
from ADR-8, leaving the order `ASSIGNED`-to-the-offline-agent with the
"needs attention" flag. Verified live: with two available agents, rejecting
twice produced two distinct recommendations and then correctly stopped
generating a third.

**Scope note**
The exclusion is keyed on order + `AGENT_OFFLINE` only, with no notion of
"incident" separate from that. If the same order's agent goes offline
again in some later, unrelated episode, agents rejected during a past
episode stay excluded. Not modeled as a problem here - the codebase's
existing idempotency check already treats order + trigger reason as the
unit of dedup, so this stays consistent with that rather than introducing
a new "incident" concept the rest of the system doesn't have.

## ADR-10: Giving ops a way out of "needs attention" - the manual Reassign action

**The gap**
ADR-8/9 give a needs-attention order (ASSIGNED to a still-OFFLINE agent,
every candidate already rejected or none were ever available) a visible
flag - but no way back in. If a replacement agent later becomes available,
nothing re-triggers routing for that specific order; it would sit flagged
forever unless the same agent happened to go offline again (which
re-enters the agentic loop) or someone manually POSTed to the API.

**Decision**
Added a "Reassign" button next to the warning on the Orders-by-Agent
screen. It calls the existing on-demand `POST /orders/{id}/suggest`
endpoint (T-2), which now resolves its own `RoutingContext` from the
order's current state (`OrderService.resolveManualSuggestionContext`)
instead of always assuming a first assignment: if the order's agent is
still `OFFLINE`, it builds `RoutingContext.agentOffline(...)` so the
request gets the recovery reasoning *and* ADR-9's rejected-agent exclusion;
otherwise it falls back to `RoutingContext.initial()`. On success the
button hands off to the reassignment queue (refreshing suggestions/orders
and navigating there) so ops reviews the new candidate through the same
accept/reject flow as any other suggestion - no parallel code path. On
failure (still no agent available) it surfaces the backend's 409 message
inline with a Retry, rather than failing silently.

**Investigated but not a bug: "suggestions only show up after clicking refresh"**
Also reported this session: after setting an agent offline, suggestions
seemed to appear only once Refresh was clicked. Reproduced live with
Playwright, request-timing captured directly from the browser: the queue's
5s poll (`SuggestionApi`'s `setInterval` → `pollTick` signal → `rxResource`)
fired on schedule throughout, and the suggestion appeared automatically
within one poll cycle - ~8s under the rule-based strategy, ~20s under the
AI strategy's Ollama call, both without any manual click. Most likely
explanation: with the AI strategy active, the wait crosses typical
patience, and a Refresh click during that window coincides with - but
doesn't cause - the suggestion landing. No code change; recorded here so
the next report of "polling seems broken" starts from a measured baseline
instead of re-litigating it.

**A process lesson from testing this**
While verifying the Reassign button, an early "success" turned out to be
false: a `kill -9` on the maven wrapper had left the actual forked JVM
process running as an orphan on port 8080, so requests kept hitting
pre-fix code for several restarts even though later restarts appeared to
succeed. Caught it by noticing the running suggestion's `triggerReason`
didn't match what the new code should have produced, then confirming via
`ps` that the serving process predated the latest compile. Re-confirmed
the pattern already named in ADR-8's testing notes: after killing a
`spring-boot:run`, verify port 8080 is actually free before trusting the
next restart.
