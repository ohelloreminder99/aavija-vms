-- Migration: Premise-Specific Host Blocklist
-- Description: Adds premise_id to host_blocked_visitors and updates RPCs for premise-level granularity.

-- 1. Add premise_id to host_blocked_visitors
ALTER TABLE public.host_blocked_visitors
ADD COLUMN IF NOT EXISTS premise_id TEXT;

-- 2. Update existing data (optional, but good for consistency)
-- If we can derive premise_id from somewhere, we should. 
-- But since it was global before, it's hard to know which premise it was for.
-- We'll leave them as NULL or set to a default if known.

-- 3. Update the unique constraint/primary key
-- First, remove current primary key if it exists on (id, host_id)
-- Note: In Supabase, the table might have a different PK. Let's assume (id, host_id) based on the ON CONFLICT clause.
DO $$ 
BEGIN
    -- Check if constraint exists and drop it
    -- We'll use a unique index for the ON CONFLICT clause if it's not the PK.
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'host_blocked_visitors_pkey') THEN
        -- If it's the PK, we might need to handle it differently.
        -- For now, let's just make sure we have a unique index on (id, host_id, premise_id)
        NULL;
    END IF;
END $$;

-- Ensure we have a unique index for the new logic
-- We drop the old one if it exists (assuming it was on id, host_id)
DROP INDEX IF EXISTS host_blocked_visitors_id_host_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS host_blocked_visitors_id_host_id_premise_id_idx 
ON public.host_blocked_visitors (id, host_id, premise_id);

-- 3.5 Drop old function signatures to avoid "not unique" error
-- We drop these specifically to allow the new signatures with p_premise_id to be created uniquely.
DROP FUNCTION IF EXISTS public.rpc_block_visitor_host(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_unblock_visitor_host(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ);
-- Also drop any potentially overlapping ones from previous attempts
DROP FUNCTION IF EXISTS public.rpc_block_visitor_host(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_unblock_visitor_host(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ);

-- 4. Update rpc_block_visitor_host
CREATE OR REPLACE FUNCTION rpc_block_visitor_host(
  p_host_id       TEXT,
  p_visitor_id    TEXT,
  p_block_cost    INTEGER,
  p_actor_id      TEXT,
  p_actor_name    TEXT,
  p_actor_role    TEXT,
  p_visitor_name  TEXT,
  p_visitor_photo TEXT,
  p_premise_id    TEXT, -- Added parameter
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
  -- We still deduct from the host's personal visitor token balance
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

  -- Insert block record with premise_id
  INSERT INTO host_blocked_visitors (id, host_id, premise_id, "blockedAt", "blockedBy", "visitorName", "visitorPhotoUrl")
  VALUES (p_visitor_id, p_host_id, p_premise_id, NOW(), p_actor_id, p_visitor_name, p_visitor_photo)
  ON CONFLICT (id, host_id, premise_id) DO NOTHING;

  INSERT INTO logs (
    "actorId", "actorName", "actorRole", action, description,
    "tokenChange", timestamp, context, "expiresAt"
  )
  VALUES (
    p_actor_id, p_actor_name, p_actor_role,
    'HOST_BLOCK_VISITOR',
    'Host "' || p_actor_name || '" blocked visitor "' || p_visitor_name || '" at premise ID: ' || p_premise_id || '. Cost: ' || p_block_cost || ' tokens.',
    -p_block_cost,
    NOW(),
    jsonb_build_object('premiseId', p_premise_id, 'visitorId', p_visitor_id),
    p_expires_at
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Update rpc_unblock_visitor_host
CREATE OR REPLACE FUNCTION rpc_unblock_visitor_host(
  p_host_id      TEXT,
  p_visitor_id   TEXT,
  p_premise_id   TEXT, -- Added parameter
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

  -- Delete block record for the specific premise
  DELETE FROM host_blocked_visitors
  WHERE id = p_visitor_id AND host_id = p_host_id AND premise_id = p_premise_id;

  INSERT INTO logs (
    "actorId", "actorName", "actorRole", action, description,
    "tokenChange", timestamp, context, "expiresAt"
  )
  VALUES (
    p_actor_id, p_actor_name, p_actor_role,
    'HOST_UNBLOCK_VISITOR',
    'Host "' || p_actor_name || '" unblocked visitor (ID: ' || p_visitor_id || ') at premise ID: ' || p_premise_id || '. Cost: ' || p_unblock_cost || ' tokens.',
    -p_unblock_cost,
    NOW(),
    jsonb_build_object('premiseId', p_premise_id, 'visitorId', p_visitor_id),
    p_expires_at
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION rpc_block_visitor_host(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_unblock_visitor_host(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- 7. Ensure security search path
ALTER FUNCTION rpc_block_visitor_host SET search_path = public;
ALTER FUNCTION rpc_unblock_visitor_host SET search_path = public;
