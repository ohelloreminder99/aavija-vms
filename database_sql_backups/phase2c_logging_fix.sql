-- =============================================================================
-- AAVIJA VMS — Phase 2C Logging Fix
-- Author: Antigravity (Google DeepMind), 2026-03-07
-- Purpose: Ensure all referral rewards are logged to the 'logs' table for token history visibility.
-- =============================================================================

-- 1. Update rpc_apply_referral_code to include logging
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
  v_referee_name TEXT;
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
    SELECT name INTO v_referee_name FROM users WHERE id = p_referee_id;
    
    UPDATE users
    SET token_balance_visitor = token_balance_visitor + p_welcome_tokens
    WHERE id = p_referee_id;

    -- LOGGING
    INSERT INTO logs (
      "actorId", "actorName", "actorRole", action, timestamp, description, "tokenChange"
    ) VALUES (
      p_referee_id,
      COALESCE(v_referee_name, 'New User'),
      'visitor',
      'REFERRAL_WELCOME_TOKENS',
      now(),
      'Received ' || p_welcome_tokens || ' welcome tokens for signing up with referral code ' || p_referral_code || '.',
      p_welcome_tokens
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrerId', v_referrer_id,
    'welcomeTokens', p_welcome_tokens
  );
END;
$$;


-- 2. Update rpc_fire_referral_commission to include logging
CREATE OR REPLACE FUNCTION rpc_fire_referral_commission(
  p_referee_id      UUID,
  p_tokens_purchased INTEGER,
  p_purchase_amount_inr NUMERIC,
  p_commission_rate  NUMERIC,
  p_min_tokens       INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id     UUID;
  v_referrer_name   TEXT;
  v_referee_name    TEXT;
  v_commission      NUMERIC(12,2);
BEGIN
  -- Guard: minimum purchase threshold
  IF p_tokens_purchased < p_min_tokens THEN
    RETURN jsonb_build_object('success', false, 'skipped', true, 'reason', 'Below minimum purchase threshold.');
  END IF;

  -- Find referrer and names
  SELECT u.referred_by, u.name, r.name INTO v_referrer_id, v_referee_name, v_referrer_name
  FROM users u
  LEFT JOIN users r ON u.referred_by = r.id
  WHERE u.id = p_referee_id;

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

  -- LOGGING
  INSERT INTO logs (
    "actorId", "actorName", "actorRole", action, timestamp, description
  ) VALUES (
    v_referrer_id,
    COALESCE(v_referrer_name, 'Referrer'),
    'visitor',
    'REFERRAL_COMMISSION_CREDITED',
    now(),
    'Earned ₹' || v_commission || ' commission from ' || COALESCE(v_referee_name, 'a referred user') || '''' || 's purchase of ' || p_tokens_purchased || ' tokens.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'referrerId', v_referrer_id,
    'commissionCredited', v_commission
  );
END;
$$;
