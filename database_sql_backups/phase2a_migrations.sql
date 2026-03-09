-- =============================================================================
-- AAVIJA VMS — Phase 2A SQL Migrations
-- Author: Antigravity (Google DeepMind), 2026-03-07
-- Purpose: Add atomic RPC functions for all block/unblock operations,
--          and enforce non-negative balance constraints at the DB level.
--          These prevent race conditions and ensure financial data integrity
--          even if the application layer crashes mid-operation.
-- Run this in your Supabase SQL Editor.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Non-Negative Balance Constraints
-- =============================================================================
-- These constraints are a last-resort safety net.
-- The RPC functions below use FOR UPDATE locking, but these constraints ensure
-- the DB itself will NEVER allow a negative balance under any circumstances.

-- Non-negative constraint for premise token balance
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_premise_token_balance_nonnegative'
  ) THEN
    ALTER TABLE premises
      ADD CONSTRAINT chk_premise_token_balance_nonnegative CHECK (token_balance >= 0);
  END IF;
END $$;

-- Non-negative constraint for visitor token balance
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_visitor_token_balance_nonnegative'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_visitor_token_balance_nonnegative CHECK (token_balance_visitor >= 0);
  END IF;
END $$;

-- NOTE: chk_agent_commission_balance_nonnegative is intentionally omitted here.
-- The agent_commission_balance column is added in Phase 2B migration.
-- The constraint will be applied there, alongside the column creation.


-- =============================================================================
-- SECTION 2: Atomic Block Visitor from Premise
-- =============================================================================
-- Replaces the 3-step write chain in block-service.ts:
-- (1) deduct tokens, (2) insert block record, (3) insert log — all in one tx.

