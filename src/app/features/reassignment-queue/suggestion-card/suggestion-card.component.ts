import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { SuggestionApi } from '../../../core/api/suggestion-api';
import { Suggestion } from '../../../core/models/suggestion.model';
import { TriggerBadgeComponent } from '../../../shared/trigger-badge/trigger-badge.component';

/**
 * One pending suggestion: order context, the recommendation, and the
 * accept/reject controls. Owns its own PATCH call (via SuggestionApi)
 * rather than bouncing the decision up to a parent — the mutation belongs
 * with the UI that triggers it. Emits `actionCompleted` afterwards so the
 * container can refresh the order/agent resources this action also affects.
 */
@Component({
  selector: 'app-suggestion-card',
  imports: [MatButtonModule, TriggerBadgeComponent],
  templateUrl: './suggestion-card.component.html',
  styleUrl: './suggestion-card.component.scss',
})
export class SuggestionCardComponent {
  private readonly suggestionApi = inject(SuggestionApi);

  readonly suggestion = input.required<Suggestion>();
  readonly orderDescription = input('');
  readonly agentName = input('');

  readonly actionCompleted = output<void>();

  readonly submitting = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly confidencePercent = computed(() => Math.round(this.suggestion().confidence * 100));

  accept(): void {
    this.decide('ACCEPTED');
  }

  reject(): void {
    this.decide('REJECTED');
  }

  private decide(status: 'ACCEPTED' | 'REJECTED'): void {
    this.submitting.set(true);
    this.actionError.set(null);

    this.suggestionApi.updateStatus(this.suggestion().id, status).subscribe({
      next: () => {
        this.submitting.set(false);
        this.actionCompleted.emit();
      },
      error: () => {
        this.submitting.set(false);
        this.actionError.set('Could not update this suggestion. Please try again.');
      },
    });
  }
}
