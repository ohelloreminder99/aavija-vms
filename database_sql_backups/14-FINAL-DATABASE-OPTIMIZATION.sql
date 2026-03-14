-- =============================================================================
-- AAVIJA VMS — Phase 3: Final Database Optimization & Security Hardening
-- Author: Antigravity (Google DeepMind)
-- Date: 2026-03-14
-- Purpose: 
--   1. Fix "Unindexed Foreign Keys" (Performance)
--   2. Remove "Unused Indexes" (Performance)
--   3. Resolve "Auth RLS Initialization Plan" (Performance/Subqueries)
--   4. Consolidate "Multiple Permissive Policies" (Security/Performance)
-- =============================================================================

-- =============================================================================
-- SECTION 1: ADD MISSING FOREIGN KEY INDEXES
-- =============================================================================

-- Invoices table needs indexes on userId and premiseId for fast joins/deletes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices("userId");
CREATE INDEX IF NOT EXISTS idx_invoices_premise_id ON public.invoices("premiseId");

-- Users table needs index on referred_by for fast referral chain lookups
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users("referred_by");

-- =============================================================================
-- SECTION 2: REMOVE UNUSED INDEXES (Cleanup)
-- =============================================================================

DROP INDEX IF EXISTS public.idx_districts_state_id;
DROP INDEX IF EXISTS public.idx_cities_state_id;
DROP INDEX IF EXISTS public.idx_cities_district_id;
DROP INDEX IF EXISTS public.idx_premises_owner_id;
DROP INDEX IF EXISTS public.idx_premises_agent_id;
DROP INDEX IF EXISTS public.idx_payout_requests_status;
DROP INDEX IF EXISTS public.idx_ratings_visitor_id;

-- =============================================================================
-- SECTION 3: RLS PERFORMANCE OPTIMIZATION (Subqueries) & SECURITY HARDENING
-- Replaces multiple permissive policies with consolidated, role-based checks.
-- USES (SELECT auth.uid()) and (SELECT auth.role()) for query plan caching.
-- =============================================================================

-- Helper functions are already secured with SECURITY DEFINER and (SELECT auth.uid()) in 08-OPTIMIZE-RLS.sql
-- We will use public.is_admin() and direct ID checks here.

-- 3.1: USERS TABLE
DROP POLICY IF EXISTS "Allow public select" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can search users" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Allow admin full access to users" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;

CREATE POLICY "Users policy" ON public.users
FOR SELECT USING (
    id = (SELECT auth.uid()) OR 
    (SELECT auth.role()) = 'authenticated' OR
    public.is_admin()
);

-- 3.2: INVOICES TABLE
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;

CREATE POLICY "Invoices select policy" ON public.invoices
FOR SELECT USING (
    "userId" = (SELECT auth.uid()) OR public.is_admin()
);

CREATE POLICY "Invoices admin policy" ON public.invoices
FOR ALL TO authenticated USING (public.is_admin());

-- 3.3: PAYOUT REQUESTS TABLE
DROP POLICY IF EXISTS "Users can view own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;

CREATE POLICY "Payout requests select policy" ON public.payout_requests
FOR SELECT USING (
    user_id = (SELECT auth.uid()) OR public.is_admin()
);

-- 3.4: VISITS TABLE
DROP POLICY IF EXISTS "Visitors read own visits" ON public.visits;
DROP POLICY IF EXISTS "Hosts read hosted visits" ON public.visits;
DROP POLICY IF EXISTS "Admins read all visits" ON public.visits;
DROP POLICY IF EXISTS "Allow admin full access to visits" ON public.visits;
DROP POLICY IF EXISTS "Premise staff read premise visits" ON public.visits;

CREATE POLICY "Visits select policy" ON public.visits
FOR SELECT USING (
    visitor_id = (SELECT auth.uid()) OR 
    host_id = (SELECT auth.uid()) OR 
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.premises p WHERE p.id = premise_id AND (p.owner_id = (SELECT auth.uid()) OR p.agent_id = (SELECT auth.uid())))
);

