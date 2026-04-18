import * as Sentry from '@sentry/react';
import { trackEvent as trackAptabaseEvent } from '@aptabase/tauri';
import { isTauri } from '@/lib/tauri-env';

let initialized = false;

function isTelemetryEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_TELEMETRY;
  if (!flag) return true;
  return flag.toLowerCase() !== 'false';
}

export function initTelemetry() {
  if (initialized || !isTelemetryEnabled()) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.2,
    });
  }

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.captureException(error, {
    extra: context,
  });
}

export function trackEvent(eventName: string, props?: Record<string, string | number>) {
  if (!isTelemetryEnabled() || !isTauri()) return;
  trackAptabaseEvent(eventName, props).catch(() => {
    // Keep telemetry fire-and-forget and never block UI behavior.
  });
}
