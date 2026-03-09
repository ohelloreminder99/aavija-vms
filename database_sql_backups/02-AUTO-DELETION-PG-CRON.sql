-- =======================================================================================
-- 100-Year Architectural Hardening
-- Part 3: Automated Data Expiration (PG_CRON) synced with Admin Dashboard Settings
-- =======================================================================================

-- 1. Enable Supabase's PG_CRON extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the Stored Procedure (RPC) that performs the physical data destruction
CREATE OR REPLACE FUNCTION purge_expired_records() RETURNS void AS $$
DECLARE
  v_ttl NUMERIC;
BEGIN
  -- Fetch the Admin's configured Time-To-Live (visit_ttl_days) global setting
  SELECT visit_ttl_days INTO v_ttl FROM public.settings WHERE id = 'global';
  
  -- Fallback to 30 days if the admin accidentally deleted the setting or set it to 0
  IF v_ttl IS NULL OR v_ttl <= 0 THEN
    v_ttl := 30; 
  END IF;

  -- A. Delete completed/declined/force_closed visits older than Admin's TTL days
  DELETE FROM public.visits 
  WHERE status != 'active' AND checkin_time < NOW() - (v_ttl || ' days')::INTERVAL;

  -- B. Delete global administrative logs older than Admin's TTL days
  DELETE FROM public.logs 
  WHERE created_at < NOW() - (v_ttl || ' days')::INTERVAL;

  -- C. Delete physical agent accounting ledgers older than Admin's TTL days
  DELETE FROM public.agent_ledger
  WHERE created_at < NOW() - (v_ttl || ' days')::INTERVAL;

  -- D. Delete old check-in tokens (QR codes) that are already past their 60-second expiration.
  DELETE FROM public.checkin_tokens 
  WHERE "expiresAt" < NOW() - INTERVAL '1 day';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule the cleanup to run every day automatically at Midnight (00:00)
SELECT cron.schedule('purge_expired_records_job', '0 0 * * *', 'SELECT purge_expired_records()');
