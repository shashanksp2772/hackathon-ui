import { Component } from '@angular/core';
import { AgentRosterComponent } from '../agent-roster/agent-roster.component';
import { ReassignmentQueueComponent } from '../reassignment-queue/reassignment-queue.component';

@Component({
  selector: 'app-dashboard',
  imports: [ReassignmentQueueComponent, AgentRosterComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {}
