-- =============================================================================
-- AAVIJA VMS — Phase 2C SQL Migrations
-- Author: Antigravity (Google DeepMind), 2026-03-07
-- Purpose: Universal Referral System
--          Run this AFTER phase2b_migrations.sql.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Extend users table for referral tracking
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code             TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_commission_balance NUMERIC(12,2) DEFAULT 0;

-- Non-negative constraint for referral commission balance
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_referral_commission_balance_nonnegative'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_referral_commission_balance_nonnegative
      CHECK (referral_commission_balance >= 0);
  END IF;
END $$;

-- Index for fast referral code lookups at signup
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)
  WHERE referral_code IS NOT NULL;


-- =============================================================================
-- SECTION 2: referrals table
-- Tracks the referrer ↔ referee relationship and every commission event.
-- One row per commission-earning purchase (not per relationship),
-- so referrers can track exactly which purchases earned them what.
-- =============================================================================

CREATE TABLE IF NOT EXISTS referrals (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Commission earned fields
  purchase_amount   INTEGER       NOT NULL, -- tokens purchased by referee
  commission_amount NUMERIC(12,2) NOT NULL, -- ₹ earned by referrer
  commission_rate   NUMERIC(6,4)  NOT NULL, -- snapshot of rate at time of purchase
  -- Status
  status            TEXT          NOT NULL DEFAULT 'credited'
                      CHECK (status IN ('credited', 'paid_out')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Context
  context           JSONB
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee  ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created  ON referrals(created_at DESC);


-- =============================================================================
-- SECTION 3: Atomic RPC — Generate unique referral code for a user
-- Called at signup or on-demand if user doesn't have one yet.
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_generate_referral_code(
  p_user_id UUID,
  p_length  INTEGER DEFAULT 8
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing TEXT;
  v_code     TEXT;
  v_attempts INTEGER := 0;
  v_chars    TEXT    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- omit O,0,1,I for clarity
BEGIN
  -- Return existing code if already set
  SELECT referral_code INTO v_existing FROM users WHERE id = p_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'code', v_existing);
  END IF;

  -- Generate a unique code
  LOOP
    v_code := '';
    FOR i IN 1..p_length LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;

    -- Check for collision
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = v_code) THEN
      UPDATE users SET referral_code = v_code WHERE id = p_user_id;
      RETURN jsonb_build_object('success', true, 'code', v_code);
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Could not generate unique code after 20 attempts.');
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_generate_referral_code TO service_role;


-- =============================================================================
-- SECTION 4: Atomic RPC — Apply referral code at signup
-- Links referee to referrer. Optionally credits welcome tokens to referee.
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_apply_referral_code(
  p_referee_id        UUID,
  p_referral_code     TEXT,
  p_welcome_tokens    INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  -- Referee must not already have a referrer
  IF EXISTS (SELECT 1 FROM users WHERE id = p_referee_id AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied to your account.');
  END IF;

  -- Look up referrer by code
  SELECT id INTO v_referrer_id
  FROM users
  WHERE referral_code = UPPER(TRIM(p_referral_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code.');
  END IF;

  -- Referrer cannot refer themselves
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot use your own referral code.');
  END IF;

  -- Link referee to referrer
  UPDATE users SET referred_by = v_referrer_id WHERE id = p_referee_id;

  -- Credit welcome tokens to referee if configured
  IF p_welcome_tokens > 0 THEN
    UPDATE users
    SET token_balance_visitor = token_balance_visitor + p_welcome_tokens
    WHERE id = p_referee_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrerId', v_referrer_id,
    'welcomeTokens', p_welcome_tokens
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_apply_referral_code TO service_role;


-- =============================================================================
-- SECTION 5: Atomic RPC — Fire referral commission on token purchase
-- Called inside purchaseTokens() AFTER successful payment & token credit.
-- Only fires if:
--   a) referee has a referrer (referred_by IS NOT NULL)
--   b) purchase meets minimum threshold (referral_min_purchase_tokens)
--   c) referral system is enabled
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_fire_referral_commission(
  p_referee_id      UUID,
  p_tokens_purchased INTEGER,
  p_purchase_amount_inr NUMERIC,  -- rupee value of the purchase
  p_commission_rate  NUMERIC,     -- e.g. 0.05 = 5%
  p_min_tokens       INTEGER      -- minimum tokens to qualify
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id     UUID;
  v_commission      NUMERIC(12,2);
BEGIN
  -- Guard: minimum purchase threshold
  IF p_tokens_purchased < p_min_tokens THEN
    RETURN jsonb_build_object('success', false, 'skipped', true, 'reason', 'Below minimum purchase threshold.');
  END IF;

  -- Find referrer
  SELECT referred_by INTO v_referrer_id FROM users WHERE id = p_referee_id;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'skipped', true, 'reason', 'No referrer linked.');
  END IF;

  -- Calculate commission (floor to 2dp)
  v_commission := FLOOR(p_purchase_amount_inr * p_commission_rate * 100) / 100.0;

  IF v_commission <= 0 THEN
    RETURN jsonb_build_object('success', false, 'skipped', true, 'reason', 'Commission rounds to zero.');
  END IF;

  -- Credit commission to referrer
  UPDATE users
  SET referral_commission_balance = referral_commission_balance + v_commission
  WHERE id = v_referrer_id;

  -- Log the commission event in referrals table
  INSERT INTO referrals (
    referrer_id, referee_id, purchase_amount, commission_amount, commission_rate, status
  ) VALUES (
    v_referrer_id, p_referee_id, p_tokens_purchased, v_commission, p_commission_rate, 'credited'
  );

  RETURN jsonb_build_object(
    'success', true,
    'referrerId', v_referrer_id,
    'commissionCredited', v_commission
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_fire_referral_commission TO service_role;


-- =============================================================================
-- SECTION 6: Back-fill referral codes for all existing users who don't have one
-- Safe to run multiple times (skips users who already have a code).
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempts INTEGER;
BEGIN
  FOR r IN SELECT id FROM users WHERE referral_code IS NULL LOOP
    v_attempts := 0;
    LOOP
      v_code := '';
      FOR i IN 1..8 LOOP
        v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
      END LOOP;

      IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = v_code) THEN
        UPDATE users SET referral_code = v_code WHERE id = r.id;
        EXIT;
      END IF;

      v_attempts := v_attempts + 1;
      EXIT WHEN v_attempts > 50;
    END LOOP;
  END LOOP;
END $$;
