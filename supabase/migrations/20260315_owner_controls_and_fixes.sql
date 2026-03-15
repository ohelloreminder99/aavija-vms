-- Migration: Owner Controls and Blocked Table Fixes
-- Description: Renames blocked visitor tables for consistency and adds host verification toggle.

-- 1. Rename premise_blocks to premise_blocked_visitors
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'premise_blocks') THEN
        ALTER TABLE public.premise_blocks RENAME TO premise_blocked_visitors;
    END IF;
END $$;

-- 2. Rename host_blocks to host_blocked_visitors
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'host_blocks') THEN
        ALTER TABLE public.host_blocks RENAME TO host_blocked_visitors;
    END IF;
END $$;

-- 3. Standardize column names if they exist with old names
-- Note: Adjust based on actual existing columns if different
DO $$ 
BEGIN
    -- For premise_blocked_visitors
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'premise_blocked_visitors' AND column_name = 'premiseId') THEN
        ALTER TABLE public.premise_blocked_visitors RENAME COLUMN "premiseId" TO premise_id;
    END IF;
    
    -- For host_blocked_visitors
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'host_blocked_visitors' AND column_name = 'hostId') THEN
        ALTER TABLE public.host_blocked_visitors RENAME COLUMN "hostId" TO host_id;
    END IF;
END $$;

-- 4. Add require_host_verification to premises table
ALTER TABLE public.premises 
ADD COLUMN IF NOT EXISTS require_host_verification BOOLEAN DEFAULT FALSE;

-- 5. Add host_verified to visits table (to track if host met the visitor)
ALTER TABLE public.visits
ADD COLUMN IF NOT EXISTS host_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS host_verified_at TIMESTAMPTZ;

-- 6. Update search_path for security
ALTER FUNCTION public.check_rate_limit SET search_path = public;
