-- fix-invoices-timestamp.sql
-- This script safely adds a 'created_at' timestamp column to the invoices table 
-- if it was accidentally omitted during the initial table creation.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.invoices 
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;
