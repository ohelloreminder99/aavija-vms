-- Fix Function Search Path Mutable Warnings
-- Locks the execution context to the public schema to prevent malicious search_path manipulation overrides
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

ALTER FUNCTION public.deduct_user_tokens(UUID, NUMERIC) SET search_path = public;
ALTER FUNCTION public.deduct_premise_tokens(UUID, NUMERIC) SET search_path = public;
ALTER FUNCTION public.purge_expired_records() SET search_path = public;

-- Note on Leaked Password Protection:
-- The 'auth_leaked_password_protection' warning cannot be fixed via SQL.
-- It is a configuration flag passed to the GoTrue Auth server.
-- To resolve it:
-- 1. Open your Supabase Dashboard.
-- 2. Go to Authentication -> Providers -> Email.
-- 3. Scroll down and toggle ON "Enable leaked password protection".
