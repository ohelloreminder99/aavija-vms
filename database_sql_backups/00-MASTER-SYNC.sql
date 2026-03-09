-- supabase-schema.sql
-- Copy and paste this entire script into your Supabase SQL Editor and run it.

-- 1. ENABLE UUID EXTENSION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE TABLES

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY, -- Matches Supabase Auth ID
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'visitor',
  phone TEXT,
  "countryCode" TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  token_balance_visitor INTEGER DEFAULT 0,
  global_rating NUMERIC DEFAULT 5.0,
  active_checkin_id UUID,
  photo_url TEXT,
  city TEXT,
  "cityId" TEXT,
  city_state TEXT,
  "companyName" TEXT,
  premise_roles JSONB,
  vehicles JSONB,
  selected_vehicle_number TEXT,
  products JSONB,
  "gstNumber" TEXT,
  "billingAddress" TEXT,
  "legalName" TEXT,
  "billingState" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.premises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  "cityId" TEXT,
  city_state TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  "ownerName" TEXT,
  token_balance INTEGER DEFAULT 0,
  agent_id UUID REFERENCES public.users(id),
  "categoryId" UUID,
  "categoryName" TEXT,
  host_count INTEGER DEFAULT 0,
  gatekeeper_count INTEGER DEFAULT 0,
  staff JSONB,
  "gstNumber" TEXT,
  "billingAddress" TEXT,
  "legalName" TEXT,
  "billingState" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.premise_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID REFERENCES public.users(id),
  visitor_name TEXT,
  host_id UUID REFERENCES public.users(id),
  host_name TEXT,
  premise_id UUID REFERENCES public.premises(id),
  checkin_time TIMESTAMPTZ DEFAULT NOW(),
  checkout_time TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  vehicle_details JSONB,
  visitor_snapshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "actorId" UUID,
  "actorName" TEXT,
  "actorRole" TEXT,
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ,
  description TEXT,
  "tokenChange" INTEGER,
  "premiseId" UUID REFERENCES public.premises(id),
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.checkin_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID REFERENCES public.users(id),
  visitor_name TEXT,
  host_id UUID REFERENCES public.users(id),
  premise_id UUID REFERENCES public.premises(id),
  status TEXT DEFAULT 'unused',
  "expiresAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_ledger_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "agentId" UUID REFERENCES public.users(id),
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "premiseId" UUID REFERENCES public.premises(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  "targetAudience" JSONB,
  "authorId" UUID REFERENCES public.users(id),
  "authorName" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "isPublished" BOOLEAN DEFAULT TRUE,
  priority TEXT DEFAULT 'normal'
);

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  log_ttl_days INTEGER DEFAULT 30,
  history_days_admin INTEGER DEFAULT 30,
  history_days_owner INTEGER DEFAULT 30,
  history_days_host INTEGER DEFAULT 7,
  history_days_gatekeeper INTEGER DEFAULT 1,
  agent_commission_percent NUMERIC DEFAULT 10,
  checkin_cost INTEGER DEFAULT 1,
  whatsapp_notification_cost INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.districts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  "stateName" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  "districtName" TEXT NOT NULL,
  "stateName" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID REFERENCES public.users(id),
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  "gstAmount" NUMERIC,
  "totalAmount" NUMERIC,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "paidAt" TIMESTAMPTZ,
  "pdfUrl" TEXT
);

CREATE TABLE IF NOT EXISTS public.premise_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "premiseId" UUID REFERENCES public.premises(id),
  "visitorId" UUID REFERENCES public.users(id),
  "visitorName" TEXT,
  reason TEXT,
  "blockedBy" UUID REFERENCES public.users(id),
  "blockedByName" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.host_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "hostId" UUID REFERENCES public.users(id),
  "visitorId" UUID REFERENCES public.users(id),
  "visitorName" TEXT,
  reason TEXT,
  "blockedBy" UUID REFERENCES public.users(id),
  "blockedByName" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "visitId" UUID REFERENCES public.visits(id),
  "visitorId" UUID REFERENCES public.users(id),
  "hostId" UUID REFERENCES public.users(id),
  "premiseId" UUID REFERENCES public.premises(id),
  rating INTEGER NOT NULL,
  feedback TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- INITIAL SEED DATA
