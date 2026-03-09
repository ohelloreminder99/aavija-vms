-- =========================================================================================
-- SECURITY ADVISOR FIX: RLS Enabled but NO Policies
-- =========================================================================================
-- This script safely resolves the Supabase Security Advisor warnings for tables
-- that have Row-Level Security (RLS) enabled but lack explicit access policies.
-- 
-- Since these tables are managed natively from the backend (via the Service Role key 
-- which bypasses RLS), no explicit public client-side policies are strictly needed. 
-- However, creating an explicit "Admin-Only" policy keeps the Security Advisor happy 
-- and solidifies your security posture.

DO $$ 
BEGIN
    -- 1. Contact Submissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_submissions' AND policyname = 'Admins can manage contact submissions') THEN
        CREATE POLICY "Admins can manage contact submissions" ON public.contact_submissions
        FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
    END IF;

    -- 2. Host Blocks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'host_blocks' AND policyname = 'Admins can manage host blocks') THEN
        CREATE POLICY "Admins can manage host blocks" ON public.host_blocks
        FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
    END IF;

    -- 3. Invoices
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Admins can manage invoices') THEN
        CREATE POLICY "Admins can manage invoices" ON public.invoices
        FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
    END IF;

    -- 4. Premise Blocks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'premise_blocks' AND policyname = 'Admins can manage premise blocks') THEN
        CREATE POLICY "Admins can manage premise blocks" ON public.premise_blocks
        FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
    END IF;

    -- 5. Ratings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ratings' AND policyname = 'Admins can manage ratings') THEN
        CREATE POLICY "Admins can manage ratings" ON public.ratings
        FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
    END IF;

    -- 6. WhatsApp OTPs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_otps' AND policyname = 'Admins can manage whatsapp otps') THEN
        CREATE POLICY "Admins can manage whatsapp otps" ON public.whatsapp_otps
        FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
    END IF;

END $$;
