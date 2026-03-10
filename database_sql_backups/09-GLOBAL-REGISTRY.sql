-- 09-GLOBAL-REGISTRY.sql
-- Acts as the central directory for all regional deployments

CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,               -- e.g., 'Democratic Republic of the Congo'
  code TEXT UNIQUE NOT NULL,        -- e.g., 'CD'
  domain TEXT UNIQUE NOT NULL,      -- e.g., 'drc.aavija.com'
  supabase_url TEXT NOT NULL,       -- The specific URL for this country's Supabase
  supabase_anon_key TEXT NOT NULL,  -- The public key for this country's Supabase
  is_active BOOLEAN DEFAULT true,
  currency_code TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Basic RLS for the regions table (Read-only for everyone)
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to regions"
  ON public.regions FOR SELECT
  USING (is_active = true);

-- Seed with India (Current Project)
-- Note: Replace with your actual credentials if they differ from your env
-- INSERT INTO public.regions (name, code, domain, supabase_url, supabase_anon_key)
-- VALUES ('India', 'IN', 'india.aavija.com', '...', '...');
