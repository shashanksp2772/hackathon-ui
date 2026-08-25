import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AgentApi } from '../../core/api/agent-api';
import { OrderApi } from '../../core/api/order-api';
import { SuggestionApi } from '../../core/api/suggestion-api';
import { Suggestion } from '../../core/models/suggestion.model';
import { ErrorBannerComponent } from '../../shared/error-banner/error-banner.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { SuggestionCardComponent } from './suggestion-card/suggestion-card.component';

interface SuggestionRow {
  suggestion: Suggestion;
  orderDescription: string;
  agentName: string;
}

/**
 * The queue is a client-side join: pending suggestions carry only ids, so
 * this combines them with the matching REASSIGNMENT_PENDING order (for a
 * description) and the recommended agent (for a name) before handing rows
 * to SuggestionCardComponent.
 */
@Component({
  selector: 'app-reassignment-queue',
  imports: [SuggestionCardComponent, LoadingSpinnerComponent, ErrorBannerComponent, MatButtonModule],
  templateUrl: './reassignment-queue.component.html',
  styleUrl: './reassignment-queue.component.scss',
})
export class ReassignmentQueueComponent {
  private readonly suggestionApi = inject(SuggestionApi);
  private readonly orderApi = inject(OrderApi);
  private readonly agentApi = inject(AgentApi);

  protected readonly isLoading = computed(
    () => this.suggestionApi.isLoading() && this.suggestionApi.pendingSuggestions().length === 0,
  );

  protected readonly error = computed(() => this.suggestionApi.error() ?? this.orderApi.error());

  protected readonly rows = computed<SuggestionRow[]>(() => {
    const orderById = new Map(this.orderApi.pendingOrders().map((order) => [order.id, order]));
    const agentById = new Map(this.agentApi.agents().map((agent) => [agent.id, agent]));

    return this.suggestionApi.pendingSuggestions().map((suggestion) => ({
      suggestion,
      orderDescription: orderById.get(suggestion.orderId)?.description ?? '',
      agentName: agentById.get(suggestion.recommendedAgentId)?.name ?? '',
    }));
  });

  refreshAll(): void {
    this.suggestionApi.refresh();
    this.orderApi.refresh();
    this.agentApi.refresh();
  }

  onActionCompleted(): void {
    // Accepting/rejecting a suggestion also changes the order's status
    // and the agents' loads, so refresh all three rather than just itself.
    this.refreshAll();
  }
}
