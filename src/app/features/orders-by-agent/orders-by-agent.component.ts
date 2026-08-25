import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AgentApi } from '../../core/api/agent-api';
import { OrderApi } from '../../core/api/order-api';
import { SuggestionApi } from '../../core/api/suggestion-api';
import { Agent } from '../../core/models/agent.model';
import { Order } from '../../core/models/order.model';
import { ErrorBannerComponent } from '../../shared/error-banner/error-banner.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { AgentOrdersGroupComponent } from './agent-orders-group/agent-orders-group.component';

interface AgentOrdersRow {
  agent: Agent;
  orders: Order[];
}

/**
 * Every order, grouped under the agent it's currently assigned to — the
 * dispatch-style view of "who's carrying what," as opposed to the
 * reassignment queue's "what needs a decision right now."
 */
@Component({
  selector: 'app-orders-by-agent',
  imports: [AgentOrdersGroupComponent, LoadingSpinnerComponent, ErrorBannerComponent, MatButtonModule],
  templateUrl: './orders-by-agent.component.html',
  styleUrl: './orders-by-agent.component.scss',
})
export class OrdersByAgentComponent {
  private readonly agentApi = inject(AgentApi);
  private readonly orderApi = inject(OrderApi);
  private readonly suggestionApi = inject(SuggestionApi);
  private readonly router = inject(Router);

  protected readonly isLoading = computed(
    () => this.agentApi.isLoading() && this.agentApi.agents().length === 0,
  );

  protected readonly error = computed(() => this.agentApi.error() ?? this.orderApi.allOrdersError());

  protected readonly reassigningOrderId = signal<string | null>(null);
  protected readonly reassignError = signal<string | null>(null);
  private lastFailedReassignOrderId: string | null = null;

  protected readonly rows = computed<AgentOrdersRow[]>(() => {
    const ordersByAgentId = new Map<string, Order[]>();
    for (const order of this.orderApi.allOrders()) {
      const bucket = ordersByAgentId.get(order.assignedAgentId);
      if (bucket) {
        bucket.push(order);
      } else {
        ordersByAgentId.set(order.assignedAgentId, [order]);
      }
    }

    return this.agentApi
      .agents()
      .map((agent) => ({ agent, orders: ordersByAgentId.get(agent.id) ?? [] }));
  });

  refreshAll(): void {
    this.agentApi.refresh();
    this.orderApi.refreshAll();
  }

  /**
   * Manually asks for a suggestion on a needs-attention order, then hands
   * off to the reassignment queue to review it - the queue's own poll would
   * eventually pick it up anyway, but jumping there and refreshing now
   * avoids a dead-feeling wait right after the click that triggered it.
   */
  onReassign(orderId: string): void {
    this.reassignError.set(null);
    this.reassigningOrderId.set(orderId);
    this.orderApi.requestSuggestion(orderId).subscribe({
      next: () => {
        this.reassigningOrderId.set(null);
        this.suggestionApi.refresh();
        this.orderApi.refresh();
        this.orderApi.refreshAll();
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.reassigningOrderId.set(null);
        this.lastFailedReassignOrderId = orderId;
        this.reassignError.set(err?.error?.message ?? 'Could not find a replacement agent for this order.');
      },
    });
  }

  retryReassign(): void {
    if (this.lastFailedReassignOrderId) {
      this.onReassign(this.lastFailedReassignOrderId);
    }
  }
}
