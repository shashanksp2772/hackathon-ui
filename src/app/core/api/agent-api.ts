import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { API_BASE_URL, POLL_INTERVAL_MS } from '../config/api.config';
import { Agent, AgentStatus } from '../models/agent.model';

/**
 * Data-access layer for agents. Exposes the roster as a signal-backed
 * `Resource` (auto-polled and manually reloadable) and a plain mutation
 * method for status changes — `resource`/`rxResource` are for reads only,
 * per Angular's own guidance, so the PATCH itself stays a normal Observable.
 */
@Service()
export class AgentApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly pollTick = signal(0);

  private readonly agentsResource = rxResource({
    params: () => this.pollTick(),
    stream: () => this.http.get<Agent[]>(`${this.baseUrl}/agents`),
    defaultValue: [] as Agent[],
  });

  readonly agents = this.agentsResource.value;
  readonly isLoading = this.agentsResource.isLoading;
  readonly error = this.agentsResource.error;

  constructor() {
    setInterval(() => this.pollTick.update((tick) => tick + 1), POLL_INTERVAL_MS);
  }

  refresh(): void {
    this.agentsResource.reload();
  }

  updateStatus(agentId: string, status: AgentStatus): Observable<Agent> {
    return this.http.patch<Agent>(`${this.baseUrl}/agents/${agentId}/status`, { status });
  }
}
