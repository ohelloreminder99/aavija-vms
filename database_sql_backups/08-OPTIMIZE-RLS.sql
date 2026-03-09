-- PERFORMANCE OPTIMIZATION SCRIPT (08-OPTIMIZE-RLS.sql)
-- Resolves Supabase "Auth RLS Initialization Plan" Warnings (Linter 0003_auth_rls_initplan)
-- The issue: Calling auth.uid() directly in policies causes Postgres to evaluate the function for EVERY single row.
-- The fix: Wrapping it in (SELECT auth.uid()) forces Postgres to evaluate it ONCE per query and cache the constant.

-- 1. OPTIMIZE SECURITY DEFINER HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (select auth.uid()) AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_owner(premise_uuid UUID) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (select auth.uid()) AND premise_id = premise_uuid AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_host(premise_uuid UUID) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (select auth.uid()) AND premise_id = premise_uuid AND role = 'host'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_gatekeeper(premise_uuid UUID) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (select auth.uid()) AND premise_id = premise_uuid AND role = 'gatekeeper'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. OPTIMIZE DIRECT TABLE POLICIES

-- Users Table
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING ( id = (select auth.uid()) );

DROP POLICY IF EXISTS "Allow users to update own profile" ON users;
CREATE POLICY "Allow users to update own profile" ON users FOR UPDATE USING ( id = (select auth.uid()) );

-- Visits Table
DROP POLICY IF EXISTS "Visitors read own visits" ON visits;
CREATE POLICY "Visitors read own visits" ON visits FOR SELECT USING ( visitor_id = (select auth.uid()) );

DROP POLICY IF EXISTS "Hosts read hosted visits" ON visits;
CREATE POLICY "Hosts read hosted visits" ON visits FOR SELECT USING ( host_id = (select auth.uid()) );

DROP POLICY IF EXISTS "Allow hosts to update their own visits" ON visits;
CREATE POLICY "Allow hosts to update their own visits" ON visits FOR UPDATE USING ( host_id = (select auth.uid()) );

-- Logs Table
DROP POLICY IF EXISTS "Users read own logs" ON logs;
CREATE POLICY "Users read own logs" ON logs FOR SELECT USING ( "actorId" = (select auth.uid()) );

-- Check-in Tokens Table
DROP POLICY IF EXISTS "Visitors read own checkin tokens" ON checkin_tokens;
CREATE POLICY "Visitors read own checkin tokens" ON checkin_tokens FOR SELECT USING ( visitor_id = (select auth.uid()) );

-- Premises Table
DROP POLICY IF EXISTS "Allow owners to update their own premises" ON premises;
CREATE POLICY "Allow owners to update their own premises" ON premises FOR UPDATE USING ( is_owner(id) );
