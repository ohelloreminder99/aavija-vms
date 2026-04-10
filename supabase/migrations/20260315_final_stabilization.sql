-- 20260315_final_stabilization.sql
-- Description: THE ABSOLUTE MASTER REPAIR (v5). 
-- This version resolves the type mismatch (TEXT vs UUID) and ensures case-insensitive naming synchronization.

-------------------------------------------------------------------------------
-- 0. PRE-FLIGHT: Ensure counter columns exist
-------------------------------------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premises' AND LOWER(column_name) = 'gatekeeper_count') THEN
        ALTER TABLE public.premises ADD COLUMN gatekeeper_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premises' AND LOWER(column_name) = 'gate_count') THEN
        ALTER TABLE public.premises ADD COLUMN gate_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premises' AND LOWER(column_name) = 'host_count') THEN
        ALTER TABLE public.premises ADD COLUMN host_count INTEGER DEFAULT 0;
    END IF;
END $$;

-------------------------------------------------------------------------------
-- 1. CLEANUP: Drop all existing RPC versions 
-------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_block_visitor_host(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_block_visitor_host(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_block_visitor_host(UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_unblock_visitor_host(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_unblock_visitor_host(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_unblock_visitor_host(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_block_visitor_premise(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_block_visitor_premise(UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_unblock_visitor_premise(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_unblock_visitor_premise(UUID, UUID, INTEGER, UUID, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_host_blocked_list(UUID, UUID);
DROP FUNCTION IF EXISTS public.sync_user_roles_for_all();
DROP FUNCTION IF EXISTS public.repair_all_user_premise_roles();

-------------------------------------------------------------------------------
-- 2. TABLE REPAIR: Indestructible Case-Insensitive RENAME & TYPE logic
-------------------------------------------------------------------------------
DO $$ 
DECLARE
    col_rec RECORD;
BEGIN
    -- Force Fix for host_blocked_visitors
    FOR col_rec IN (SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'host_blocked_visitors') LOOP
        -- RENAME Logic
        IF LOWER(col_rec.column_name) = 'visitorphotourl' AND col_rec.column_name != 'visitor_photo_url' THEN 
            EXECUTE 'ALTER TABLE public.host_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO visitor_photo_url';
        ELSIF LOWER(col_rec.column_name) = 'blockedat' AND col_rec.column_name != 'blocked_at' THEN 
            EXECUTE 'ALTER TABLE public.host_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO blocked_at';
        ELSIF LOWER(col_rec.column_name) = 'blockedby' AND col_rec.column_name != 'blocked_by' THEN 
            EXECUTE 'ALTER TABLE public.host_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO blocked_by';
        ELSIF LOWER(col_rec.column_name) = 'visitorname' AND col_rec.column_name != 'visitor_name' THEN 
            EXECUTE 'ALTER TABLE public.host_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO visitor_name';
        ELSIF LOWER(col_rec.column_name) = 'visitorid' AND col_rec.column_name != 'visitor_id' THEN 
            EXECUTE 'ALTER TABLE public.host_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO visitor_id';
        ELSIF LOWER(col_rec.column_name) = 'hostid' AND col_rec.column_name != 'host_id' THEN 
            EXECUTE 'ALTER TABLE public.host_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO host_id';
        ELSIF LOWER(col_rec.column_name) = 'premiseid' AND col_rec.column_name != 'premise_id' THEN 
            EXECUTE 'ALTER TABLE public.host_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO premise_id';
        END IF;
    END LOOP;

    -- TYPE CONVERSION Logic (Ensure everything is UUID)
    -- host_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'host_blocked_visitors' AND column_name = 'host_id' AND data_type = 'text') THEN
        ALTER TABLE public.host_blocked_visitors ALTER COLUMN host_id TYPE UUID USING host_id::UUID;
    END IF;
    -- visitor_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'host_blocked_visitors' AND column_name = 'visitor_id' AND data_type = 'text') THEN
        ALTER TABLE public.host_blocked_visitors ALTER COLUMN visitor_id TYPE UUID USING visitor_id::UUID;
    END IF;
    -- premise_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'host_blocked_visitors' AND column_name = 'premise_id' AND data_type = 'text') THEN
        ALTER TABLE public.host_blocked_visitors ALTER COLUMN premise_id TYPE UUID USING premise_id::UUID;
    END IF;
    -- blocked_by
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'host_blocked_visitors' AND column_name = 'blocked_by' AND data_type = 'text') THEN
        ALTER TABLE public.host_blocked_visitors ALTER COLUMN blocked_by TYPE UUID USING blocked_by::UUID;
    END IF;

    -- Repeat for premise_blocked_visitors
    FOR col_rec IN (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premise_blocked_visitors') LOOP
        IF LOWER(col_rec.column_name) = 'visitorphotourl' AND col_rec.column_name != 'visitor_photo_url' THEN 
            EXECUTE 'ALTER TABLE public.premise_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO visitor_photo_url';
        ELSIF LOWER(col_rec.column_name) = 'blockedat' AND col_rec.column_name != 'blocked_at' THEN 
            EXECUTE 'ALTER TABLE public.premise_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO blocked_at';
        ELSIF LOWER(col_rec.column_name) = 'blockedby' AND col_rec.column_name != 'blocked_by' THEN 
            EXECUTE 'ALTER TABLE public.premise_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO blocked_by';
        ELSIF LOWER(col_rec.column_name) = 'visitorname' AND col_rec.column_name != 'visitor_name' THEN 
            EXECUTE 'ALTER TABLE public.premise_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO visitor_name';
        ELSIF LOWER(col_rec.column_name) = 'visitorid' AND col_rec.column_name != 'visitor_id' THEN 
            EXECUTE 'ALTER TABLE public.premise_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO visitor_id';
        ELSIF LOWER(col_rec.column_name) = 'premiseid' AND col_rec.column_name != 'premise_id' THEN 
            EXECUTE 'ALTER TABLE public.premise_blocked_visitors RENAME COLUMN ' || quote_ident(col_rec.column_name) || ' TO premise_id';
        END IF;
    END LOOP;

    -- TYPE CONVERSION Logic for premise_blocked_visitors
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premise_blocked_visitors' AND column_name = 'premise_id' AND data_type = 'text') THEN
        ALTER TABLE public.premise_blocked_visitors ALTER COLUMN premise_id TYPE UUID USING premise_id::UUID;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premise_blocked_visitors' AND column_name = 'visitor_id' AND data_type = 'text') THEN
        ALTER TABLE public.premise_blocked_visitors ALTER COLUMN visitor_id TYPE UUID USING visitor_id::UUID;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premise_blocked_visitors' AND column_name = 'blocked_by' AND data_type = 'text') THEN
        ALTER TABLE public.premise_blocked_visitors ALTER COLUMN blocked_by TYPE UUID USING blocked_by::UUID;
    END IF;

    -- GUARANTEE: Ensure columns EXISTS at the end
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'host_blocked_visitors' AND column_name = 'visitor_photo_url') THEN ALTER TABLE public.host_blocked_visitors ADD COLUMN visitor_photo_url TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'host_blocked_visitors' AND column_name = 'blocked_at') THEN ALTER TABLE public.host_blocked_visitors ADD COLUMN blocked_at TIMESTAMPTZ DEFAULT now(); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'host_blocked_visitors' AND column_name = 'blocked_by') THEN ALTER TABLE public.host_blocked_visitors ADD COLUMN blocked_by UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premise_blocked_visitors' AND column_name = 'visitor_photo_url') THEN ALTER TABLE public.premise_blocked_visitors ADD COLUMN visitor_photo_url TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'premise_blocked_visitors' AND column_name = 'blocked_at') THEN ALTER TABLE public.premise_blocked_visitors ADD COLUMN blocked_at TIMESTAMPTZ DEFAULT now(); END IF;
END $$;

-------------------------------------------------------------------------------
-- 3. REDEFINE RPCs: Atomic Operations (All UUID & snake_case)
-------------------------------------------------------------------------------

-- 3.1 List Blocked Visitors (Host)
CREATE OR REPLACE FUNCTION public.get_host_blocked_list(p_host_id UUID, p_premise_id UUID)
RETURNS TABLE (
    id UUID, visitor_id UUID, host_id UUID, premise_id UUID, visitor_name TEXT, 
    visitor_photo_url TEXT, blocked_at TIMESTAMPTZ, blocked_by UUID
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT h.id, h.visitor_id, h.host_id, h.premise_id, h.visitor_name, h.visitor_photo_url, h.blocked_at, h.blocked_by
    FROM public.host_blocked_visitors h
    WHERE h.host_id = p_host_id AND h.premise_id = p_premise_id
    ORDER BY h.blocked_at DESC;
END;
$$;

-- 3.2 Block Visitor (Premise)
CREATE OR REPLACE FUNCTION public.rpc_block_visitor_premise(
  p_premise_id    UUID,
  p_visitor_id    UUID,
  p_block_cost    INTEGER,
  p_actor_id      UUID,
  p_actor_name    TEXT,
  p_actor_role    TEXT,
  p_visitor_name  TEXT,
  p_visitor_photo TEXT,
  p_expires_at    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  SELECT token_balance INTO v_current_balance FROM public.premises WHERE id = p_premise_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Premise not found.'); END IF;
  IF v_current_balance < p_block_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE public.premises SET token_balance = v_current_balance - p_block_cost WHERE id = p_premise_id;
  INSERT INTO public.premise_blocked_visitors (visitor_id, premise_id, visitor_name, visitor_photo_url, blocked_at, blocked_by)
  VALUES (p_visitor_id, p_premise_id, p_visitor_name, p_visitor_photo, NOW(), p_actor_id)
  ON CONFLICT (visitor_id, premise_id) DO UPDATE SET visitor_photo_url = p_visitor_photo, blocked_at = NOW();
  INSERT INTO public.logs ("actorId", "actorName", "actorRole", action, description, "tokenChange", timestamp, context, "expiresAt")
  VALUES (p_actor_id, p_actor_name, p_actor_role, 'PREMISE_BLOCK_VISITOR', 'Blocked visitor ' || p_visitor_name, -p_block_cost, NOW(), jsonb_build_object('premiseId', p_premise_id), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3.3 Block Visitor (Host)
CREATE OR REPLACE FUNCTION public.rpc_block_visitor_host(
  p_host_id       UUID,
  p_visitor_id    UUID,
  p_block_cost    INTEGER,
  p_actor_id      UUID,
  p_actor_name    TEXT,
  p_actor_role    TEXT,
  p_visitor_name  TEXT,
  p_visitor_photo TEXT,
  p_premise_id    UUID,
  p_expires_at    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  SELECT token_balance_visitor INTO v_current_balance FROM public.users WHERE id = p_host_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Host profile not found.'); END IF;
  IF v_current_balance < p_block_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE public.users SET token_balance_visitor = v_current_balance - p_block_cost WHERE id = p_host_id;
  INSERT INTO public.host_blocked_visitors (visitor_id, host_id, premise_id, visitor_name, visitor_photo_url, blocked_at, blocked_by)
  VALUES (p_visitor_id, p_host_id, p_premise_id, p_visitor_name, p_visitor_photo, NOW(), p_actor_id)
  ON CONFLICT (visitor_id, host_id, premise_id) DO UPDATE SET visitor_photo_url = p_visitor_photo, blocked_at = NOW();
  INSERT INTO public.logs ("actorId", "actorName", "actorRole", action, description, "tokenChange", timestamp, context, "expiresAt")
  VALUES (p_actor_id, p_actor_name, p_actor_role, 'HOST_BLOCK_VISITOR', 'Blocked visitor ' || p_visitor_name, -p_block_cost, NOW(), jsonb_build_object('premiseId', p_premise_id), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;

-------------------------------------------------------------------------------
-- 4. SIDEBAR & COUNTERS Integration
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_premise_roles_manual(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE role_map JSONB;
BEGIN
    SELECT jsonb_object_agg(p_id, roles) INTO role_map FROM (
        SELECT p_id, jsonb_agg(DISTINCT role) as roles FROM (
            SELECT premise_id as p_id, role FROM public.premise_members WHERE user_id = p_user_id
            UNION
            SELECT id as p_id, 'owner' as role FROM public.premises WHERE owner_id = p_user_id
        ) combined GROUP BY p_id
    ) t;
    UPDATE public.users SET premise_roles = COALESCE(role_map, '{}'::jsonb) WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_premise_counters() 
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.premises p SET 
        gatekeeper_count = (SELECT count(*) FROM public.premise_members pm WHERE pm.premise_id = p.id AND pm.role = 'gatekeeper'),
        gate_count = (SELECT count(*) FROM public.premise_gates pg WHERE pg.premise_id = p.id),
        host_count = (SELECT count(*) FROM public.premise_members pm WHERE pm.premise_id = p.id AND pm.role = 'host')
    WHERE p.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_repair_stabilization()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u_id UUID;
BEGIN
    PERFORM public.repair_premise_counters();
    FOR u_id IN SELECT id FROM public.users LOOP PERFORM public.sync_user_premise_roles_manual(u_id); END LOOP;
END;
$$;

-- GO
SELECT public.master_repair_stabilization();
