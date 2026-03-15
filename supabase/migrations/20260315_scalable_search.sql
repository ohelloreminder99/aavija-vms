-- RPC for searchable, paginated premise members
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
    user_photo_url TEXT
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
        u.photo_url as user_photo_url
    FROM 
        premise_members pm
    JOIN 
        users u ON pm.user_id = u.id
    WHERE 
        pm.premise_id = premise_id_param
        AND (role_param IS NULL OR pm.role = role_param)
        AND (
            search_term_param = '' 
            OR u.name ILIKE '%' || search_term_param || '%'
            OR u.email ILIKE '%' || search_term_param || '%'
            OR pm.identity ILIKE '%' || search_term_param || '%'
        )
    ORDER BY 
        pm.created_at DESC
    LIMIT limit_param
    OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Counter RPCs
CREATE OR REPLACE FUNCTION increment_gatekeeper_count(premise_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE premises 
    SET gatekeeper_count = COALESCE(gatekeeper_count, 0) + 1
    WHERE id = premise_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrement_gatekeeper_count(premise_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE premises 
    SET gatekeeper_count = GREATEST(0, COALESCE(gatekeeper_count, 0) - 1)
    WHERE id = premise_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
