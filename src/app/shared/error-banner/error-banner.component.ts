import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/** Reusable inline error state with an optional retry action. */
@Component({
  selector: 'app-error-banner',
  imports: [MatButtonModule],
  templateUrl: './error-banner.component.html',
  styleUrl: './error-banner.component.scss',
})
export class ErrorBannerComponent {
  readonly message = input.required<string>();

  readonly retry = output<void>();
}
