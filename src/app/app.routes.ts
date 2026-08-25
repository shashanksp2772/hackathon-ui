import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { OrdersByAgentComponent } from './features/orders-by-agent/orders-by-agent.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'orders', component: OrdersByAgentComponent },
];
