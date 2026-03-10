-- =============================================================================
-- AAVIJA VMS — Master Security Hardening Patch (March 2026)
-- Target: Supabase Security Advisor Linter Fixes
-- =============================================================================

-- 1. HARDEN RPC FUNCTIONS (Fix search_path mutable warning)
-- This prevents the "search_path" attack where a malicious user could potentially 
-- trick a function into running a fake version of a table or operator.

--------------------------------------------------------------------------------
-- RE-CREATE FUNCTIONS WITH 'SET search_path = public'
--------------------------------------------------------------------------------

-- REFERRAL SYSTEM HARDENING
CREATE OR REPLACE FUNCTION rpc_generate_referral_code(p_user_id UUID, p_length INTEGER DEFAULT 8)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing TEXT; v_code TEXT; v_attempts INTEGER := 0; v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  SELECT referral_code INTO v_existing FROM users WHERE id = p_user_id;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('success', true, 'code', v_existing); END IF;
  LOOP
    v_code := ''; FOR i IN 1..p_length LOOP v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1); END LOOP;
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = v_code) THEN UPDATE users SET referral_code = v_code WHERE id = p_user_id; RETURN jsonb_build_object('success', true, 'code', v_code); END IF;
    v_attempts := v_attempts + 1; IF v_attempts > 20 THEN RETURN jsonb_build_object('success', false, 'error', 'Could not generate unique code after 20 attempts.'); END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_apply_referral_code(p_referee_id UUID, p_referral_code TEXT, p_welcome_tokens INTEGER DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id = p_referee_id AND referred_by IS NOT NULL) THEN RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied.'); END IF;
  SELECT id INTO v_referrer_id FROM users WHERE referral_code = UPPER(TRIM(p_referral_code)) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code.'); END IF;
  IF v_referrer_id = p_referee_id THEN RETURN jsonb_build_object('success', false, 'error', 'You cannot use your own code.'); END IF;
  UPDATE users SET referred_by = v_referrer_id WHERE id = p_referee_id;
  IF p_welcome_tokens > 0 THEN UPDATE users SET token_balance_visitor = token_balance_visitor + p_welcome_tokens WHERE id = p_referee_id; END IF;
  RETURN jsonb_build_object('success', true, 'referrerId', v_referrer_id, 'welcomeTokens', p_welcome_tokens);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_fire_referral_commission(p_referee_id UUID, p_tokens_purchased INTEGER, p_purchase_amount_inr NUMERIC, p_commission_rate NUMERIC, p_min_tokens INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer_id UUID; v_commission NUMERIC(12,2);
BEGIN
  IF p_tokens_purchased < p_min_tokens THEN RETURN jsonb_build_object('success', false, 'skipped', true, 'reason', 'Below threshold.'); END IF;
  SELECT referred_by INTO v_referrer_id FROM users WHERE id = p_referee_id;
  IF v_referrer_id IS NULL THEN RETURN jsonb_build_object('success', false, 'skipped', true, 'reason', 'No referrer.'); END IF;
  v_commission := FLOOR(p_purchase_amount_inr * p_commission_rate * 100) / 100.0;
  IF v_commission <= 0 THEN RETURN jsonb_build_object('success', false, 'skipped', true, 'reason', 'Zero commission.'); END IF;
  UPDATE users SET referral_commission_balance = referral_commission_balance + v_commission WHERE id = v_referrer_id;
  INSERT INTO referrals (referrer_id, referee_id, purchase_amount, commission_amount, commission_rate, status) VALUES (v_referrer_id, p_referee_id, p_tokens_purchased, v_commission, p_commission_rate, 'credited');
  RETURN jsonb_build_object('success', true, 'referrerId', v_referrer_id, 'commissionCredited', v_commission);
END;
$$;

-- AGENT & PAYOUT HARDENING
CREATE OR REPLACE FUNCTION rpc_designate_agent_by_email(p_agent_email TEXT, p_premise_id TEXT, p_admin_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id TEXT; v_user_name TEXT;
BEGIN
  SELECT id, name INTO v_user_id, v_user_name FROM users WHERE email = p_agent_email LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'No user found.'); END IF;
  UPDATE users SET is_agent = true WHERE id = v_user_id;
  INSERT INTO agents (id, name, phone, city, commission_balance) SELECT v_user_id, u.name, u.phone, u.city, 0 FROM users u WHERE u.id = v_user_id ON CONFLICT (id) DO NOTHING;
  UPDATE premises SET agent_id = v_user_id WHERE id = p_premise_id;
  RETURN jsonb_build_object('success', true, 'agentId', v_user_id, 'agentName', v_user_name);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_process_payout(p_request_id TEXT, p_admin_id TEXT, p_utr_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req RECORD; v_tokens_to_add INTEGER;
BEGIN
  SELECT * INTO v_req FROM payout_requests WHERE id = p_request_id::UUID FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Not found.'); END IF;
  IF v_req.status NOT IN ('pending', 'processing') THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid state.'); END IF;
  IF v_req.type = 'cash' THEN UPDATE users SET agent_commission_balance = GREATEST(0, agent_commission_balance - v_req.amount) WHERE id = v_req.user_id;
    UPDATE payout_requests SET status = 'paid', processed_at = NOW(), admin_note = COALESCE(p_utr_note, admin_note), context = COALESCE(context, '{}'::JSONB) || jsonb_build_object('processedBy', p_admin_id) WHERE id = p_request_id::UUID;
  ELSIF v_req.type = 'token_conversion' THEN v_tokens_to_add := COALESCE(v_req.tokens_credited, 0);
    UPDATE users SET agent_commission_balance = GREATEST(0, agent_commission_balance - v_req.amount), token_balance_visitor = token_balance_visitor + v_tokens_to_add WHERE id = v_req.user_id;
    UPDATE payout_requests SET status = 'paid', processed_at = NOW(), context = COALESCE(context, '{}'::JSONB) || jsonb_build_object('processedBy', p_admin_id) WHERE id = p_request_id::UUID;
  END IF;
  INSERT INTO logs ("actorId", "actorName", "actorRole", action, description, timestamp) VALUES (p_admin_id, 'Admin', 'admin', 'AGENT_PAYOUT_PROCESSED', 'Payout ' || p_request_id || ' processed.', NOW());
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_reject_payout(p_request_id TEXT, p_admin_id TEXT, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM payout_requests WHERE id = p_request_id::UUID FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Not found.'); END IF;
  IF v_req.status NOT IN ('pending', 'processing') THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid state.'); END IF;
  UPDATE payout_requests SET status = 'rejected', processed_at = NOW(), admin_note = p_reason, context = COALESCE(context, '{}'::JSONB) || jsonb_build_object('rejectedBy', p_admin_id) WHERE id = p_request_id::UUID;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_credit_agent_commission(p_agent_user_id UUID, p_commission_amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE users SET agent_commission_balance = agent_commission_balance + p_commission_amount WHERE id = p_agent_user_id; END;
$$;

-- BLOCK/UNBLOCK HARDENING
CREATE OR REPLACE FUNCTION rpc_block_visitor_premise(p_premise_id TEXT, p_visitor_id TEXT, p_block_cost INTEGER, p_actor_id TEXT, p_actor_name TEXT, p_actor_role TEXT, p_visitor_name TEXT, p_visitor_photo TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_balance INTEGER; v_new_balance INTEGER;
BEGIN
  SELECT token_balance INTO v_current_balance FROM premises WHERE id = p_premise_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Premise not found.'); END IF;
  IF v_current_balance < p_block_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE premises SET token_balance = v_current_balance - p_block_cost WHERE id = p_premise_id;
  INSERT INTO premise_blocked_visitors (id, premise_id, "blockedAt", "blockedBy", "visitorName", "visitorPhotoUrl") VALUES (p_visitor_id, p_premise_id, NOW(), p_actor_id, p_visitor_name, p_visitor_photo) ON CONFLICT (id, premise_id) DO NOTHING;
  INSERT INTO logs ("actorId", "actorName", "actorRole", action, description, "tokenChange", timestamp, context, "expiresAt") VALUES (p_actor_id, p_actor_name, p_actor_role, 'PREMISE_BLOCK_VISITOR', 'Visitor blocked.', -p_block_cost, NOW(), jsonb_build_object('premiseId', p_premise_id), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_unblock_visitor_premise(p_premise_id TEXT, p_visitor_id TEXT, p_unblock_cost INTEGER, p_actor_id TEXT, p_actor_name TEXT, p_actor_role TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_balance INTEGER;
BEGIN
  SELECT token_balance INTO v_current_balance FROM premises WHERE id = p_premise_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Premise not found.'); END IF;
  IF v_current_balance < p_unblock_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE premises SET token_balance = v_current_balance - p_unblock_cost WHERE id = p_premise_id;
  DELETE FROM premise_blocked_visitors WHERE id = p_visitor_id AND premise_id = p_premise_id;
  INSERT INTO logs ("actorId", "actorName", "actorRole", action, description, "tokenChange", timestamp, context, "expiresAt") VALUES (p_actor_id, p_actor_name, p_actor_role, 'PREMISE_UNBLOCK_VISITOR', 'Visitor unblocked.', -p_unblock_cost, NOW(), jsonb_build_object('premiseId', p_premise_id), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_block_visitor_host(p_host_id TEXT, p_visitor_id TEXT, p_block_cost INTEGER, p_actor_id TEXT, p_actor_name TEXT, p_actor_role TEXT, p_visitor_name TEXT, p_visitor_photo TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_balance INTEGER;
BEGIN
  SELECT token_balance_visitor INTO v_current_balance FROM users WHERE id = p_host_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Host not found.'); END IF;
  IF v_current_balance < p_block_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE users SET token_balance_visitor = v_current_balance - p_block_cost WHERE id = p_host_id;
  INSERT INTO host_blocked_visitors (id, host_id, "blockedAt", "blockedBy", "visitorName", "visitorPhotoUrl") VALUES (p_visitor_id, p_host_id, NOW(), p_actor_id, p_visitor_name, p_visitor_photo) ON CONFLICT (id, host_id) DO NOTHING;
  INSERT INTO logs ("actorId", "actorName", "actorRole", action, description, "tokenChange", timestamp, "expiresAt") VALUES (p_actor_id, p_actor_name, p_actor_role, 'HOST_BLOCK_VISITOR', 'Visitor blocked.', -p_block_cost, NOW(), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_unblock_visitor_host(p_host_id TEXT, p_visitor_id TEXT, p_unblock_cost INTEGER, p_actor_id TEXT, p_actor_name TEXT, p_actor_role TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_balance INTEGER;
BEGIN
  SELECT token_balance_visitor INTO v_current_balance FROM users WHERE id = p_host_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Host not found.'); END IF;
  IF v_current_balance < p_unblock_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE users SET token_balance_visitor = v_current_balance - p_unblock_cost WHERE id = p_host_id;
  DELETE FROM host_blocked_visitors WHERE id = p_visitor_id AND host_id = p_host_id;
  INSERT INTO logs ("actorId", "actorName", "actorRole", action, description, "tokenChange", timestamp, "expiresAt") VALUES (p_actor_id, p_actor_name, p_actor_role, 'HOST_UNBLOCK_VISITOR', 'Visitor unblocked.', -p_unblock_cost, NOW(), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;


-- 2. ENABLE RLS POLICIES FOR MISSION TABLES (Fix RLS Enabled No Policy info)

-- Payout Requests
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payout requests" ON public.payout_requests;
CREATE POLICY "Users can view own payout requests" ON public.payout_requests FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;
CREATE POLICY "Admins can view all payout requests" ON public.payout_requests FOR SELECT USING (public.is_admin());

-- Referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Referrers see their commission events" ON public.referrals;
CREATE POLICY "Referrers see their commission events" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
DROP POLICY IF EXISTS "Referees see their own referral link" ON public.referrals;
CREATE POLICY "Referees see their own referral link" ON public.referrals FOR SELECT USING (auth.uid() = referee_id);
DROP POLICY IF EXISTS "Admins see all referrals" ON public.referrals;
CREATE POLICY "Admins see all referrals" ON public.referrals FOR SELECT USING (public.is_admin());

-- PATCH COMPLETE
