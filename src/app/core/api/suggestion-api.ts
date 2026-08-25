import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { API_BASE_URL, POLL_INTERVAL_MS } from '../config/api.config';
import { Suggestion } from '../models/suggestion.model';

/** Data-access layer for reassignment suggestions. */
@Service()
export class SuggestionApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly pollTick = signal(0);

  private readonly pendingSuggestionsResource = rxResource({
    params: () => this.pollTick(),
    stream: () =>
      this.http.get<Suggestion[]>(`${this.baseUrl}/suggestions`, {
        params: { status: 'PENDING' },
      }),
    defaultValue: [] as Suggestion[],
  });

  readonly pendingSuggestions = this.pendingSuggestionsResource.value;
  readonly isLoading = this.pendingSuggestionsResource.isLoading;
  readonly error = this.pendingSuggestionsResource.error;

  constructor() {
    setInterval(() => this.pollTick.update((tick) => tick + 1), POLL_INTERVAL_MS);
  }

  refresh(): void {
    this.pendingSuggestionsResource.reload();
  }

  updateStatus(suggestionId: string, status: 'ACCEPTED' | 'REJECTED'): Observable<Suggestion> {
    return this.http.patch<Suggestion>(`${this.baseUrl}/suggestions/${suggestionId}`, { status });
  }
}
