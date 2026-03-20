/**
 * AAVIJA VMS — Server Action Performance Timing
 *
 * Wrap any async server action to:
 *   1. Measure execution time
 *   2. Log slow actions (>2000ms) to Sentry as performance events
 *   3. Console.log timing in development
 *
 * Usage:
 *   const result = await withTiming('approvePremiseApplication', async () => {
 *     return await adminDb.rpc('approve_premise_application', {...});
 *   });
 */

export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
  options: {
    /** Threshold in ms above which a Sentry event is sent. Default: 2000 */
    slowThresholdMs?: number;
    /** Extra context to attach to Sentry event if slow */
    context?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const { slowThresholdMs = 2000, context = {} } = options;
  const start = performance.now();

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[perf] ${label}: ${duration}ms`);
    }

    if (duration > slowThresholdMs) {
      // Fire-and-forget: dynamic import avoids bundling Sentry in all actions
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureMessage(`[SLOW ACTION] ${label} took ${duration}ms`, {
          level: 'warning',
          extra: { duration_ms: duration, threshold_ms: slowThresholdMs, ...context },
        });
      }).catch(() => {}); // never throw on monitoring failures
    }

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    if (process.env.NODE_ENV === 'development') {
      console.error(`[perf] ${label} FAILED after ${duration}ms`, error);
    }
    throw error;
  }
}
