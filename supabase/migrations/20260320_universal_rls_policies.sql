-- Migration: 20260320_universal_rls_policies.sql
-- Description: Enforces Row-Level Security on ALL public tables and defines secure access policies.
-- Design Principle: DENY by default, granularly PERMIT by role and ownership.

-- 1. Helper Function for Admin Check (Cached for performance within transaction)
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. Enable RLS on ALL identified tables (Idempotent)
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('spatial_ref_sys') -- exclude PostGIS if exists
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 3. DROP LEGACY POLICIES for Clean Slate (on core tables)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 4. DEFINE NEW ROBUST POLICIES

-- === [TABLE: users] ===
CREATE POLICY "users_select" ON public.users FOR SELECT USING (id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (id = (SELECT auth.uid()) OR is_admin());

-- === [TABLE: premises] ===
CREATE POLICY "premises_select" ON public.premises FOR SELECT USING (true);
CREATE POLICY "premises_insert" ON public.premises FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "premises_update" ON public.premises FOR UPDATE USING (is_admin() OR owner_id = (SELECT auth.uid()));
CREATE POLICY "premises_delete" ON public.premises FOR DELETE USING (is_admin());

-- === [TABLE: visits] ===
CREATE POLICY "visits_select" ON public.visits FOR SELECT 
USING (
  is_admin() OR 
  visitor_id = (SELECT auth.uid()) OR 
  host_id = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM public.premise_members WHERE user_id = (SELECT auth.uid()) AND premise_id = visits.premise_id AND role = 'gatekeeper') OR
  EXISTS (SELECT 1 FROM public.premises WHERE id = visits.premise_id AND owner_id = (SELECT auth.uid()))
);
CREATE POLICY "visits_insert" ON public.visits FOR INSERT WITH CHECK (
  is_admin() OR
  EXISTS (SELECT 1 FROM public.premise_members WHERE user_id = (SELECT auth.uid()) AND premise_id = visits.premise_id AND role = 'gatekeeper')
);
CREATE POLICY "visits_update" ON public.visits FOR UPDATE USING (
  is_admin() OR
  EXISTS (SELECT 1 FROM public.premise_members WHERE user_id = (SELECT auth.uid()) AND premise_id = visits.premise_id AND role = 'gatekeeper')
);
CREATE POLICY "visits_delete" ON public.visits FOR DELETE USING (is_admin());

-- === [TABLE: logs] ===
CREATE POLICY "logs_select" ON public.logs FOR SELECT USING (is_admin() OR "actorId" = (SELECT auth.uid()));
-- Note: Insert is handled by service role.

-- === [TABLE: settings] ===
CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_insert" ON public.settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "settings_admin_update" ON public.settings FOR UPDATE USING (is_admin());
CREATE POLICY "settings_admin_delete" ON public.settings FOR DELETE USING (is_admin());

-- === [TABLE: ratings] ===
CREATE POLICY "ratings_select" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert" ON public.ratings FOR INSERT WITH CHECK ("visitorId" = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "ratings_update" ON public.ratings FOR UPDATE USING ("visitorId" = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "ratings_delete" ON public.ratings FOR DELETE USING ("visitorId" = (SELECT auth.uid()) OR is_admin());

-- === [TABLE: premise_blocked_visitors] ===
CREATE POLICY "premise_blocks_access" ON public.premise_blocked_visitors FOR ALL
USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));

-- === [TABLE: host_blocked_visitors] ===
CREATE POLICY "host_blocks_access" ON public.host_blocked_visitors FOR ALL 
  USING (host_id = (SELECT auth.uid()) OR is_admin());

-- === [TABLE: referrals] ===
CREATE POLICY "referrals_select" ON public.referrals FOR SELECT 
  USING (referrer_id = (SELECT auth.uid()) OR referee_id = (SELECT auth.uid()) OR is_admin());

