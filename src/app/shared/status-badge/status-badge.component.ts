import { Component, computed, input } from '@angular/core';

/**
 * Color-coded chip for any status string — agent availability
 * (AVAILABLE / BUSY / OFFLINE) or order lifecycle (ASSIGNED /
 * REASSIGNMENT_PENDING / REASSIGNED / DELIVERED). One shared component
 * instead of a near-duplicate per status enum; the css class is derived
 * directly from the status text, so a new status just needs a new
 * modifier class, no component change.
 */
@Component({
  selector: 'app-status-badge',
  imports: [],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();

  readonly cssClass = computed(
    () => `status-badge status-badge--${this.status().toLowerCase().replace(/_/g, '-')}`,
  );
}
