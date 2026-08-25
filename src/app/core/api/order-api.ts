import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { API_BASE_URL, POLL_INTERVAL_MS } from '../config/api.config';
import { Order } from '../models/order.model';
import { Suggestion } from '../models/suggestion.model';

/**
 * Data-access layer for orders. Exposes two independently-polled views:
 * `pendingOrders` (REASSIGNMENT_PENDING only, small payload, used by the
 * reassignment queue) and `allOrders` (every status, used by the
 * orders-by-agent screen). Kept as two resources rather than one broad
 * fetch filtered client-side, so the queue's poll stays cheap.
 */
@Service()
export class OrderApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly pollTick = signal(0);
  private readonly allOrdersPollTick = signal(0);

  private readonly pendingOrdersResource = rxResource({
    params: () => this.pollTick(),
    stream: () =>
      this.http.get<Order[]>(`${this.baseUrl}/orders`, {
        params: { status: 'REASSIGNMENT_PENDING' },
      }),
    defaultValue: [] as Order[],
  });

  private readonly allOrdersResource = rxResource({
    params: () => this.allOrdersPollTick(),
    stream: () => this.http.get<Order[]>(`${this.baseUrl}/orders`),
    defaultValue: [] as Order[],
  });

  readonly pendingOrders = this.pendingOrdersResource.value;
  readonly isLoading = this.pendingOrdersResource.isLoading;
  readonly error = this.pendingOrdersResource.error;

  readonly allOrders = this.allOrdersResource.value;
  readonly allOrdersLoading = this.allOrdersResource.isLoading;
  readonly allOrdersError = this.allOrdersResource.error;

  constructor() {
    setInterval(() => this.pollTick.update((tick) => tick + 1), POLL_INTERVAL_MS);
    setInterval(() => this.allOrdersPollTick.update((tick) => tick + 1), POLL_INTERVAL_MS);
  }

  refresh(): void {
    this.pendingOrdersResource.reload();
  }

  refreshAll(): void {
    this.allOrdersResource.reload();
  }

  /** Manually asks for a fresh suggestion on one order - the "Reassign" action for a needs-attention order. */
  requestSuggestion(orderId: string): Observable<Suggestion> {
    return this.http.post<Suggestion>(`${this.baseUrl}/orders/${orderId}/suggest`, {});
  }
}
