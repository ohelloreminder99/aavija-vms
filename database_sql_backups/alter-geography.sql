-- Adds missing relational ID columns to the geography tables so the UI can properly link and filter them.

ALTER TABLE public.districts
ADD COLUMN IF NOT EXISTS "stateId" UUID REFERENCES public.states(id) ON DELETE CASCADE;

ALTER TABLE public.cities
ADD COLUMN IF NOT EXISTS "districtId" UUID REFERENCES public.districts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS "stateId" UUID REFERENCES public.states(id) ON DELETE CASCADE;
