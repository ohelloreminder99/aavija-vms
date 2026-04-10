-- =============================================================================
-- AAVIJA VMS — COMPLETE SYSTEM SETUP, OPTIMIZATION & POLICY CONSOLIDATION (V7)
-- Target: 100% Security Advisor Score & Scalability Refactor
-- Run this in Supabase SQL Editor
-- This script is idempotent (safe to run multiple times)
-- =============================================================================

-- 1. Create premise_gates table
CREATE TABLE IF NOT EXISTS public.premise_gates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id  UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premise_gates_premise ON public.premise_gates(premise_id);

-- 2. Create premise_members table
CREATE TABLE IF NOT EXISTS public.premise_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id  UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('host', 'gatekeeper')),
  identity    TEXT, -- Unit No / Flat No (primarily for hosts)
  gate_id     UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(premise_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_premise_members_premise ON public.premise_members(premise_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_user    ON public.premise_members(user_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_role    ON public.premise_members(role);

-- 3. Optimization: Missing Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_cities_district_id ON public.cities("districtId");
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON public.cities("stateId");
CREATE INDEX IF NOT EXISTS idx_districts_state_id ON public.districts("stateId");
CREATE INDEX IF NOT EXISTS idx_premise_members_gate_id ON public.premise_members(gate_id);
CREATE INDEX IF NOT EXISTS idx_premises_agent_id ON public.premises(agent_id);
CREATE INDEX IF NOT EXISTS idx_premises_owner_id ON public.premises(owner_id);
CREATE INDEX IF NOT EXISTS idx_ratings_visitor_id ON public.ratings("visitorId");

-- 4. Data Migration Script (JSONB -> Relational)
DO $$
DECLARE
    p_rec RECORD;
    s_item JSONB;
BEGIN
    FOR p_rec IN SELECT id, staff FROM public.premises WHERE staff IS NOT NULL AND jsonb_array_length(staff) > 0 LOOP
        FOR s_item IN SELECT jsonb_array_elements(p_rec.staff) LOOP
            INSERT INTO public.premise_members (premise_id, user_id, role, identity, is_active)
            VALUES (
                p_rec.id,
                (s_item->>'uid')::UUID,
                (s_item->>'role'),
                (s_item->>'identity'),
                COALESCE((s_item->>'is_active')::BOOLEAN, true)
            )
            ON CONFLICT (premise_id, user_id, role) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 5. RPC & Function Hardening (Security & Performance)
CREATE OR REPLACE FUNCTION search_premise_members(
    premise_id_param UUID,
    role_param TEXT DEFAULT NULL,
    search_term_param TEXT DEFAULT '',
    limit_param INT DEFAULT 50,
    offset_param INT DEFAULT 0
)
RETURNS TABLE (
    id UUID, premise_id UUID, user_id UUID, role TEXT, identity TEXT, gate_id UUID,
    is_active BOOLEAN, created_at TIMESTAMPTZ, user_name TEXT, user_email TEXT, user_photo_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pm.id, pm.premise_id, pm.user_id, pm.role, pm.identity, pm.gate_id,
        pm.is_active, pm.created_at, u.name as user_name, u.email as user_email, u.photo_url as user_photo_url
    FROM premise_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.premise_id = premise_id_param
      AND (role_param IS NULL OR pm.role = role_param)
      AND (search_term_param = '' OR u.name ILIKE '%' || search_term_param || '%' OR u.email ILIKE '%' || search_term_param || '%' OR pm.identity ILIKE '%' || search_term_param || '%')
    ORDER BY pm.created_at DESC
    LIMIT limit_param OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_gatekeeper_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET gatekeeper_count = COALESCE(gatekeeper_count, 0) + 1 WHERE id = premise_id_param; END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE OR REPLACE FUNCTION decrement_gatekeeper_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET gatekeeper_count = GREATEST(0, COALESCE(gatekeeper_count, 0) - 1) WHERE id = premise_id_param; END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE OR REPLACE FUNCTION increment_host_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET host_count = COALESCE(host_count, 0) + 1 WHERE id = premise_id_param; END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE OR REPLACE FUNCTION decrement_host_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET host_count = GREATEST(0, COALESCE(host_count, 0) - 1) WHERE id = premise_id_param; END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Add gate tracking to visits table
ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS checkin_gate_id UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS checkout_gate_id UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visits_checkin_gate ON public.visits(checkin_gate_id);
CREATE INDEX IF NOT EXISTS idx_visits_checkout_gate ON public.visits(checkout_gate_id);

-- 7. CLEAN SLATE: DYNAMICALLY DROP ALL LEGACY POLICIES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('announcements', 'cities', 'districts', 'invoices', 'premise_categories', 'premise_gates', 'premise_members', 'premises', 'states')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 8. RECREATE POLICIES (Optimized & Mutually Exclusive)
-- Patterns changed from FOR ALL to specific actions to avoid "Multiple Permissive Policies" warnings.

-- [TABLE: premise_gates]
ALTER TABLE public.premise_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "premise_gates_select" ON public.premise_gates FOR SELECT USING (true);
CREATE POLICY "premise_gates_insert" ON public.premise_gates FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.premises WHERE premises.id = premise_id AND premises.owner_id = (SELECT auth.uid())));
CREATE POLICY "premise_gates_update" ON public.premise_gates FOR UPDATE USING (EXISTS (SELECT 1 FROM public.premises WHERE premises.id = premise_id AND premises.owner_id = (SELECT auth.uid())));
CREATE POLICY "premise_gates_delete" ON public.premise_gates FOR DELETE USING (EXISTS (SELECT 1 FROM public.premises WHERE premises.id = premise_id AND premises.owner_id = (SELECT auth.uid())));

-- [TABLE: premise_members]
ALTER TABLE public.premise_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "premise_members_select" ON public.premise_members FOR SELECT USING (true);
CREATE POLICY "premise_members_insert" ON public.premise_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.premises WHERE premises.id = premise_id AND premises.owner_id = (SELECT auth.uid())));
CREATE POLICY "premise_members_update" ON public.premise_members FOR UPDATE USING (EXISTS (SELECT 1 FROM public.premises WHERE premises.id = premise_id AND premises.owner_id = (SELECT auth.uid())));
CREATE POLICY "premise_members_delete" ON public.premise_members FOR DELETE USING (EXISTS (SELECT 1 FROM public.premises WHERE premises.id = premise_id AND premises.owner_id = (SELECT auth.uid())));

