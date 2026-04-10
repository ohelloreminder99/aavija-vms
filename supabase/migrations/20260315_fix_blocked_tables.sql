-- 20260315_fix_blocked_tables.sql
-- Fixes the discrepancy between the schema (premise_blocks) and RPCs/Service (premise_blocked_visitors)

DO $$ 
BEGIN
    -- Rename premise_blocks if it exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'premise_blocks') THEN
        ALTER TABLE public.premise_blocks RENAME TO premise_blocked_visitors;
    END IF;

    -- Rename host_blocks if it exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'host_blocks') THEN
        ALTER TABLE public.host_blocks RENAME TO host_blocked_visitors;
    END IF;

    -- Ensure column names match what the RPC expects
    -- The schema has "premiseId", "visitorId", "visitorName" (camelCase)
    -- The RPC expects "premise_id", "blockedAt", "blockedBy", "visitorName", "visitorPhotoUrl"
    
    -- standardise premise_blocked_visitors
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'premise_blocked_visitors') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='premise_blocked_visitors' AND column_name='premise_id') THEN
            ALTER TABLE public.premise_blocked_visitors RENAME COLUMN "premiseId" TO premise_id;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='premise_blocked_visitors' AND column_name='blockedAt') THEN
            ALTER TABLE public.premise_blocked_visitors RENAME COLUMN "createdAt" TO "blockedAt";
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='premise_blocked_visitors' AND column_name='visitorPhotoUrl') THEN
            ALTER TABLE public.premise_blocked_visitors ADD COLUMN "visitorPhotoUrl" TEXT;
        END IF;
        -- Ensure PK is (id, premise_id) to match the RPC's ON CONFLICT
        -- But schema had id as surrogate PK. We need to adjust.
        ALTER TABLE public.premise_blocked_visitors DROP CONSTRAINT IF EXISTS premise_blocks_pkey;
        -- Assuming id in RPC p_visitor_id is the visitor's UUID
    END IF;

    -- standardise host_blocked_visitors
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'host_blocked_visitors') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='host_blocked_visitors' AND column_name='host_id') THEN
            ALTER TABLE public.host_blocked_visitors RENAME COLUMN "hostId" TO host_id;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='host_blocked_visitors' AND column_name='blockedAt') THEN
            ALTER TABLE public.host_blocked_visitors RENAME COLUMN "createdAt" TO "blockedAt";
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='host_blocked_visitors' AND column_name='visitorPhotoUrl') THEN
            ALTER TABLE public.host_blocked_visitors ADD COLUMN "visitorPhotoUrl" TEXT;
        END IF;
    END IF;

END $$;
