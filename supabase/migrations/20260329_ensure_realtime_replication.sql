-- =============================================================================
-- AAVIJA VMS — REALTIME REPLICATION SETUP
-- This ensures that changes to these tables are broadcast via Supabase Realtime.
-- =============================================================================

BEGIN;
  -- Add tables to the supabase_realtime publication
  -- Note: We use a DO block to safely add tables only if they aren't already there
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'premise_members'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.premise_members;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'premise_gates'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.premise_gates;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'premise_blocked_visitors'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.premise_blocked_visitors;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'premises'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.premises;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoices'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    END IF;
  END $$;
COMMIT;