INSERT INTO public.settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- 3. STORAGE BUCKETS
-- (Ensure you have run this in the Supabase SQL editor as a Superuser)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('visitor-snapshots', 'visitor-snapshots', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('premises', 'premises', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('bills', 'bills', true) ON CONFLICT DO NOTHING;


-- 4. ROW LEVEL SECURITY (RLS)
-- To get the app working seamlessly just like Firebase (where we used Server Actions for writes and Client calls for reads),
-- we will allow public/authenticated users to SELECT data, but restrict INSERT/UPDATE/DELETE. Server Actions automatically bypass RLS.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premise_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for everyone (Client queries need to read data)
CREATE POLICY "Allow public select" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.premises FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.premise_categories FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.visits FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.logs FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.checkin_tokens FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.agent_ledger_entries FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.states FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.districts FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.cities FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Allow users to update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Allow public storage access
CREATE POLICY "Allow public avatars read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Allow public snapshots read" ON storage.objects FOR SELECT USING (bucket_id = 'visitor-snapshots');
CREATE POLICY "Allow public premises read" ON storage.objects FOR SELECT USING (bucket_id = 'premises');


-- 5. TTL STRATEGY (pg_cron)
-- This creates a cron job that runs every day at midnight to delete logs/visits past their "expiresAt" time.
-- Note: 'pg_cron' needs to be enabled in Supabase Database Extensions first!

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'delete-expired-logs', 
  '0 0 * * *', -- Run at Midnight every day
  $$ DELETE FROM public.logs WHERE "expiresAt" < NOW(); $$
);

SELECT cron.schedule(
  'delete-expired-checkin-tokens', 
  '0 0 * * *', 
  $$ DELETE FROM public.checkin_tokens WHERE "expiresAt" < NOW(); $$
);
-- create-agent-ledger-table.sql
-- Creates the agent_ledger table that precisely matches the application's data requirements.
-- This replaces the outdated agent_ledger_entries schema.

CREATE TABLE IF NOT EXISTS public.agent_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    description TEXT,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_ledger ENABLE ROW LEVEL SECURITY;

-- Allow Admins full access to read and write agent_ledger
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'agent_ledger' 
        AND policyname = 'Admins can manage agent ledger'
    ) THEN
        CREATE POLICY "Admins can manage agent ledger" ON public.agent_ledger
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Drop the outdated, unused table to prevent future confusion
DROP TABLE IF EXISTS public.agent_ledger_entries CASCADE;
-- Patch to create the missing agents table
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    commission_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Allow Admins full access to read and write agents
CREATE POLICY "Admins can manage agents" ON public.agents
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Note: Depending on your business logic, you might want to allow 
-- premises to read agent details if they are linked to an agent. 
-- For now, we restrict this strictly to admins.
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
-- Adds missing relational ID columns to the geography tables so the UI can properly link and filter them.

ALTER TABLE public.districts
ADD COLUMN IF NOT EXISTS "stateId" UUID REFERENCES public.states(id) ON DELETE CASCADE;

ALTER TABLE public.cities
ADD COLUMN IF NOT EXISTS "districtId" UUID REFERENCES public.districts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS "stateId" UUID REFERENCES public.states(id) ON DELETE CASCADE;
-- Adds missing configuration columns to the `settings` table to support all the NoSQL token, history, and billing options.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS hide_token_economy BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS starting_token_visitor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS starting_token_owner NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_token_threshold NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS history_days_staff NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS history_days_visitor NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS export_history_days_owner NUMERIC DEFAULT 30,
ADD COLUMN IF NOT EXISTS export_history_days_host NUMERIC DEFAULT 7,
ADD COLUMN IF NOT EXISTS export_history_days_visitor NUMERIC DEFAULT 7,
ADD COLUMN IF NOT EXISTS pdf_export_cost_host NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS csv_export_cost_host NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS pdf_export_cost_visitor NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS csv_export_cost_visitor NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS mobile_verification_cost NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS star_rating_cost NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS block_visitor_cost NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS unblock_visitor_cost NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS block_visitor_cost_host NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS unblock_visitor_cost_host NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS show_token_card_visitor BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS visit_ttl_days NUMERIC DEFAULT 30,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS token_exchange_rate NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC DEFAULT 18,
ADD COLUMN IF NOT EXISTS agent_commission_rate NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS default_country_code TEXT DEFAULT '+91',
ADD COLUMN IF NOT EXISTS phone_number_length NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS allow_unverified_checkin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS otp_request_limit_hourly NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS company_gstin TEXT,
ADD COLUMN IF NOT EXISTS company_name_billing TEXT,
ADD COLUMN IF NOT EXISTS company_address_billing TEXT,
ADD COLUMN IF NOT EXISTS company_state_billing TEXT,
ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT,
ADD COLUMN IF NOT EXISTS cgst_rate_default NUMERIC DEFAULT 9,
ADD COLUMN IF NOT EXISTS sgst_rate_default NUMERIC DEFAULT 9,
ADD COLUMN IF NOT EXISTS igst_rate_default NUMERIC DEFAULT 18;