-- 3.5: LOGS TABLE
DROP POLICY IF EXISTS "Users read own logs" ON public.logs;
DROP POLICY IF EXISTS "Admins read all logs" ON public.logs;
DROP POLICY IF EXISTS "Allow admin full access to logs" ON public.logs;
DROP POLICY IF EXISTS "Owners read premise logs" ON public.logs;

CREATE POLICY "Logs select policy" ON public.logs
FOR SELECT USING (
    "actorId" = (SELECT auth.uid()) OR 
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.premises p WHERE p.id = "premiseId" AND p.owner_id = (SELECT auth.uid()))
);

-- 3.6: REFERRALS TABLE
DROP POLICY IF EXISTS "Referrers see their commission events" ON public.referrals;
DROP POLICY IF EXISTS "Referees see their own referral link" ON public.referrals;
DROP POLICY IF EXISTS "Admins see all referrals" ON public.referrals;

CREATE POLICY "Referrals select policy" ON public.referrals
FOR SELECT USING (
    referrer_id = (SELECT auth.uid()) OR 
    referee_id = (SELECT auth.uid()) OR 
    public.is_admin()
);

-- 3.7: CHECKIN TOKENS TABLE
DROP POLICY IF EXISTS "Visitors read own checkin tokens" ON public.checkin_tokens;
DROP POLICY IF EXISTS "Admins read all checkin tokens" ON public.checkin_tokens;
DROP POLICY IF EXISTS "Premise staff read premise tokens" ON public.checkin_tokens;

CREATE POLICY "Checkin tokens select policy" ON public.checkin_tokens
FOR SELECT USING (
    visitor_id = (SELECT auth.uid()) OR 
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.premises p WHERE p.id = premise_id AND (p.owner_id = (SELECT auth.uid()) OR p.agent_id = (SELECT auth.uid())))
);

-- =============================================================================
-- SECTION 4: LOCATION DATA OPTIMIZATION (States, Districts, Cities)
-- =============================================================================

-- States
DROP POLICY IF EXISTS "Allow public select" ON public.states;
DROP POLICY IF EXISTS "Allow admin full access to states" ON public.states;
DROP POLICY IF EXISTS "Allow authenticated full access to states" ON public.states;
CREATE POLICY "States public select" ON public.states FOR SELECT USING (true);
CREATE POLICY "States admin all" ON public.states FOR ALL USING (public.is_admin());

-- Districts
DROP POLICY IF EXISTS "Allow public select" ON public.districts;
DROP POLICY IF EXISTS "Allow admin full access to districts" ON public.districts;
DROP POLICY IF EXISTS "Allow authenticated full access to districts" ON public.districts;
CREATE POLICY "Districts public select" ON public.districts FOR SELECT USING (true);
CREATE POLICY "Districts admin all" ON public.districts FOR ALL USING (public.is_admin());

-- Cities
DROP POLICY IF EXISTS "Allow public select" ON public.cities;
DROP POLICY IF EXISTS "Allow admin full access to cities" ON public.cities;
DROP POLICY IF EXISTS "Allow authenticated full access to cities" ON public.cities;
CREATE POLICY "Cities public select" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Cities admin all" ON public.cities FOR ALL USING (public.is_admin());

-- Announcements
DROP POLICY IF EXISTS "Allow public select" ON public.announcements;
DROP POLICY IF EXISTS "Allow admin full access to announcements" ON public.announcements;
CREATE POLICY "Announcements public select" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Announcements admin all" ON public.announcements FOR ALL USING (public.is_admin());

-- =============================================================================
-- FINAL NOTES:
-- 1. All (select auth.uid()) patterns facilitate Postgres plan caching.
-- 2. Consolidating into fewer policies reduces the overhead of policy checks.
-- 3. public.is_admin() is a security definer function, which is fast and safe.
-- =============================================================================
