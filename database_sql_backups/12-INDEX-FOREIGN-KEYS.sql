-- 12-INDEX-FOREIGN-KEYS.sql
-- Fixes Supabase Performance Advisor warnings for "Unindexed foreign keys"
-- Foreign keys should always be indexed to prevent full table scans during cascading deletes or joins.

-- Announcements
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON public.announcements("authorId");

-- Location Hierarchy
CREATE INDEX IF NOT EXISTS idx_districts_state_id ON public.districts("stateId");
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON public.cities("stateId");
CREATE INDEX IF NOT EXISTS idx_cities_district_id ON public.cities("districtId");

-- Blocks
CREATE INDEX IF NOT EXISTS idx_host_blocks_visitor_id ON public.host_blocks("visitorId");
CREATE INDEX IF NOT EXISTS idx_host_blocks_blocked_by ON public.host_blocks("blockedBy");
CREATE INDEX IF NOT EXISTS idx_premise_blocks_visitor_id ON public.premise_blocks("visitorId");
CREATE INDEX IF NOT EXISTS idx_premise_blocks_blocked_by ON public.premise_blocks("blockedBy");

-- Premises
CREATE INDEX IF NOT EXISTS idx_premises_owner_id ON public.premises("owner_id");
CREATE INDEX IF NOT EXISTS idx_premises_agent_id ON public.premises("agent_id");
