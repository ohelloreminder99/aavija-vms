-- Activate Realtime Broadcasting on the core mutating tables
-- By default, Supabase disables realtime for security and performance.
-- Adding tables to the `supabase_realtime` publication allows the Next.js `useCollection` and `useDoc` hooks to receive WebSocket messages.

BEGIN;

-- Create the publication if it doesn't exist (Supabase usually provides this natively)
-- DO NOT fail if it exists, just ensure the tables are added.
DO $$
DECLARE
    t_name text;
    tables_to_add text[] := ARRAY['visits', 'logs', 'premises', 'users', 'agents', 'premise_categories'];
BEGIN
    FOREACH t_name IN ARRAY tables_to_add LOOP
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = t_name
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t_name);
        END IF;
    END LOOP;
END $$;
