import * as Sentry from "@sentry/react";

/**
 * Initialises Sentry error tracking — but ONLY when VITE_SENTRY_DSN is set, so
 * it's a no-op in dev and until you add a (free) DSN. Import this once, early,
 * in main.tsx.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Performance tracing off by default (set VITE_SENTRY_TRACES to e.g. "0.1").
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES ?? 0),
    integrations: [Sentry.browserTracingIntegration()],
  });
}
