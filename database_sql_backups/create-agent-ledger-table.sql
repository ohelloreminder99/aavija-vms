-- create-agent-ledger-table.sql
-- Creates the agent_ledger table that precisely matches the application's data requirements.
-- This replaces the outdated agent_ledger_entries schema.

CREATE TABLE IF NOT EXISTS public.agent_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    description TEXT,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_ledger ENABLE ROW LEVEL SECURITY;

-- Allow Admins full access to read and write agent_ledger
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'agent_ledger' 
        AND policyname = 'Admins can manage agent ledger'
    ) THEN
        CREATE POLICY "Admins can manage agent ledger" ON public.agent_ledger
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Drop the outdated, unused table to prevent future confusion
DROP TABLE IF EXISTS public.agent_ledger_entries CASCADE;
