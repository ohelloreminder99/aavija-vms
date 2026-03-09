-- =============================================================================
-- AAVIJA VMS — Phase 2B SQL Migrations
-- Author: Antigravity (Google DeepMind), 2026-03-07
-- Purpose: Agent-as-User redesign + payout_requests table.
--          Run this in Supabase SQL Editor AFTER phase2a_migrations.sql.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Extend users table for Agent functionality
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_agent              BOOLEAN         DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_commission_balance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_payout_upi      TEXT,
  ADD COLUMN IF NOT EXISTS pan_number            TEXT,
  ADD COLUMN IF NOT EXISTS pan_card_url          TEXT,
  ADD COLUMN IF NOT EXISTS kyc_verified          BOOLEAN         DEFAULT false;

-- Now add the non-negative constraint we deferred from Phase 2A
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_agent_commission_balance_nonnegative'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_agent_commission_balance_nonnegative
      CHECK (agent_commission_balance >= 0);
  END IF;
END $$;


-- =============================================================================
-- SECTION 2: payout_requests table
-- =============================================================================
-- This is the unified table for both cash payout requests and token
-- conversion requests from agents and referrers.
-- Balance is NOT zeroed on request — only on admin "Mark as Paid" confirmation.

CREATE TABLE IF NOT EXISTS payout_requests (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type            TEXT          NOT NULL DEFAULT 'cash'
                    CHECK (type IN ('cash', 'token_conversion')),
  status          TEXT          NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
  source          TEXT          NOT NULL DEFAULT 'agent'
                    CHECK (source IN ('agent', 'referral', 'combined')),
  -- Cash payout fields
  upi_id          TEXT,
  tds_deducted    NUMERIC(12,2) DEFAULT 0,
  net_amount      NUMERIC(12,2),
  admin_note      TEXT,
  -- Token conversion fields
  tokens_credited INTEGER       DEFAULT 0,
  conversion_rate NUMERIC(8,4),
  -- Timestamps
  requested_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  -- Context
  context         JSONB
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_user    ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status  ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_type    ON payout_requests(type);


-- =============================================================================
-- SECTION 3: Atomic RPC — Designate a user as agent by email
-- =============================================================================
-- Used by admin when assigning an agent to a premise.
-- Finds the user by email, sets is_agent=true, auto-creates agents row if needed.

CREATE OR REPLACE FUNCTION rpc_designate_agent_by_email(
  p_agent_email TEXT,
  p_premise_id  TEXT,
  p_admin_id    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   TEXT;
  v_user_name TEXT;
BEGIN
  -- Resolve user by email
  SELECT id, name INTO v_user_id, v_user_name
  FROM users
  WHERE email = p_agent_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No user found with that email address. Ask them to sign up first.'
    );
  END IF;

  -- Mark user as agent
  UPDATE users SET is_agent = true WHERE id = v_user_id;

  -- Create shadow agents row if not exists (for ledger compatibility)
  INSERT INTO agents (id, name, phone, city, commission_balance)
  SELECT v_user_id, u.name, u.phone, u.city, 0
  FROM users u WHERE u.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Link the agent to the premise
  UPDATE premises SET agent_id = v_user_id WHERE id = p_premise_id;

  RETURN jsonb_build_object(
    'success', true,
    'agentId', v_user_id,
    'agentName', v_user_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_designate_agent_by_email TO service_role;


-- =============================================================================
-- SECTION 4: Atomic RPC — Process a payout (admin marks as paid)
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_process_payout(
  p_request_id TEXT,
  p_admin_id   TEXT,
  p_utr_note   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req       RECORD;
  v_tokens_to_add INTEGER;
BEGIN
  -- Lock and fetch the request
  SELECT * INTO v_req
  FROM payout_requests
  WHERE id = p_request_id::UUID
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found.');
  END IF;

  IF v_req.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not in a processable state.');
  END IF;

  IF v_req.type = 'cash' THEN
    -- Deduct from agent commission balance
    UPDATE users
    SET agent_commission_balance = GREATEST(0, agent_commission_balance - v_req.amount)
    WHERE id = v_req.user_id;

    UPDATE payout_requests
    SET status = 'paid',
        processed_at = NOW(),
        admin_note = COALESCE(p_utr_note, admin_note),
        context = COALESCE(context, '{}'::JSONB) || jsonb_build_object('processedBy', p_admin_id)
    WHERE id = p_request_id::UUID;

  ELSIF v_req.type = 'token_conversion' THEN
    -- Deduct commission, credit tokens
    v_tokens_to_add := COALESCE(v_req.tokens_credited, 0);

    UPDATE users
    SET agent_commission_balance = GREATEST(0, agent_commission_balance - v_req.amount),
        token_balance_visitor = token_balance_visitor + v_tokens_to_add
    WHERE id = v_req.user_id;

    UPDATE payout_requests
    SET status = 'paid',
        processed_at = NOW(),
        context = COALESCE(context, '{}'::JSONB) || jsonb_build_object('processedBy', p_admin_id)
    WHERE id = p_request_id::UUID;
  END IF;

  -- Insert audit log
  INSERT INTO logs (
    "actorId", "actorName", "actorRole", action, description, timestamp
  )
  VALUES (
    p_admin_id, 'Admin', 'admin',
    'AGENT_PAYOUT_PROCESSED',
    'Payout request ' || p_request_id || ' processed (' || v_req.type || '). Amount: ' || v_req.amount,
    NOW()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_process_payout TO service_role;


-- =============================================================================
-- SECTION 5: Atomic RPC — Reject a payout request
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_reject_payout(
  p_request_id TEXT,
  p_admin_id   TEXT,
  p_reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req
  FROM payout_requests
  WHERE id = p_request_id::UUID
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found.');
  END IF;

  IF v_req.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request cannot be rejected in its current state.');
  END IF;

  UPDATE payout_requests
  SET status = 'rejected',
      processed_at = NOW(),
      admin_note = p_reason,
      context = COALESCE(context, '{}'::JSONB) || jsonb_build_object('rejectedBy', p_admin_id)
  WHERE id = p_request_id::UUID;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_reject_payout TO service_role;


-- =============================================================================
-- SECTION 6: Atomic RPC — Credit agent commission (avoids read-then-write race)
-- Called from purchaseTokens() in token-service.ts.
-- Uses UPDATE ... SET col = col + amount so no SELECT is needed.
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_credit_agent_commission(
  p_agent_user_id     UUID,
  p_commission_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET agent_commission_balance = agent_commission_balance + p_commission_amount
  WHERE id = p_agent_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_credit_agent_commission TO service_role;

