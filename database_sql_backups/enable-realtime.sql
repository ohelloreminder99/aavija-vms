-- Run this in your Supabase SQL Editor to enable Realtime updates 
-- for all your tables! This fixes the "mismatch" connection errors.

-- 1. Create the publication if it doesn't exist (Supabase usually creates it by default)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- 2. Add all your tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.premises;
ALTER PUBLICATION supabase_realtime ADD TABLE public.premise_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkin_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_ledger_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.districts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.premise_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.host_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ratings;
