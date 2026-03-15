-- Migration: 20260315_rate_limiting.sql
-- Description: Adds a centralized rate limiting table and RPC to enforce dynamic limits.

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY, -- e.g. "auth:192.168.1.1", "checkin:premise_123"
    request_count INTEGER DEFAULT 0,
    last_request_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 minute'
);

-- Index for expiring old rate limit entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits(reset_at);

-- RPC to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_max_requests INTEGER,
    p_window_interval INTERVAL DEFAULT INTERVAL '1 minute'
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Upsert the rate limit entry
    INSERT INTO public.rate_limits (key, request_count, last_request_at, reset_at)
    VALUES (p_key, 1, NOW(), NOW() + p_window_interval)
    ON CONFLICT (key) DO UPDATE
    SET 
        request_count = CASE 
            WHEN public.rate_limits.reset_at < NOW() THEN 1 
            ELSE public.rate_limits.request_count + 1 
        END,
        reset_at = CASE 
            WHEN public.rate_limits.reset_at < NOW() THEN NOW() + p_window_interval 
            ELSE public.rate_limits.reset_at 
        END,
        last_request_at = NOW()
    RETURNING request_count INTO v_count;

    RETURN v_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Security Hardening: RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny all direct access (table is managed via SECURITY DEFINER logic)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'rate_limits' AND policyname = 'Deny all direct access'
    ) THEN
        CREATE POLICY "Deny all direct access" ON public.rate_limits FOR ALL USING (false);
    END IF;
END
$$;
