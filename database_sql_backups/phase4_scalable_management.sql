-- =============================================================================
-- AAVIJA VMS — Scalable Member & Gate Management Migration
-- Author: Antigravity (Google DeepMind), 2026-03-15
-- Purpose: Move from JSONB staff array to normalized relational tables
--          to support thousands of hosts and multi-gate setups.
-- =============================================================================

-- 1. Create premise_gates table
CREATE TABLE IF NOT EXISTS public.premise_gates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id  UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premise_gates_premise ON public.premise_gates(premise_id);

-- 2. Create premise_members table
CREATE TABLE IF NOT EXISTS public.premise_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id  UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('host', 'gatekeeper')),
  identity    TEXT, -- Unit No / Flat No (primarily for hosts)
  gate_id     UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  -- Prevent duplicate membership of same user in same role at same premise
  UNIQUE(premise_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_premise_members_premise ON public.premise_members(premise_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_user    ON public.premise_members(user_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_role    ON public.premise_members(role);

-- 3. Data Migration Script (JSONB -> Relational)
-- This takes the 'staff' JSONB array from premises and inserts into premise_members
DO $$
DECLARE
    p_rec RECORD;
    s_item JSONB;
BEGIN
    FOR p_rec IN SELECT id, staff FROM public.premises WHERE staff IS NOT NULL AND jsonb_array_length(staff) > 0 LOOP
        FOR s_item IN SELECT jsonb_array_elements(p_rec.staff) LOOP
            INSERT INTO public.premise_members (premise_id, user_id, role, identity, is_active)
            VALUES (
                p_rec.id,
                (s_item->>'uid')::UUID,
                (s_item->>'role'),
                (s_item->>'identity'),
                COALESCE((s_item->>'is_active')::BOOLEAN, true)
            )
            ON CONFLICT (premise_id, user_id, role) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 4. Enable RLS
ALTER TABLE public.premise_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premise_members ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Premise owners can do everything with their members/gates
CREATE POLICY "Owners manage gates" ON public.premise_gates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.premises 
      WHERE premises.id = premise_gates.premise_id 
      AND premises.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners manage members" ON public.premise_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.premises 
      WHERE premises.id = premise_members.premise_id 
      AND premises.owner_id = auth.uid()
    )
  );

-- Public/Authenticated read access (for lookup)
CREATE POLICY "Public read gates" ON public.premise_gates FOR SELECT USING (true);
CREATE POLICY "Public read members" ON public.premise_members FOR SELECT USING (true);

-- 6. Grant Access
GRANT ALL ON public.premise_gates TO service_role;
GRANT ALL ON public.premise_members TO service_role;
GRANT SELECT ON public.premise_gates TO authenticated;
GRANT SELECT ON public.premise_members TO authenticated;
