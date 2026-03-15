-- Migration: 20260315_branding_services_settings.sql
-- Description: Adds dynamic branding identity and third-party service template configurations.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS brand_name TEXT DEFAULT 'Aavija',
ADD COLUMN IF NOT EXISTS brand_tagline TEXT DEFAULT 'Visitor Management Ecosystem',
ADD COLUMN IF NOT EXISTS support_email TEXT,
ADD COLUMN IF NOT EXISTS support_phone TEXT,
ADD COLUMN IF NOT EXISTS razorpay_key_id TEXT,
ADD COLUMN IF NOT EXISTS wa_template_host_notified TEXT DEFAULT 'aavija_host_notified',
ADD COLUMN IF NOT EXISTS wa_template_payout_approved TEXT DEFAULT 'aavija_payout_approved',
ADD COLUMN IF NOT EXISTS wa_template_payout_rejected TEXT DEFAULT 'aavija_payout_rejected',
ADD COLUMN IF NOT EXISTS wa_template_kyc_verified TEXT DEFAULT 'aavija_kyc_verified',
ADD COLUMN IF NOT EXISTS wa_template_tokens_converted TEXT DEFAULT 'aavija_tokens_converted',
ADD COLUMN IF NOT EXISTS wa_template_referral_commission TEXT DEFAULT 'aavija_referral_commission',
ADD COLUMN IF NOT EXISTS wa_template_threshold_reached TEXT DEFAULT 'aavija_threshold_reached',
ADD COLUMN IF NOT EXISTS wa_template_phone_verify TEXT DEFAULT 'aavija_phone_verify',
ADD COLUMN IF NOT EXISTS wa_template_agent_assigned TEXT DEFAULT 'aavija_agent_assigned';

COMMENT ON COLUMN public.settings.brand_name IS 'The public name of the application displayed to users.';
COMMENT ON COLUMN public.settings.brand_tagline IS 'The tagline or slogan displayed in headers and PDFs.';
COMMENT ON COLUMN public.settings.razorpay_key_id IS 'Public Razorpay Key ID for client-side checkouts.';
COMMENT ON COLUMN public.settings.wa_template_host_notified IS 'WhatsApp template name for notifying hosts of arrivals.';
