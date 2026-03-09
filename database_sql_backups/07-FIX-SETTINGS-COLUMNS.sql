-- Fix for Missing Settings Columns and Schema Cache
-- 1. Ensure all new Security, UX, and i18n variables are physically present on the 'settings' table.
-- 2. Force the Supabase PostgREST API to instantly reload its Schema Cache so the Next.js server can see them.

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS enable_multilingual BOOLEAN DEFAULT true;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS qr_code_expiry_seconds INT DEFAULT 600;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS rate_limit_max_requests INT DEFAULT 10;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS rate_limit_window_ms INT DEFAULT 60000;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS allow_concurrent_checkins BOOLEAN DEFAULT false;

-- The critical command to instantly clear Supabase's "Could not find column in schema cache" API error
NOTIFY pgrst, 'reload schema';
