-- 20260315_ensure_block_tables_exist.sql
-- Description: Ensures that premise_blocked_visitors and host_blocked_visitors exist with the correct schema.
-- This handles cases where previous migrations might have failed to rename or find these tables.

DO $$ 
BEGIN
    -- 1. Ensure premise_blocked_visitors exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'premise_blocked_visitors') THEN
        CREATE TABLE public.premise_blocked_visitors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            premise_id UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
            visitor_id UUID NOT NULL, -- UID from visitor
            blocked_at TIMESTAMPTZ DEFAULT now(),
            blocked_by UUID NOT NULL, -- UID of owner/admin
            visitor_name TEXT NOT NULL,
            visitor_photo_url TEXT,
            UNIQUE(premise_id, visitor_id)
        );
        -- Enable RLS
        ALTER TABLE public.premise_blocked_visitors ENABLE ROW LEVEL SECURITY;
        -- Simple policies (will be refined by consolidated setup if needed)
        CREATE POLICY "Owners can view blocks for their premises" ON public.premise_blocked_visitors
            FOR SELECT USING (EXISTS (SELECT 1 FROM public.premises p WHERE p.id = premise_id AND p.owner_id = (SELECT auth.uid())));
    END IF;

    -- 2. Ensure host_blocked_visitors exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'host_blocked_visitors') THEN
        CREATE TABLE public.host_blocked_visitors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            visitor_id UUID NOT NULL,
            premise_id UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
            blocked_at TIMESTAMPTZ DEFAULT now(),
            blocked_by UUID NOT NULL, -- UID of host
            visitor_name TEXT NOT NULL,
            visitor_photo_url TEXT,
            UNIQUE(host_id, visitor_id, premise_id)
        );
        -- Enable RLS
        ALTER TABLE public.host_blocked_visitors ENABLE ROW LEVEL SECURITY;
        -- Simple policies
        CREATE POLICY "Hosts can view their own blocks" ON public.host_blocked_visitors
            FOR SELECT USING ((SELECT auth.uid()) = host_id);
    END IF;

END $$;
