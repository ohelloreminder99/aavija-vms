-- 20260315_repair_blocklist_rename.sql
-- Description: Robust repair for blocked visitor tables, ensuring snake_case columns.

-- 1. REPAIR host_blocked_visitors
DO $$ 
BEGIN
    -- Rename columns if they exist in camelCase
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'host_blocked_visitors' AND column_name = 'blockedAt') THEN
        ALTER TABLE public.host_blocked_visitors RENAME COLUMN "blockedAt" TO blocked_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'host_blocked_visitors' AND column_name = 'blockedBy') THEN
        ALTER TABLE public.host_blocked_visitors RENAME COLUMN "blockedBy" TO blocked_by;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'host_blocked_visitors' AND column_name = 'visitorName') THEN
        ALTER TABLE public.host_blocked_visitors RENAME COLUMN "visitorName" TO visitor_name;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'host_blocked_visitors' AND column_name = 'visitorPhotoUrl') THEN
        ALTER TABLE public.host_blocked_visitors RENAME COLUMN "visitorPhotoUrl" TO visitor_photo_url;
    END IF;
END $$;

-- 2. REPAIR premise_blocked_visitors
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'premise_blocked_visitors' AND column_name = 'blockedAt') THEN
        ALTER TABLE public.premise_blocked_visitors RENAME COLUMN "blockedAt" TO blocked_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'premise_blocked_visitors' AND column_name = 'blockedBy') THEN
        ALTER TABLE public.premise_blocked_visitors RENAME COLUMN "blockedBy" TO blocked_by;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'premise_blocked_visitors' AND column_name = 'visitorName') THEN
        ALTER TABLE public.premise_blocked_visitors RENAME COLUMN "visitorName" TO visitor_name;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'premise_blocked_visitors' AND column_name = 'visitorPhotoUrl') THEN
        ALTER TABLE public.premise_blocked_visitors RENAME COLUMN "visitorPhotoUrl" TO visitor_photo_url;
    END IF;
END $$;

-- 3. ENSURE RLS POLICIES USE SNAKE_CASE
-- (The migration will typically fail if policies exist with old names, but we ensure the schema cache is fresh)
NOTIFY pgrst, 'reload schema';
