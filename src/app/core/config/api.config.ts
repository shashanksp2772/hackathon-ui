import { InjectionToken } from '@angular/core';

declare global {
  interface Window {
    __env?: { apiBaseUrl?: string };
  }
}

/**
 * Base URL for the backend REST API. Reads from `window.__env.apiBaseUrl`,
 * a runtime value set by `env.js` (regenerated from `docker/env.template.js`
 * at container start - see docker-entrypoint.sh) so the same built image can
 * point at a different backend per deployment without a rebuild. Falls back
 * to the local dev backend when nothing has set it (plain `ng serve`, or
 * tests, which override this token directly anyway).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => window.__env?.apiBaseUrl || 'http://localhost:8080',
});

/** How often the API services auto-refresh their resources. */
export const POLL_INTERVAL_MS = 5000;
