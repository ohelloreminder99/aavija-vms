-- Add Global Multi-lingual Toggle
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS enable_multilingual BOOLEAN DEFAULT true;
