import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AgentApi } from '../../../core/api/agent-api';
import { Agent } from '../../../core/models/agent.model';
import { StatusBadgeComponent } from '../../../shared/status-badge/status-badge.component';

/**
 * One agent row, including the "Set Offline" / "Set Available" control that
 * lets ops trigger the agentic loop directly from the UI for the demo,
 * instead of needing a separate terminal call.
 */
@Component({
  selector: 'app-agent-row',
  imports: [MatButtonModule, StatusBadgeComponent],
  templateUrl: './agent-row.component.html',
  styleUrl: './agent-row.component.scss',
})
export class AgentRowComponent {
  private readonly agentApi = inject(AgentApi);

  readonly agent = input.required<Agent>();

  readonly submitting = signal(false);

  readonly isOffline = computed(() => this.agent().status === 'OFFLINE');

  toggleOffline(): void {
    const nextStatus = this.isOffline() ? 'AVAILABLE' : 'OFFLINE';
    this.submitting.set(true);

    this.agentApi.updateStatus(this.agent().id, nextStatus).subscribe({
      next: () => {
        this.submitting.set(false);
        this.agentApi.refresh();
      },
      error: () => this.submitting.set(false),
    });
  }
}
