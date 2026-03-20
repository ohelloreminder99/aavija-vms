import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://a2fc896c6173f731d5a366a63313fd79@o4511018936500224.ingest.us.sentry.io/4511018951901184",

    // Performance tracing — sample 20% in prod to limit costs
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

    // Capture unhandled promise rejections & exceptions in server actions
    integrations: [
        Sentry.captureConsoleIntegration({ levels: ['error'] }),
    ],

    // Tag every event with the environment
    environment: process.env.NODE_ENV || 'development',

    // Set this to false in production so noise is minimized
    debug: process.env.NODE_ENV !== 'production',

    // Ignore non-actionable errors
    ignoreErrors: [
        'NEXT_NOT_FOUND',
        'NEXT_REDIRECT',
    ],
});
