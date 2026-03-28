-- ═══════════════════════════════════════════════════════════════════════════
-- AAVIJA VMS — Atomic Premise Approval RPC
-- Run this in your Supabase SQL Editor.
-- This replaces the multi-step sequential approval with a single atomic transaction.
-- If ANY step fails, ALL changes are rolled back.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION approve_premise_application(
  p_application_id UUID,
  p_category_id UUID,
  p_admin_id UUID,
  p_admin_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app           premise_applications%ROWTYPE;
  v_owner         users%ROWTYPE;
  v_category      premise_categories%ROWTYPE;
  v_settings      settings%ROWTYPE;
  v_premise_id    UUID := gen_random_uuid();
  v_agent_id      UUID;
  v_current_roles JSONB;
  v_updated_roles JSONB;
BEGIN
  -- ── 1. Fetch the pending application (lock it for update) ─────────────────
  SELECT * INTO v_app
  FROM premise_applications
  WHERE id = p_application_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found or already processed.');
  END IF;

  -- Initialize v_agent_id after v_app is fetched
  v_agent_id := COALESCE(v_app.agent_user_id, v_app.submitted_by);


  -- ── 2. Fetch and validate category ────────────────────────────────────────
  SELECT * INTO v_category
  FROM premise_categories
  WHERE id = p_category_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected category not found.');
  END IF;

  -- ── 3. Fetch owner from email ──────────────────────────────────────────────
  SELECT * INTO v_owner
  FROM users
  WHERE email = v_app.owner_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner account not found for email: ' || v_app.owner_email);
  END IF;

  -- ── 4. Fetch settings ─────────────────────────────────────────────────────
  SELECT * INTO v_settings FROM settings WHERE id = 'global';

  -- ── 5. Ensure agent exists in shadow table (upsert) ───────────────────────
  IF v_agent_id IS NOT NULL THEN
    INSERT INTO agents (id, name, phone, city, commission_balance)
    VALUES (
      v_agent_id,
      COALESCE(v_app.agent_name, 'Unknown Agent'),
      '',
      COALESCE(v_app.city_name, 'Unknown'),
      0
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── 6. Create the premise ─────────────────────────────────────────────────
  INSERT INTO premises (
    id, name, address, city, "cityId", city_state, is_active,
    owner_id, "ownerName", agent_id, "categoryId", "categoryName",
    staff, host_count, gatekeeper_count, token_balance
  ) VALUES (
    v_premise_id,
    v_app.premise_name,
    v_app.premise_address,
    COALESCE(v_app.city_name, ''),
    v_app.city_id::TEXT,
    COALESCE(v_app.city_state, 'Unknown'),
    true,
    v_owner.id,
    v_owner.name,
    v_agent_id,
    v_category.id,
    v_category.name,
    '[]'::JSONB,
    0,
    0,
    COALESCE(v_settings.starting_token_owner, 0)
  );

  -- ── 7. Update owner's premise_roles ───────────────────────────────────────
  v_current_roles := COALESCE(v_owner.premise_roles, '{}'::JSONB);
  v_updated_roles := jsonb_set(
    v_current_roles,
    ARRAY[v_premise_id::TEXT],
    COALESCE(v_current_roles->v_premise_id::TEXT, '[]'::JSONB) || '["owner"]'::JSONB
  );

  UPDATE users
  SET premise_roles = v_updated_roles
  WHERE id = v_owner.id;

  -- ── 8. Log initial token allocation ───────────────────────────────────────
  IF COALESCE(v_settings.starting_token_owner, 0) > 0 THEN
    INSERT INTO logs (
      "actorId", "actorName", "actorRole", action,
      description, "tokenChange", "premiseId", context
    ) VALUES (
      p_admin_id,
      p_admin_name,
      'admin',
      'INITIAL_TOKEN_ALLOCATION',
      'Welcome Bonus: Premise "' || v_app.premise_name || '" received ' || v_settings.starting_token_owner || ' tokens.',
      v_settings.starting_token_owner,
      v_premise_id,
      jsonb_build_object('premiseId', v_premise_id, 'applicationId', p_application_id)
    );

    -- ── 8B. Create initial invoice (Welcome Bonus) ──────────────────────────
    INSERT INTO invoices (
      id, "userId", "userName", "userEmail", "userPhone", "userState",
      "premiseId", "tokenAmount", subtotal, "totalAmount", status
    ) VALUES (
      'INV-' || v_premise_id::text,
      v_owner.id,
      v_owner.name,
      v_owner.email,
      COALESCE(v_owner.phone, ''),
      COALESCE(v_app.city_state, 'Unknown'),
      v_premise_id,
      v_settings.starting_token_owner,
      0,
      0,
      'paid'
    );
  END IF;

  -- ── 9. Mark application as approved ───────────────────────────────────────
  UPDATE premise_applications
  SET
    status = 'approved',
    reviewed_by = p_admin_id,
    reviewed_at = NOW(),
    created_premise_id = v_premise_id
  WHERE id = p_application_id;

  -- ── 9. Return success with the new premise ID ──────────────────────────────
  RETURN jsonb_build_object(
    'success', true,
    'premise_id', v_premise_id,
    'premise_name', v_app.premise_name,
    'owner_name', v_owner.name,
    'owner_phone', v_owner.phone,
    'premise_name', v_app.premise_name
  );

EXCEPTION WHEN OTHERS THEN
  -- The transaction is automatically rolled back by the EXCEPTION block
  RAISE LOG 'approve_premise_application failed for application %: %', p_application_id, SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION approve_premise_application(UUID, UUID, UUID, TEXT) TO service_role;
