-- 20260328_fix_premise_cascades.sql
-- Description: Add ON DELETE CASCADE to all foreign keys referencing public.premises(id) 
-- to allow premises to be deleted along with their associated data (visits, logs, etc.)

DO $$ 
BEGIN
    -- 1. visits
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'visits_premise_id_fkey') THEN
        ALTER TABLE public.visits DROP CONSTRAINT visits_premise_id_fkey;
    END IF;
    ALTER TABLE public.visits 
    ADD CONSTRAINT visits_premise_id_fkey 
    FOREIGN KEY (premise_id) REFERENCES public.premises(id) ON DELETE CASCADE;

    -- 2. logs
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'logs_premiseId_fkey') THEN
        ALTER TABLE public.logs DROP CONSTRAINT "logs_premiseId_fkey";
    END IF;
    ALTER TABLE public.logs 
    ADD CONSTRAINT "logs_premiseId_fkey" 
    FOREIGN KEY ("premiseId") REFERENCES public.premises(id) ON DELETE CASCADE;

    -- 3. checkin_tokens
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'checkin_tokens_premise_id_fkey') THEN
        ALTER TABLE public.checkin_tokens DROP CONSTRAINT checkin_tokens_premise_id_fkey;
    END IF;
    ALTER TABLE public.checkin_tokens 
    ADD CONSTRAINT checkin_tokens_premise_id_fkey 
    FOREIGN KEY (premise_id) REFERENCES public.premises(id) ON DELETE CASCADE;

    -- 4. agent_ledger_entries
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'agent_ledger_entries_premiseId_fkey') THEN
        ALTER TABLE public.agent_ledger_entries DROP CONSTRAINT "agent_ledger_entries_premiseId_fkey";
    END IF;
    ALTER TABLE public.agent_ledger_entries 
    ADD CONSTRAINT "agent_ledger_entries_premiseId_fkey" 
    FOREIGN KEY ("premiseId") REFERENCES public.premises(id) ON DELETE CASCADE;

    -- 5. premise_blocks
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'premise_blocks_premiseId_fkey') THEN
        ALTER TABLE public.premise_blocks DROP CONSTRAINT "premise_blocks_premiseId_fkey";
    END IF;
    ALTER TABLE public.premise_blocks 
    ADD CONSTRAINT "premise_blocks_premiseId_fkey" 
    FOREIGN KEY ("premiseId") REFERENCES public.premises(id) ON DELETE CASCADE;

    -- 6. ratings
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ratings_premiseId_fkey') THEN
        ALTER TABLE public.ratings DROP CONSTRAINT "ratings_premiseId_fkey";
    END IF;
    ALTER TABLE public.ratings 
    ADD CONSTRAINT "ratings_premiseId_fkey" 
    FOREIGN KEY ("premiseId") REFERENCES public.premises(id) ON DELETE CASCADE;

END $$;
