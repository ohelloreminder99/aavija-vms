-- Migration: 20260323_fix_settings_schema.sql
-- Description: Adds columns that are defined in application code but were missing
--              from the database schema, causing Supabase PostgREST cache errors.
--              All additions use IF NOT EXISTS and are safe to re-run.
--              Must be applied to ALL country databases (India, UAE, etc.)

-- Fix: whatsapp_phone_number_id (caused schema cache error in WhatsApp service)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;

COMMENT ON COLUMN public.settings.whatsapp_phone_number_id IS 'WhatsApp Cloud API Phone Number ID used as the sender for all outbound messages.';

-- Fix: Agent payout threshold (was hardcoded to 500 in token-service.ts,
--       now softcoded via Admin > Token & Economy Settings)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS payout_threshold_agent NUMERIC DEFAULT 500;

COMMENT ON COLUMN public.settings.payout_threshold_agent IS 'Minimum commission balance an agent must accumulate before being eligible to request a withdrawal payout.';

-- Fix: Referrer payout threshold (used by referral-service)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS payout_threshold_referrer NUMERIC DEFAULT 500;

COMMENT ON COLUMN public.settings.payout_threshold_referrer IS 'Minimum balance a referrer must accumulate before being eligible for a payout.';

-- Fix: TDS compliance fields (used by token-settings admin page but may be absent in older DBs)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tds_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tds_rate NUMERIC DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tds_annual_exemption NUMERIC DEFAULT 30000;

COMMENT ON COLUMN public.settings.tds_enabled IS 'Whether TDS deduction is active on agent/referrer payouts.';
COMMENT ON COLUMN public.settings.tds_rate IS 'TDS percentage rate (e.g., 10 = 10%). Section 194H applies.';
COMMENT ON COLUMN public.settings.tds_annual_exemption IS 'Annual payout amount (in currency) exempt from TDS.';

-- Fix: Referral program settings (used by referral-service but may be absent in older DBs)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS referral_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_reward_tokens NUMERIC DEFAULT 10,
  ADD COLUMN IF NOT EXISTS referral_commission_rate NUMERIC DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS referral_min_purchase_tokens NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS referral_first_purchase_only BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.settings.referral_enabled IS 'Master switch for the referral commission program.';
COMMENT ON COLUMN public.settings.referral_reward_tokens IS 'Bonus tokens credited to a new user who signs up via referral link.';
COMMENT ON COLUMN public.settings.referral_commission_rate IS 'Fraction of purchase value credited to referrer (e.g., 0.05 = 5%).';
COMMENT ON COLUMN public.settings.referral_min_purchase_tokens IS 'Minimum tokens a referee must purchase to trigger commission.';
COMMENT ON COLUMN public.settings.referral_first_purchase_only IS 'If true, commission is only paid on the referee''s very first purchase.';

-- Fix: Token conversion rate for agent payouts
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS token_conversion_rate NUMERIC DEFAULT 1;

COMMENT ON COLUMN public.settings.token_conversion_rate IS 'How many tokens an agent receives per 1 unit of local currency when converting commission to tokens.';

-- Fix: Payout method note displayed to agents
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS payout_method_note TEXT;

COMMENT ON COLUMN public.settings.payout_method_note IS 'Free-text note shown to agents explaining how/when payouts are processed (e.g., Every Monday via UPI).';