-- Add RLS Policy to allow admins to actually modify settings!
CREATE POLICY "Allow admin to update settings" ON public.settings
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
-- Adds the missing table used by the Visitor Profile actions to verify WhatsApp numbers.

CREATE TABLE IF NOT EXISTS public.whatsapp_otps (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  otp TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Because OTPs are deeply sensitive and only used during server-side verification actions (in src/app/dashboard/visitor/profile/actions.ts),
-- we DO NOT create any public or authenticated RLS access policies for this table. 
-- The Server Actions already use the Admin DB to safely read/write to it. This keeps the OTPs perfectly secure from frontend scraping!
-- Patch to redirect the foreign key constraint for agent_id
-- The premises table originally referenced public.users(id), but we moved agents to public.agents.

ALTER TABLE public.premises
DROP CONSTRAINT IF EXISTS premises_agent_id_fkey;

ALTER TABLE public.premises
ADD CONSTRAINT premises_agent_id_fkey
FOREIGN KEY (agent_id) REFERENCES public.agents(id)
ON DELETE SET NULL;
-- Patch to fix the premise_categories schema to accept pricing columns
-- The original migration script created the table but forgot to add the financial fields.

ALTER TABLE public.premise_categories
ADD COLUMN IF NOT EXISTS deduction_rate_visitor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deduction_rate_premise NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pdf_export_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS csv_export_cost NUMERIC DEFAULT 0;

-- Ensure RLS is enabled and admins can manage it
ALTER TABLE public.premise_categories ENABLE ROW LEVEL SECURITY;

-- If it doesn't exist, allow Admins to manage categories
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'premise_categories' 
        AND policyname = 'Admins can manage premise categories'
    ) THEN
        CREATE POLICY "Admins can manage premise categories" ON public.premise_categories
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;
-- fix-invoices-timestamp.sql
-- This script safely adds a 'created_at' timestamp column to the invoices table 
-- if it was accidentally omitted during the initial table creation.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.invoices 
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;
-- Run this snippet in your Supabase SQL Editor to add the missing roles_admin table

CREATE TABLE IF NOT EXISTS public.roles_admin (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  "isAdmin" BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.roles_admin ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (to check if they are an admin)
CREATE POLICY "Allow public select on roles_admin" ON public.roles_admin FOR SELECT USING (true);

-- Allow insertions (since your auth form automatically adds the user to roles_admin if emails match)
CREATE POLICY "Allow insertions to roles_admin" ON public.roles_admin FOR INSERT WITH CHECK (true);
-- Run this in the Supabase SQL Editor to manually make a user an admin.
-- Replace 'user@example.com' with the email of the person you want to make an admin.

DO $$ 
DECLARE
  target_email TEXT := 'samir.samnani.ai@gmail.com'; -- <--- CHANGE THIS EMAIL
  target_user_id UUID;
BEGIN
  -- Find the user ID based on email
  SELECT id INTO target_user_id FROM public.users WHERE email = target_email;

  IF target_user_id IS NOT NULL THEN
    -- Update the user's role to admin
    UPDATE public.users SET role = 'admin' WHERE id = target_user_id;

    -- Add them to the roles_admin table
    INSERT INTO public.roles_admin (id, "isAdmin")
    VALUES (target_user_id, true)
    ON CONFLICT (id) DO UPDATE SET "isAdmin" = true;

    RAISE NOTICE 'Successfully made % an admin!', target_email;
  ELSE
    RAISE NOTICE 'User with email % not found in the users table.', target_email;
  END IF;
END $$;
