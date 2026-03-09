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
