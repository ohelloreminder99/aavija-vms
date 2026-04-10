-- Migration: 20260320_fix_premise_category_types.sql
-- Description: Updates legacy 'standard' premise category types to 'industrial' for compatibility with new UI.

UPDATE public.premise_categories
SET type = 'industrial'
WHERE type = 'standard' OR type IS NULL;
