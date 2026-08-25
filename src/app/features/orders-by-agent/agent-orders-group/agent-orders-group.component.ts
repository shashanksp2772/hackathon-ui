import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Agent } from '../../../core/models/agent.model';
import { Order } from '../../../core/models/order.model';
import { StatusBadgeComponent } from '../../../shared/status-badge/status-badge.component';

/**
 * One agent's card: their status, and every order currently mapped to them.
 *
 * An order can end up ASSIGNED to an agent who is OFFLINE - most commonly
 * when ops rejects a recovery suggestion and no replacement agent was
 * available at that moment. Nothing else in the UI would show this (it
 * has no pending suggestion, so it won't appear in the reassignment
 * queue), so it's flagged here rather than rendered as if it were healthy.
 */
@Component({
  selector: 'app-agent-orders-group',
  imports: [StatusBadgeComponent, MatButtonModule],
  templateUrl: './agent-orders-group.component.html',
  styleUrl: './agent-orders-group.component.scss',
})
export class AgentOrdersGroupComponent {
  readonly agent = input.required<Agent>();
  readonly orders = input<Order[]>([]);
  readonly reassigningOrderId = input<string | null>(null);

  readonly reassign = output<string>();

  needsAttention(order: Order): boolean {
    return order.status === 'ASSIGNED' && this.agent().status === 'OFFLINE';
  }
}
