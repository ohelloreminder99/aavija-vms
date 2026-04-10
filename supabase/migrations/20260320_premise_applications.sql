-- Migration: 20260320_premise_applications.sql
-- Description: Adds the premise_applications table for the agent-driven "Apply for Premise" flow.
-- Agents submit applications; admins review and approve with one click.

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.premise_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Status lifecycle: pending → approved | rejected
    status TEXT NOT NULL DEFAULT 'pending'
        CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),

    -- Premise Details (filled by applicant)
    premise_name    TEXT NOT NULL,
    premise_address TEXT NOT NULL,
    city_id         UUID REFERENCES public.cities(id) ON DELETE SET NULL,
    city_name       TEXT,
    city_state      TEXT,
    category_id     UUID REFERENCES public.premise_categories(id) ON DELETE SET NULL,
    category_name   TEXT,

    -- Owner (must be existing user — we only store email and resolve on approval)
    owner_email     TEXT NOT NULL,
    owner_id        UUID, -- resolved server-side on approval

    -- Agent (auto-filled from the submitting agent's profile)
    agent_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    agent_name      TEXT,
    agent_email     TEXT,

    -- Audit
    submitted_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_premise_id UUID, -- set after approval

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- 2. Enable RLS
ALTER TABLE public.premise_applications ENABLE ROW LEVEL SECURITY;

-- 3. Policies
--  Agents can submit and view their own applications
CREATE POLICY "app_insert_authed"
    ON public.premise_applications FOR INSERT
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "app_select_own_or_admin"
    ON public.premise_applications FOR SELECT
    USING (submitted_by = (SELECT auth.uid()) OR public.is_admin());

--  Only admin can update (approve/reject)
CREATE POLICY "app_update_admin"
    ON public.premise_applications FOR UPDATE
    USING (public.is_admin());

-- 4. Index for fast pending queue lookup
CREATE INDEX IF NOT EXISTS idx_premise_applications_status
    ON public.premise_applications (status, created_at DESC);
