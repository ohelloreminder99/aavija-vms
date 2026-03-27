-- Migration: 20260327_add_action_timestamps.sql
-- Description: Adds the missing action_timestamps JSONB column to public.users to fix OTP rate limiting errors.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS action_timestamps JSONB DEFAULT '{}'::jsonb;

-- Comment for self documentation
COMMENT ON COLUMN public.users.action_timestamps IS 'Rate limiting timestamps per action type (e.g., whatsapp_otp_requests)';
