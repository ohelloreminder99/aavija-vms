-- 09-OPTIMIZE-RLS-PART2.sql
-- This script fixes the remaining 14 `auth_rls_initplan` warnings flagged by the Supabase Advisor.
-- Replaces nested `auth.uid()` and `auth.role()` calls with `(select auth.uid())` and `(select auth.role())` cache subqueries or `public.is_admin()`.

-- 1. States table
DROP POLICY IF EXISTS "Allow authenticated full access to states" ON public.states;
CREATE POLICY "Allow authenticated full access to states" ON public.states 
FOR ALL USING ((select auth.role()) = 'authenticated') WITH CHECK ((select auth.role()) = 'authenticated');

-- 2. Districts table
DROP POLICY IF EXISTS "Allow authenticated full access to districts" ON public.districts;
CREATE POLICY "Allow authenticated full access to districts" ON public.districts 
FOR ALL USING ((select auth.role()) = 'authenticated') WITH CHECK ((select auth.role()) = 'authenticated');

-- 3. Cities table
DROP POLICY IF EXISTS "Allow authenticated full access to cities" ON public.cities;
CREATE POLICY "Allow authenticated full access to cities" ON public.cities 
FOR ALL USING ((select auth.role()) = 'authenticated') WITH CHECK ((select auth.role()) = 'authenticated');

-- 4. Settings table
DROP POLICY IF EXISTS "Allow admin to update settings" ON public.settings;
CREATE POLICY "Allow admin to update settings" ON public.settings 
FOR UPDATE USING (public.is_admin());

-- 5. Agents table
DROP POLICY IF EXISTS "Admins can manage agents" ON public.agents;
CREATE POLICY "Admins can manage agents" ON public.agents 
FOR ALL USING (public.is_admin());

-- 6. Premise Categories table
DROP POLICY IF EXISTS "Admins can manage premise categories" ON public.premise_categories;
CREATE POLICY "Admins can manage premise categories" ON public.premise_categories 
FOR ALL USING (public.is_admin());

-- 7. Agent Ledger table
DROP POLICY IF EXISTS "Admins can manage agent ledger" ON public.agent_ledger;
CREATE POLICY "Admins can manage agent ledger" ON public.agent_ledger 
FOR ALL USING (public.is_admin());

-- 8. Users table
DROP POLICY IF EXISTS "Authenticated users can search users" ON public.users;
CREATE POLICY "Authenticated users can search users" ON public.users 
FOR SELECT USING ((select auth.role()) = 'authenticated');

-- 9. Contact Submissions table
DROP POLICY IF EXISTS "Admins can manage contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can manage contact submissions" ON public.contact_submissions 
FOR ALL USING (public.is_admin());

-- 10. Host Blocks table
DROP POLICY IF EXISTS "Admins can manage host blocks" ON public.host_blocks;
CREATE POLICY "Admins can manage host blocks" ON public.host_blocks 
FOR ALL USING (public.is_admin());

-- 11. Invoices table
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices" ON public.invoices 
FOR ALL USING (public.is_admin());

-- 12. Premise Blocks table
DROP POLICY IF EXISTS "Admins can manage premise blocks" ON public.premise_blocks;
CREATE POLICY "Admins can manage premise blocks" ON public.premise_blocks 
FOR ALL USING (public.is_admin());

-- 13. Ratings table
DROP POLICY IF EXISTS "Admins can manage ratings" ON public.ratings;
CREATE POLICY "Admins can manage ratings" ON public.ratings 
FOR ALL USING (public.is_admin());

-- 14. Whatsapp OTPs table
DROP POLICY IF EXISTS "Admins can manage whatsapp otps" ON public.whatsapp_otps;
CREATE POLICY "Admins can manage whatsapp otps" ON public.whatsapp_otps 
FOR ALL USING (public.is_admin());
