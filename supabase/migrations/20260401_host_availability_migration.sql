-- Migration: Add host availability to premise_members
-- Date: 2026-04-01

-- 1. Add availability column to premise_members
ALTER TABLE public.premise_members 
ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'available' CHECK (availability IN ('available', 'busy', 'do-not-disturb'));

-- 2. Update search_premise_members RPC to return availability
DROP FUNCTION IF EXISTS search_premise_members(UUID, TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION search_premise_members(
    premise_id_param UUID,
    role_param TEXT DEFAULT NULL,
    search_term_param TEXT DEFAULT '',
    limit_param INT DEFAULT 50,
    offset_param INT DEFAULT 0
)
RETURNS TABLE (
    id UUID, 
    premise_id UUID, 
    user_id UUID, 
    role TEXT, 
    identity TEXT, 
    gate_id UUID,
    is_active BOOLEAN, 
    created_at TIMESTAMPTZ, 
    user_name TEXT, 
    user_email TEXT, 
    user_photo_url TEXT,
    availability TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pm.id, 
        pm.premise_id, 
        pm.user_id, 
        pm.role, 
        pm.identity, 
        pm.gate_id,
        pm.is_active, 
        pm.created_at, 
        u.name as user_name, 
        u.email as user_email, 
        u.photo_url as user_photo_url,
        pm.availability
    FROM premise_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.premise_id = premise_id_param
      AND (role_param IS NULL OR pm.role = role_param)
      AND (search_term_param = '' OR u.name ILIKE '%' || search_term_param || '%' OR u.email ILIKE '%' || search_term_param || '%' OR pm.identity ILIKE '%' || search_term_param || '%')
    ORDER BY pm.created_at DESC
    LIMIT limit_param OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Data Backfill: Migrate availability from legacy premises.staff JSONB to premise_members
DO $$
DECLARE
    p_rec RECORD;
    s_item JSONB;
BEGIN
    FOR p_rec IN SELECT id, staff FROM public.premises WHERE staff IS NOT NULL AND jsonb_array_length(staff) > 0 LOOP
        FOR s_item IN SELECT jsonb_array_elements(p_rec.staff) LOOP
            UPDATE public.premise_members 
            SET availability = COALESCE(s_item->>'availability', 'available')
            WHERE premise_id = p_rec.id 
              AND user_id = (s_item->>'uid')::UUID
              AND role = (s_item->>'role');
        END LOOP;
    END LOOP;
END $$;
