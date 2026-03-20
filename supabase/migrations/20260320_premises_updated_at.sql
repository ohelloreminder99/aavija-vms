-- ═══════════════════════════════════════════════════════════════════════════
-- AAVIJA VMS — Add `updated_at` column to premises for Optimistic Locking
-- Run this AFTER 20260320_atomic_premise_approval.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- Add updated_at column (auto-maintained by trigger)
ALTER TABLE public.premises
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create a trigger function to auto-update the timestamp on any row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply the trigger specifically to premises
DROP TRIGGER IF EXISTS premises_set_updated_at ON public.premises;
CREATE TRIGGER premises_set_updated_at
  BEFORE UPDATE ON public.premises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill existing rows with a sensible default
UPDATE public.premises
SET updated_at = created_at
WHERE updated_at IS NULL;
