-- =============================================================================
-- AAVIJA VMS — Phase 2B/2C Settings Columns Migration
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Adds the new Phase 2B (Agent Payouts, TDS) and Phase 2C (Referral Program)
-- columns to the settings table, then reloads PostgREST schema cache to fix
-- the "Could not find column in schema cache" error immediately.
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS throughout.
-- =============================================================================

-- ── Phase 2B: Agent Payout Settings ─────────────────────────────────────────

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS payout_threshold_agent    NUMERIC        DEFAULT 500;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS token_conversion_rate     NUMERIC        DEFAULT 1;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS payout_method_note        TEXT           DEFAULT '';

-- ── Phase 2B: TDS Compliance ─────────────────────────────────────────────────

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tds_enabled               BOOLEAN        DEFAULT false;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tds_rate                  NUMERIC        DEFAULT 10;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tds_annual_exemption      NUMERIC        DEFAULT 30000;

-- ── Phase 2C: Referral Program ───────────────────────────────────────────────

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS referral_enabled             BOOLEAN     DEFAULT false;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS referral_commission_rate     NUMERIC     DEFAULT 0.05;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS referral_min_purchase_tokens INTEGER     DEFAULT 50;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS referral_reward_tokens       INTEGER     DEFAULT 10;

-- ── Reload PostgREST schema cache instantly ───────────────────────────────────
-- This clears the "Could not find column in schema cache" error without
-- requiring a server restart.

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- DONE. All settings columns are now live.
-- =============================================================================
