-- Adds missing configuration columns to the `settings` table to support all the NoSQL token, history, and billing options.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS starting_token_visitor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS starting_token_owner NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_token_threshold NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS history_days_staff NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS history_days_visitor NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS export_history_days_owner NUMERIC DEFAULT 30,
ADD COLUMN IF NOT EXISTS export_history_days_host NUMERIC DEFAULT 7,
ADD COLUMN IF NOT EXISTS export_history_days_visitor NUMERIC DEFAULT 7,
ADD COLUMN IF NOT EXISTS pdf_export_cost_host NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS csv_export_cost_host NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS pdf_export_cost_visitor NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS csv_export_cost_visitor NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS mobile_verification_cost NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS star_rating_cost NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS block_visitor_cost NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS unblock_visitor_cost NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS block_visitor_cost_host NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS unblock_visitor_cost_host NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS show_token_card_visitor BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS visit_ttl_days NUMERIC DEFAULT 30,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS token_exchange_rate NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC DEFAULT 18,
ADD COLUMN IF NOT EXISTS agent_commission_rate NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS default_country_code TEXT DEFAULT '+91',
ADD COLUMN IF NOT EXISTS phone_number_length NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS allow_unverified_checkin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS otp_request_limit_hourly NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS company_gstin TEXT,
ADD COLUMN IF NOT EXISTS company_name_billing TEXT,
ADD COLUMN IF NOT EXISTS company_address_billing TEXT,
ADD COLUMN IF NOT EXISTS company_state_billing TEXT,
ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT,
ADD COLUMN IF NOT EXISTS cgst_rate_default NUMERIC DEFAULT 9,
ADD COLUMN IF NOT EXISTS sgst_rate_default NUMERIC DEFAULT 9,
ADD COLUMN IF NOT EXISTS igst_rate_default NUMERIC DEFAULT 18;

-- Add RLS Policy to allow admins to actually modify settings!
CREATE POLICY "Allow admin to update settings" ON public.settings
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