CREATE OR REPLACE FUNCTION rpc_block_visitor_premise(
  p_premise_id    TEXT,
  p_visitor_id    TEXT,
  p_block_cost    INTEGER,
  p_actor_id      TEXT,
  p_actor_name    TEXT,
  p_actor_role    TEXT,
  p_visitor_name  TEXT,
  p_visitor_photo TEXT,
  p_expires_at    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
  v_description     TEXT;
BEGIN
  -- Lock the premise row to prevent race conditions
  SELECT token_balance INTO v_current_balance
  FROM premises
  WHERE id = p_premise_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Premise not found.');
  END IF;

  IF v_current_balance < p_block_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient tokens. Action costs ' || p_block_cost || ' tokens. Balance: ' || v_current_balance
    );
  END IF;

  v_new_balance := v_current_balance - p_block_cost;

  -- 1. Deduct tokens
  UPDATE premises SET token_balance = v_new_balance WHERE id = p_premise_id;

  -- 2. Insert block record
  INSERT INTO premise_blocked_visitors (id, premise_id, "blockedAt", "blockedBy", "visitorName", "visitorPhotoUrl")
  VALUES (p_visitor_id, p_premise_id, NOW(), p_actor_id, p_visitor_name, p_visitor_photo)
  ON CONFLICT (id, premise_id) DO NOTHING;

  -- 3. Insert audit log
  v_description := p_actor_role || ' "' || p_actor_name || '" blocked visitor (ID: ' || p_visitor_id || '). Cost: ' || p_block_cost || ' tokens.';
  INSERT INTO logs (
    "actorId", "actorName", "actorRole", action, description,
    "tokenChange", timestamp, context, "expiresAt"
  )
  VALUES (
    p_actor_id, p_actor_name, p_actor_role,
    'PREMISE_BLOCK_VISITOR',
    v_description,
    -p_block_cost,
    NOW(),
    jsonb_build_object('premiseId', p_premise_id),
    p_expires_at
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


-- =============================================================================
-- SECTION 3: Atomic Unblock Visitor from Premise
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_unblock_visitor_premise(
  p_premise_id  TEXT,
  p_visitor_id  TEXT,
  p_unblock_cost INTEGER,
  p_actor_id    TEXT,
  p_actor_name  TEXT,
  p_actor_role  TEXT,
  p_expires_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  SELECT token_balance INTO v_current_balance
  FROM premises
  WHERE id = p_premise_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Premise not found.');
  END IF;

  IF v_current_balance < p_unblock_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient tokens. Action costs ' || p_unblock_cost || ' tokens.'
    );
  END IF;

  v_new_balance := v_current_balance - p_unblock_cost;

  UPDATE premises SET token_balance = v_new_balance WHERE id = p_premise_id;

  DELETE FROM premise_blocked_visitors
  WHERE id = p_visitor_id AND premise_id = p_premise_id;

  INSERT INTO logs (
    "actorId", "actorName", "actorRole", action, description,
    "tokenChange", timestamp, context, "expiresAt"
  )
  VALUES (
    p_actor_id, p_actor_name, p_actor_role,
    'PREMISE_UNBLOCK_VISITOR',
    p_actor_role || ' "' || p_actor_name || '" unblocked visitor (ID: ' || p_visitor_id || '). Cost: ' || p_unblock_cost || ' tokens.',
    -p_unblock_cost,
    NOW(),
    jsonb_build_object('premiseId', p_premise_id),
    p_expires_at
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


-- =============================================================================
-- SECTION 4: Atomic Block Visitor from Host
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_block_visitor_host(
  p_host_id       TEXT,
  p_visitor_id    TEXT,
  p_block_cost    INTEGER,
  p_actor_id      TEXT,
  p_actor_name    TEXT,
  p_actor_role    TEXT,
  p_visitor_name  TEXT,
  p_visitor_photo TEXT,
  p_expires_at    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  SELECT token_balance_visitor INTO v_current_balance
  FROM users
  WHERE id = p_host_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Host profile not found.');
  END IF;

  IF v_current_balance < p_block_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient tokens. Action costs ' || p_block_cost || ' tokens.'
    );
  END IF;

  v_new_balance := v_current_balance - p_block_cost;

  UPDATE users SET token_balance_visitor = v_new_balance WHERE id = p_host_id;

  INSERT INTO host_blocked_visitors (id, host_id, "blockedAt", "blockedBy", "visitorName", "visitorPhotoUrl")
  VALUES (p_visitor_id, p_host_id, NOW(), p_actor_id, p_visitor_name, p_visitor_photo)
  ON CONFLICT (id, host_id) DO NOTHING;

  INSERT INTO logs (
    "actorId", "actorName", "actorRole", action, description,
    "tokenChange", timestamp, "expiresAt"
  )
  VALUES (
    p_actor_id, p_actor_name, p_actor_role,
    'HOST_BLOCK_VISITOR',
    'Host "' || p_actor_name || '" blocked visitor "' || p_visitor_name || '". Cost: ' || p_block_cost || ' tokens.',
    -p_block_cost,
    NOW(),
    p_expires_at
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


-- =============================================================================
-- SECTION 5: Atomic Unblock Visitor from Host
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_unblock_visitor_host(
  p_host_id      TEXT,
  p_visitor_id   TEXT,
  p_unblock_cost INTEGER,
  p_actor_id     TEXT,
  p_actor_name   TEXT,
  p_actor_role   TEXT,
  p_expires_at   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  SELECT token_balance_visitor INTO v_current_balance
  FROM users
  WHERE id = p_host_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Host profile not found.');
  END IF;

  IF v_current_balance < p_unblock_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient tokens. Action costs ' || p_unblock_cost || ' tokens.'
    );
  END IF;

  v_new_balance := v_current_balance - p_unblock_cost;

  UPDATE users SET token_balance_visitor = v_new_balance WHERE id = p_host_id;

  DELETE FROM host_blocked_visitors
  WHERE id = p_visitor_id AND host_id = p_host_id;

  INSERT INTO logs (
    "actorId", "actorName", "actorRole", action, description,
    "tokenChange", timestamp, "expiresAt"
  )
  VALUES (
    p_actor_id, p_actor_name, p_actor_role,
    'HOST_UNBLOCK_VISITOR',
    'Host "' || p_actor_name || '" unblocked visitor (ID: ' || p_visitor_id || '). Cost: ' || p_unblock_cost || ' tokens.',
    -p_unblock_cost,
    NOW(),
    p_expires_at
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


-- =============================================================================
-- GRANT EXECUTE to the authenticated role (service role already has all access)
-- =============================================================================
GRANT EXECUTE ON FUNCTION rpc_block_visitor_premise   TO service_role;
GRANT EXECUTE ON FUNCTION rpc_unblock_visitor_premise TO service_role;
GRANT EXECUTE ON FUNCTION rpc_block_visitor_host      TO service_role;
GRANT EXECUTE ON FUNCTION rpc_unblock_visitor_host    TO service_role;