-- [TABLE: premises]
CREATE POLICY "premises_select" ON public.premises FOR SELECT USING (true);
CREATE POLICY "premises_insert" ON public.premises FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "premises_update" ON public.premises FOR UPDATE USING (owner_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY "premises_delete" ON public.premises FOR DELETE USING (public.is_admin());

-- [TABLE: premise_categories]
CREATE POLICY "premise_categories_select" ON public.premise_categories FOR SELECT USING (true);
CREATE POLICY "premise_categories_insert" ON public.premise_categories FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "premise_categories_update" ON public.premise_categories FOR UPDATE USING (public.is_admin());
CREATE POLICY "premise_categories_delete" ON public.premise_categories FOR DELETE USING (public.is_admin());

-- [TABLE: invoices]
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING ("userId" = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE USING (public.is_admin());
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE USING (public.is_admin());

-- [TABLE: announcements]
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE USING (public.is_admin());
CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE USING (public.is_admin());

-- [TABLE: cities]
CREATE POLICY "cities_select" ON public.cities FOR SELECT USING (true);
CREATE POLICY "cities_insert" ON public.cities FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "cities_update" ON public.cities FOR UPDATE USING (public.is_admin());
CREATE POLICY "cities_delete" ON public.cities FOR DELETE USING (public.is_admin());

-- [TABLE: districts]
CREATE POLICY "districts_select" ON public.districts FOR SELECT USING (true);
CREATE POLICY "districts_insert" ON public.districts FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "districts_update" ON public.districts FOR UPDATE USING (public.is_admin());
CREATE POLICY "districts_delete" ON public.districts FOR DELETE USING (public.is_admin());

-- [TABLE: states]
CREATE POLICY "states_select" ON public.states FOR SELECT USING (true);
CREATE POLICY "states_insert" ON public.states FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "states_update" ON public.states FOR UPDATE USING (public.is_admin());
CREATE POLICY "states_delete" ON public.states FOR DELETE USING (public.is_admin());

-- 9. GRANT ACCESS
GRANT ALL ON public.premise_gates TO service_role;
GRANT ALL ON public.premise_members TO service_role;
GRANT SELECT ON public.premise_gates TO authenticated;
GRANT SELECT ON public.premise_members TO authenticated;
GRANT ALL ON public.premise_gates TO postgres;
GRANT ALL ON public.premise_members TO postgres;
