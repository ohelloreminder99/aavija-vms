-- Adds missing RLS Write policies for geography tables so admins can modify them from the frontend.

-- States
CREATE POLICY "Allow authenticated full access to states" ON public.states 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Districts
CREATE POLICY "Allow authenticated full access to districts" ON public.districts 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Cities
CREATE POLICY "Allow authenticated full access to cities" ON public.cities 
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
