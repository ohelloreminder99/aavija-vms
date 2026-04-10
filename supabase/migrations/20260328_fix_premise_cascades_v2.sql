-- 20260328_fix_premise_cascades_v2.sql
-- Description: Dynamically find and update ALL foreign keys that reference public.premises(id) 
-- to include ON DELETE CASCADE. This is the most robust way to fix the "cannot delete" issue.

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 1. Loop through all foreign key constraints referencing the 'premises' table
    FOR r IN (
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name, 
            kcu.column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'premises'
          AND ccu.table_schema = 'public'
    ) LOOP
        -- 2. Drop the existing constraint
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || 
                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
        
        -- 3. Re-add the constraint with ON DELETE CASCADE
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || 
                ' ADD CONSTRAINT ' || quote_ident(r.constraint_name) || 
                ' FOREIGN KEY (' || quote_ident(r.column_name) || ') ' ||
                ' REFERENCES public.premises(id) ON DELETE CASCADE';
                
        RAISE NOTICE 'Updated constraint % on table %.% to ON DELETE CASCADE', r.constraint_name, r.table_schema, r.table_name;
    END LOOP;

    -- Special case for old naming discrepancies (premise_blocks vs premise_blocked_visitors)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'premise_blocked_visitors') THEN
        RAISE NOTICE 'Ensuring premise_blocked_visitors has cascade...';
        -- The loop above handles it if the reference exists, but we can be explicit if needed.
    END IF;

END $$;
