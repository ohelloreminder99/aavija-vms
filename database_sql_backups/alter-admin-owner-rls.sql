-- Master RLS Policy Update for Admins and Owners

-- 1. Create a secure, RLS-bypassing check for the 'admin' role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'admin' FROM public.users WHERE id = auth.uid();
$$;

-- 2. Grant Admins FULL ACCESS across all critical client-facing tables
CREATE POLICY "Allow admin full access to users" ON public.users FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Allow admin full access to premises" ON public.premises FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Allow admin full access to premise_categories" ON public.premise_categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Allow admin full access to visits" ON public.visits FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Allow admin full access to logs" ON public.logs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Allow admin full access to announcements" ON public.announcements FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Allow admin full access to states" ON public.states FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Allow admin full access to districts" ON public.districts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Allow admin full access to cities" ON public.cities FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Grant Owners the ability to update their OWN premises from the Owner Dashboard
CREATE POLICY "Allow owners to update their own premises" ON public.premises FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 4. Grant Hosts the ability to read visits for their own premises
CREATE POLICY "Allow hosts to update their own visits" ON public.visits FOR UPDATE USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
