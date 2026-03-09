-- Add new Security & Concurrency columns to the `settings` table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS qr_code_expiry_seconds NUMERIC DEFAULT 60,
ADD COLUMN IF NOT EXISTS rate_limit_max_requests NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS rate_limit_window_ms NUMERIC DEFAULT 60000,
ADD COLUMN IF NOT EXISTS allow_concurrent_checkins BOOLEAN DEFAULT false;
