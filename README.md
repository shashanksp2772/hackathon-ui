# ZipRun Ops Console — Frontend

Angular ops interface for the AI Reassignment Engine: a live queue of
pending reassignment suggestions (with AI/rule-based reasoning, confidence,
and the agentic re-plan badge) and an agent roster with a control to flip
agents offline for the demo. See [`../ADR.md`](../ADR.md) for the
architectural decisions behind this build.

## Tech stack

- Angular 22, standalone components throughout
- Signals end-to-end: `signal`, `computed`, `input`/`output`, and
  `rxResource()` for every data-fetching service (auto-polling +
  `.isLoading()`/`.error()`/`.reload()`, no hand-rolled RxJS plumbing)
- The `@Service()` decorator (this version's auto-provided-at-root
  alternative to `@Injectable({providedIn:'root'})`)
- Angular Material (M3, CSS-variable theming — no `@angular/animations`
  dependency needed)
- Zoneless (no `zone.js`)

## Prerequisites

- Node.js 20+
- The backend running at `http://localhost:8080` (see
  [`../hackathon-backend/README.md`](../hackathon-backend/README.md))

## Setup (under 5 minutes)

```bash
npm install
npx ng serve
```

Open `http://localhost:4200`.

## Configuration

The backend base URL is an `InjectionToken` in
[`src/app/core/config/api.config.ts`](src/app/core/config/api.config.ts) —
defaults to `http://localhost:8080`. The poll interval (default 5s) lives
alongside it as `POLL_INTERVAL_MS`.

## Project structure

```
src/app/
  core/       # models, config, and API services (data-access layer)
  shared/     # reusable presentational components (badges, spinner, error banner)
  features/   # dashboard, reassignment-queue (+ suggestion-card), agent-roster (+ agent-row)
```

Each component follows the `name.component.ts/html/scss/spec.ts` convention.
Leaf components (`suggestion-card`, `agent-row`) own their own mutation
calls directly via their API service; container components
(`reassignment-queue`, `agent-roster`) coordinate cross-resource refreshes.

## Seeing the agentic loop end-to-end

With both the backend and Ollama running:

1. Open the app — the agent roster shows the 5 seeded agents.
2. Click **Set Offline** on an agent that still has active orders (e.g.
   Priya Sharma / AGT-001).
3. Within one poll cycle (~5s), suggestion cards appear in the
   reassignment queue with a pulsing teal **AUTO RE-PLAN** badge, the
   recommended agent, confidence, and reasoning.
4. **Accept** or **Reject** — the card disappears and the agent roster's
   load updates.

## Tests

```bash
npx ng test --watch=false
```

## Build

```bash
npx ng build
```