-- === [TABLE: payout_requests] ===
CREATE POLICY "payouts_select" ON public.payout_requests FOR SELECT USING (user_id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "payouts_insert" ON public.payout_requests FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- === [TABLE: static data] ===
CREATE POLICY "static_read_cities" ON public.cities FOR SELECT USING (true);
CREATE POLICY "static_read_districts" ON public.districts FOR SELECT USING (true);
CREATE POLICY "static_read_states" ON public.states FOR SELECT USING (true);
CREATE POLICY "static_read_cats" ON public.premise_categories FOR SELECT USING (true);

-- === [TABLE: agents] ===
CREATE POLICY "agents_select" ON public.agents FOR SELECT USING (is_admin() OR id = (SELECT auth.uid()));
CREATE POLICY "agents_admin_insert" ON public.agents FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "agents_admin_update" ON public.agents FOR UPDATE USING (is_admin());
CREATE POLICY "agents_admin_delete" ON public.agents FOR DELETE USING (is_admin());

-- === [TABLE: agent_ledger] ===
CREATE POLICY "agent_ledger_select" ON public.agent_ledger FOR SELECT USING (is_admin() OR agent_id = (SELECT auth.uid()));
CREATE POLICY "agent_ledger_admin_insert" ON public.agent_ledger FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "agent_ledger_admin_update" ON public.agent_ledger FOR UPDATE USING (is_admin());
CREATE POLICY "agent_ledger_admin_delete" ON public.agent_ledger FOR DELETE USING (is_admin());

-- === [TABLE: announcements] ===
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements_admin_insert" ON public.announcements FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "announcements_admin_update" ON public.announcements FOR UPDATE USING (is_admin());
CREATE POLICY "announcements_admin_delete" ON public.announcements FOR DELETE USING (is_admin());

-- === [TABLE: checkin_tokens] ===
CREATE POLICY "tokens_select" ON public.checkin_tokens FOR SELECT USING (true);
CREATE POLICY "tokens_admin_insert" ON public.checkin_tokens FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "tokens_admin_update" ON public.checkin_tokens FOR UPDATE USING (is_admin());
CREATE POLICY "tokens_admin_delete" ON public.checkin_tokens FOR DELETE USING (is_admin());

-- === [TABLE: contact_submissions] ===
CREATE POLICY "contact_admin_access" ON public.contact_submissions FOR ALL USING (is_admin());

-- === [TABLE: premise_gates] ===
CREATE POLICY "gates_select" ON public.premise_gates FOR SELECT USING (true);
CREATE POLICY "gates_insert" ON public.premise_gates FOR INSERT WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));
CREATE POLICY "gates_update" ON public.premise_gates FOR UPDATE USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));
CREATE POLICY "gates_delete" ON public.premise_gates FOR DELETE USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));

-- === [TABLE: premise_members] ===
CREATE POLICY "members_select" ON public.premise_members FOR SELECT USING (true);
CREATE POLICY "members_insert" ON public.premise_members FOR INSERT WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));
CREATE POLICY "members_update" ON public.premise_members FOR UPDATE USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));
CREATE POLICY "members_delete" ON public.premise_members FOR DELETE USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));

-- === [TABLE: rate_limits] ===
CREATE POLICY "rate_limits_admin" ON public.rate_limits FOR ALL USING (is_admin());

-- === [TABLE: regions] ===
CREATE POLICY "regions_select" ON public.regions FOR SELECT USING (true);
CREATE POLICY "regions_admin_insert" ON public.regions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "regions_admin_update" ON public.regions FOR UPDATE USING (is_admin());
CREATE POLICY "regions_admin_delete" ON public.regions FOR DELETE USING (is_admin());

-- === [TABLE: whatsapp_otps] ===
CREATE POLICY "whatsapp_otps_admin" ON public.whatsapp_otps FOR ALL USING (is_admin());

-- === [TABLE: invoices] ===
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING ("userId" = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "invoices_admin_insert" ON public.invoices FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "invoices_admin_update" ON public.invoices FOR UPDATE USING (is_admin());
CREATE POLICY "invoices_admin_delete" ON public.invoices FOR DELETE USING (is_admin());
