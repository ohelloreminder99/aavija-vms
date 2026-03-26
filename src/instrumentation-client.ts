import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://a2fc896c6173f731d5a366a63313fd79@o4511018936500224.ingest.us.sentry.io/4511018951901184",

    environment: process.env.NODE_ENV || 'development',

    // Trace 20% of requests in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

    debug: process.env.NODE_ENV !== 'production',

    // Capture session replays only on errors (free tier friendly)
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,

    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
    ],

    // Ignore non-actionable Next.js internal errors
    ignoreErrors: [
        'NEXT_NOT_FOUND',
        'NEXT_REDIRECT',
        'ResizeObserver loop limit exceeded',
    ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
