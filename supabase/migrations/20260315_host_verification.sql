-- Migration: Add Host Verification for Checkout
-- Date: 2026-03-15

-- 1. Add toggle to premises table
ALTER TABLE public.premises 
ADD COLUMN IF NOT EXISTS require_host_verification BOOLEAN DEFAULT false;

-- 2. Add verification tracking to visits table
ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS host_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS host_verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_visits_host_verified_at ON public.visits(host_verified_at);
CREATE INDEX IF NOT EXISTS idx_visits_host_verified_by ON public.visits(host_verified_by);

-- 4. Update search_premise_members to include the new column if needed (not strictly necessary here as search_premise_members is for members, not premises)

COMMENT ON COLUMN public.premises.require_host_verification IS 'When true, visitors must be verified by host before gatekeeper can checkout.';
COMMENT ON COLUMN public.visits.host_verified_at IS 'Timestamp when the host verified the meeting.';
COMMENT ON COLUMN public.visits.host_verified_by IS 'ID of the host who verified the meeting.';
