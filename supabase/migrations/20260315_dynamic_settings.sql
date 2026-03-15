-- Migration: 20260315_dynamic_settings.sql
-- Description: Adds dynamic configuration parameters for rate limits, maintenance mode, and security thresholds.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS auth_rate_limit INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS checkin_rate_limit INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS whatsapp_rate_limit INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS max_daily_token_purchase NUMERIC DEFAULT 1000,
ADD COLUMN IF NOT EXISTS emergency_access_timeout_mins INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS is_maintenance_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'System is undergoing maintenance. Please try again later.';

COMMENT ON COLUMN public.settings.auth_rate_limit IS 'Max login/signup attempts per minute per IP.';
COMMENT ON COLUMN public.settings.checkin_rate_limit IS 'Max check-ins per gateway per hour.';
COMMENT ON COLUMN public.settings.whatsapp_rate_limit IS 'Max WhatsApp notifications per hour globally.';
COMMENT ON COLUMN public.settings.max_daily_token_purchase IS 'Max tokens a single user can buy in 24 hours.';
COMMENT ON COLUMN public.settings.emergency_access_timeout_mins IS 'Minutes the emergency contact is visible to gatekeepers.';
COMMENT ON COLUMN public.settings.is_maintenance_mode IS 'Global/Regional kill-switch for all database writes.';
COMMENT ON COLUMN public.settings.maintenance_message IS 'Display message during maintenance mode.';
