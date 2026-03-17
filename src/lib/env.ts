import { z } from 'zod';

const envSchema = z.object({
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // Razorpay
    NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().min(1),
    RAZORPAY_KEY_SECRET: z.string().min(1),

    // WhatsApp
    WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
    WHATSAPP_API_TOKEN: z.string().min(1).optional(), // Legacy fallback
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),

    // Site
    NEXT_PUBLIC_SITE_URL: z.string().url().optional().default('http://localhost:3000'),

    // Environment
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Sentry
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

// Use safeParse to prevent crashing the entire app if some variables are missing in production.
const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN,
    WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    // If we're in development, we might want to still throw or alert.
    // In production, we try to survive if possible, though some features will break.
}

// Export the env object, falling back to an empty object if validation fails
// so the app can at least boot and attempt to show an error or use hardcoded fallbacks.
export const env = parsed.success ? parsed.data : {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://plruocrysgpyyfypcjwe.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
} as Env;

export type Env = z.infer<typeof envSchema>;
