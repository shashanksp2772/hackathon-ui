import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AgentApi } from '../../core/api/agent-api';
import { ErrorBannerComponent } from '../../shared/error-banner/error-banner.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { AgentRowComponent } from './agent-row/agent-row.component';

@Component({
  selector: 'app-agent-roster',
  imports: [AgentRowComponent, LoadingSpinnerComponent, ErrorBannerComponent, MatButtonModule],
  templateUrl: './agent-roster.component.html',
  styleUrl: './agent-roster.component.scss',
})
export class AgentRosterComponent {
  protected readonly agentApi = inject(AgentApi);
}
