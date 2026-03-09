-- 10-FIX-SEARCH-PATHS.sql
-- Fixes the `function_search_path_mutable` warnings from the Supabase Security Advisor.
-- SECURITY DEFINER functions execute with the privileges of the creator. Setting the search_path
-- explicitly prevents search path manipulation attacks, which is a Postgres best practice.

-- Fix for global admin check
ALTER FUNCTION public.is_admin() SET search_path = public;

-- Fix for premise-specific role checks
ALTER FUNCTION public.is_owner(UUID) SET search_path = public;
ALTER FUNCTION public.is_host(UUID) SET search_path = public;
ALTER FUNCTION public.is_gatekeeper(UUID) SET search_path = public;

-- Fix for pg_cron expiration job
ALTER FUNCTION public.purge_expired_records() SET search_path = public;
