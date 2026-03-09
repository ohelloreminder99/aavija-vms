-- 11-ADD-LEGAL-SETTINGS.sql
-- Adds the missing legal footprint config columns to the `settings` table so the admin can
-- dynamically update the Governance/Privacy policies on the fly without deploying code.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS legal_grievance_officer TEXT DEFAULT '[Name/Legal Dept]',
ADD COLUMN IF NOT EXISTS legal_entity_name TEXT DEFAULT '99 Interactive Services',
ADD COLUMN IF NOT EXISTS legal_support_email TEXT DEFAULT 'support@99interactive.com',
ADD COLUMN IF NOT EXISTS legal_address TEXT DEFAULT '[Your Registered Address, Surat, Gujarat, India]',
ADD COLUMN IF NOT EXISTS legal_jurisdiction_city TEXT DEFAULT 'Surat, Gujarat, India',
ADD COLUMN IF NOT EXISTS legal_email TEXT DEFAULT 'legal@99interactive.com';
