-- 20260315_fix_gates_schema.sql
-- Description: Adds missing description column to premise_gates table.

ALTER TABLE public.premise_gates 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update search path for security
ALTER TABLE public.premise_gates SET SCHEMA public;
