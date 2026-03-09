-- Patch to redirect the foreign key constraint for agent_id
-- The premises table originally referenced public.users(id), but we moved agents to public.agents.

ALTER TABLE public.premises
DROP CONSTRAINT IF EXISTS premises_agent_id_fkey;

ALTER TABLE public.premises
ADD CONSTRAINT premises_agent_id_fkey
FOREIGN KEY (agent_id) REFERENCES public.agents(id)
ON DELETE SET NULL;
