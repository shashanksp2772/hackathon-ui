import { Component, computed, input } from '@angular/core';
import { TriggerReason } from '../../core/models/suggestion.model';

/**
 * The badge that makes the agentic loop visible: a distinct, eye-catching
 * treatment for AGENT_OFFLINE (an autonomous re-plan) versus the quiet
 * neutral treatment for INITIAL (a manually requested suggestion).
 */
@Component({
  selector: 'app-trigger-badge',
  imports: [],
  templateUrl: './trigger-badge.component.html',
  styleUrl: './trigger-badge.component.scss',
})
export class TriggerBadgeComponent {
  readonly triggerReason = input.required<TriggerReason>();

  readonly isAutoReplan = computed(() => this.triggerReason() === 'AGENT_OFFLINE');

  readonly label = computed(() => (this.isAutoReplan() ? 'Auto re-plan' : 'Manual'));
}
