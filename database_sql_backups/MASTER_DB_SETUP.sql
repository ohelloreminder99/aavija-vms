-- ████████████████████████████████████████████████████████████████████████████
-- AAVIJA VMS — MASTER DATABASE BOOTSTRAP (v3 — 2026-03-20)
-- ████████████████████████████████████████████████████████████████████████████
--
-- PURPOSE: Run this ONCE on a fresh Supabase project to get a complete,
--          production-ready Aavija database for ANY country deployment.
--
-- HOW TO USE:
--   1. Create a new Supabase project at https://supabase.com
--   2. Go to SQL Editor
--   3. Paste this ENTIRE file and click "Run"
--   4. Done — all tables, RLS, functions, crons, and seed data are created.
--
-- IDEMPOTENT: Safe to run multiple times (uses IF NOT EXISTS, OR REPLACE, ON CONFLICT DO NOTHING)
--
-- COUNTRY CUSTOMIZATION: Search for "COUNTRY_CONFIG" blocks below for values
--                        you need to change per-country deployment.
--
-- ORDER OF SECTIONS:
--   0. Extensions
--   1. Core Tables (in dependency order)
--   2. Additional Tables
--   3. Columns Added by Migrations (ALTER TABLE)
--   4. Indexes
--   5. Storage Buckets
--   6. Row Level Security (RLS)
--   7. Helper Functions
--   8. Atomic RPC Functions
--   9. pg_cron TTL Jobs
--   10. Seed Data (settings + first admin)
--   11. Realtime Subscriptions
--
-- █████████████████████████████████████████████████████████████████████████████


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CORE TABLES (dependency order — do not reorder)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id                          UUID PRIMARY KEY, -- Matches Supabase Auth ID
  name                        TEXT NOT NULL,
  email                       TEXT UNIQUE NOT NULL,
  role                        TEXT NOT NULL DEFAULT 'visitor',
  phone                       TEXT,
  "countryCode"               TEXT,
  is_verified                 BOOLEAN DEFAULT FALSE,
  is_active                   BOOLEAN DEFAULT TRUE,
  is_agent                    BOOLEAN DEFAULT FALSE,
  token_balance_visitor       INTEGER DEFAULT 0,
  global_rating               NUMERIC DEFAULT 5.0,
  active_checkin_id           UUID,
  photo_url                   TEXT,
  city                        TEXT,
  "cityId"                    TEXT,
  city_state                  TEXT,
  "companyName"               TEXT,
  premise_roles               JSONB DEFAULT '{}'::JSONB,
  vehicles                    JSONB,
  selected_vehicle_number     TEXT,
  products                    JSONB,
  "gstNumber"                 TEXT,
  "billingAddress"            TEXT,
  "legalName"                 TEXT,
  "billingState"              TEXT,
  agent_commission_balance    NUMERIC DEFAULT 0,
  agent_payout_upi            TEXT,
  pan_number                  TEXT,
  pan_card_url                TEXT,
  kyc_verified                BOOLEAN DEFAULT FALSE,
  referral_code               TEXT UNIQUE,
  referred_by                 UUID REFERENCES public.users(id),
  referral_commission_balance NUMERIC DEFAULT 0,
  action_timestamps           JSONB DEFAULT '{}'::JSONB,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.premise_categories (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('residential', 'industrial', 'standard')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  deduction_rate_visitor NUMERIC DEFAULT 1,
  deduction_rate_premise NUMERIC DEFAULT 1,
  pdf_export_cost       NUMERIC DEFAULT 5,
  csv_export_cost       NUMERIC DEFAULT 2
);

CREATE TABLE IF NOT EXISTS public.agents (
  id                  UUID PRIMARY KEY REFERENCES public.users(id),
  name                TEXT NOT NULL,
  phone               TEXT DEFAULT '',
  city                TEXT,
  commission_balance  NUMERIC DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.premises (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    TEXT NOT NULL,
  address                 TEXT NOT NULL,
  city                    TEXT NOT NULL,
  "cityId"                TEXT,
  city_state              TEXT,
  is_active               BOOLEAN DEFAULT TRUE,
  owner_id                UUID REFERENCES public.users(id) ON DELETE CASCADE,
  "ownerName"             TEXT,
  token_balance           INTEGER DEFAULT 0,
  agent_id                UUID REFERENCES public.agents(id),
  "categoryId"            TEXT,   -- NOTE: TEXT not UUID (stored as text ID reference)
  "categoryName"          TEXT,   -- Denormalized for performance
  host_count              INTEGER DEFAULT 0,
  gatekeeper_count        INTEGER DEFAULT 0,
  gate_count              INTEGER DEFAULT 0,
  staff                   JSONB DEFAULT '[]'::JSONB,
  "gstNumber"             TEXT,
  "billingAddress"        TEXT,
  "legalName"             TEXT,
  "billingState"          TEXT,
  require_host_verification BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()  -- Added by 20260320_premises_updated_at migration
);

CREATE TABLE IF NOT EXISTS public.states (
  id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.districts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  "stateName" TEXT NOT NULL,
  "stateId"   UUID REFERENCES public.states(id)
);

CREATE TABLE IF NOT EXISTS public.cities (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT NOT NULL,
  "districtName" TEXT NOT NULL,
  "stateName"    TEXT NOT NULL,
  "districtId"   UUID REFERENCES public.districts(id),
  "stateId"      UUID REFERENCES public.states(id)
);

CREATE TABLE IF NOT EXISTS public.visits (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id          UUID REFERENCES public.users(id),
  visitor_name        TEXT,
  host_id             UUID REFERENCES public.users(id),
  host_name           TEXT,
  premise_id          UUID REFERENCES public.premises(id),
  checkin_time        TIMESTAMPTZ DEFAULT NOW(),
  checkout_time       TIMESTAMPTZ,
  "expiresAt"         TIMESTAMPTZ,
  vehicle_details     JSONB,
  visitor_snapshot_url TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  checkin_gate_id     UUID,  -- FK added after premise_gates created
  checkout_gate_id    UUID,  -- FK added after premise_gates created
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "actorId"     UUID,
  "actorName"   TEXT,
  "actorRole"   TEXT,
  action        TEXT NOT NULL,
  timestamp     TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt"   TIMESTAMPTZ,
  description   TEXT,
  "tokenChange" INTEGER,
  "premiseId"   UUID REFERENCES public.premises(id),
  context       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.checkin_tokens (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id   UUID REFERENCES public.users(id),
  visitor_name TEXT,
  host_id      UUID REFERENCES public.users(id),
  premise_id   UUID REFERENCES public.premises(id),
  status       TEXT DEFAULT 'unused',
  "expiresAt"  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ADDITIONAL TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.settings (
  id                            TEXT PRIMARY KEY,
  -- Retention
  log_ttl_days                  INTEGER DEFAULT 30,
  visit_ttl_days                INTEGER DEFAULT 90,
  history_days_admin            INTEGER DEFAULT 30,
  history_days_owner            INTEGER DEFAULT 30,
  history_days_host             INTEGER DEFAULT 7,
  history_days_gatekeeper       INTEGER DEFAULT 1,
  history_days_staff            INTEGER DEFAULT 7,
  history_days_visitor          INTEGER DEFAULT 30,
  -- Token Economy
  starting_token_visitor        INTEGER DEFAULT 10,
  starting_token_owner          INTEGER DEFAULT 0,
  low_token_threshold           INTEGER DEFAULT 5,
  checkin_cost                  INTEGER DEFAULT 1,
  whatsapp_notification_cost    INTEGER DEFAULT 1,
  mobile_verification_cost      INTEGER DEFAULT 2,
  star_rating_cost              INTEGER DEFAULT 1,
  block_visitor_cost            INTEGER DEFAULT 0,
  unblock_visitor_cost          INTEGER DEFAULT 0,
  block_visitor_cost_host       INTEGER DEFAULT 0,
  unblock_visitor_cost_host     INTEGER DEFAULT 0,
  export_history_days_owner     INTEGER DEFAULT 30,
  export_history_days_host      INTEGER DEFAULT 30,
  export_history_days_visitor   INTEGER DEFAULT 30,
  pdf_export_cost_host          INTEGER DEFAULT 5,
  csv_export_cost_host          INTEGER DEFAULT 2,
  pdf_export_cost_visitor       INTEGER DEFAULT 5,
  csv_export_cost_visitor       INTEGER DEFAULT 2,
  hide_token_economy            BOOLEAN DEFAULT FALSE,
  show_token_card_visitor       BOOLEAN DEFAULT TRUE,
  -- Payments / GST
  -- [COUNTRY_CONFIG] Change these for each country deployment
  currency                      TEXT DEFAULT 'INR',
  token_exchange_rate           NUMERIC DEFAULT 1,
  gst_rate                      NUMERIC DEFAULT 18,
  agent_commission_percent      NUMERIC DEFAULT 10,
  agent_commission_rate         NUMERIC DEFAULT 10,
  payout_threshold_agent        NUMERIC DEFAULT 500,
  token_conversion_rate         NUMERIC DEFAULT 1,
  payout_method_note            TEXT,
  tds_enabled                   BOOLEAN DEFAULT FALSE,
  tds_rate                      NUMERIC DEFAULT 5,
  tds_annual_exemption          NUMERIC DEFAULT 30000,
  max_daily_token_purchase      INTEGER DEFAULT 5000,
  -- GST rates
  cgst_rate_default             NUMERIC DEFAULT 9,
  sgst_rate_default             NUMERIC DEFAULT 9,
  igst_rate_default             NUMERIC DEFAULT 18,
  -- Billing
  company_gstin                 TEXT,
  company_name_billing          TEXT,
  company_address_billing       TEXT,
  company_state_billing         TEXT,
  hsn_sac_code                  TEXT DEFAULT '998319',
  -- [COUNTRY_CONFIG] Change for each country
  default_country_code          TEXT DEFAULT '+91',
  phone_number_length           INTEGER DEFAULT 10,
  -- Checkin rules
  allow_unverified_checkin      BOOLEAN DEFAULT FALSE,
  allow_concurrent_checkins     BOOLEAN DEFAULT FALSE,
  otp_request_limit_hourly      INTEGER DEFAULT 3,
  qr_code_expiry_seconds        INTEGER DEFAULT 300,
  emergency_access_timeout_mins INTEGER DEFAULT 30,
  -- Rate limits
  rate_limit_max_requests       INTEGER DEFAULT 100,
  rate_limit_window_ms          INTEGER DEFAULT 60000,
  auth_rate_limit               INTEGER DEFAULT 5,
  checkin_rate_limit            INTEGER DEFAULT 10,
  whatsapp_rate_limit           INTEGER DEFAULT 3,
  -- Referral
  referral_enabled              BOOLEAN DEFAULT FALSE,
  referral_commission_rate      NUMERIC DEFAULT 5,
  referral_min_purchase_tokens  INTEGER DEFAULT 10,
  referral_reward_tokens        INTEGER DEFAULT 5,
  -- Maintenance
  is_maintenance_mode           BOOLEAN DEFAULT FALSE,
  maintenance_message           TEXT,
  enable_multilingual           BOOLEAN DEFAULT FALSE,
  -- Branding (COUNTRY_CONFIG — customize per deployment)
  brand_name                    TEXT DEFAULT 'Aavija',
  brand_tagline                 TEXT,
  support_email                 TEXT,
  support_phone                 TEXT,
  razorpay_key_id               TEXT,
  -- Landing page
  landing_hero_title            TEXT,
  landing_hero_subtitle         TEXT,
  landing_cta_primary           TEXT,
  landing_cta_secondary         TEXT,
  landing_features              JSONB,
  -- Legal (COUNTRY_CONFIG)
  legal_grievance_officer       TEXT,
  legal_entity_name             TEXT,
  legal_support_email           TEXT,
  legal_address                 TEXT,
  legal_jurisdiction_city       TEXT,
  legal_email                   TEXT,
  -- WhatsApp template IDs
  wa_template_host_notified     TEXT,
  wa_template_payout_approved   TEXT,
  wa_template_payout_rejected   TEXT,
  wa_template_kyc_verified      TEXT,
  wa_template_tokens_converted  TEXT,
  wa_template_referral_commission TEXT,
  wa_template_threshold_reached TEXT,
  wa_template_phone_verify      TEXT,
  wa_template_agent_assigned    TEXT,
  -- Timestamps
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"                UUID REFERENCES public.users(id),
  "userName"              TEXT,
  "userEmail"             TEXT,
  "userPhone"             TEXT,
  "userState"             TEXT,
  "premiseId"             UUID REFERENCES public.premises(id),
  "tokenAmount"           INTEGER,
  subtotal                NUMERIC,
  "totalAmount"           NUMERIC,
  cgst                    NUMERIC,
  sgst                    NUMERIC,
  igst                    NUMERIC,
  "cgstRate"              NUMERIC,
  "sgstRate"              NUMERIC,
  "igstRate"              NUMERIC,
  currency                TEXT DEFAULT 'INR',
  timestamp               TIMESTAMPTZ DEFAULT NOW(),
  "hsnSacCode"            TEXT,
  "companyGstin"          TEXT,
  "companyName"           TEXT,
  "companyAddress"        TEXT,
  status                  TEXT DEFAULT 'paid',
  "customerGstin"         TEXT,
  "customerBillingAddress" TEXT,
  razorpay_order_id       TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  "targetAudience" JSONB,
  "authorId"       UUID REFERENCES public.users(id),
  "authorName"     TEXT,
  "createdAt"      TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ DEFAULT NOW(),
  "isPublished"    BOOLEAN DEFAULT TRUE,
  priority         TEXT DEFAULT 'normal'
);

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT NOT NULL,
  subject   TEXT,
  message   TEXT NOT NULL,
  status    TEXT DEFAULT 'new',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blocked_visitors (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  premise_id   UUID REFERENCES public.premises(id) ON DELETE CASCADE,
  visitor_id   UUID REFERENCES public.users(id) ON DELETE CASCADE,
  visitor_name TEXT,
  reason       TEXT,
  blocked_by   UUID REFERENCES public.users(id),
  blocked_by_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(premise_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS public.host_blocks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "hostId"      UUID REFERENCES public.users(id),
  "visitorId"   UUID REFERENCES public.users(id),
  "visitorName" TEXT,
  reason        TEXT,
  "blockedBy"   UUID REFERENCES public.users(id),
  "blockedByName" TEXT,
  "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ratings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "visitId"   UUID REFERENCES public.visits(id),
  "visitorId" UUID REFERENCES public.users(id),
  "hostId"    UUID REFERENCES public.users(id),
  "premiseId" UUID REFERENCES public.premises(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback    TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_otps (
  id        UUID PRIMARY KEY REFERENCES public.users(id),
  otp       TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_ledger_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "agentId"   UUID REFERENCES public.users(id),
  amount      NUMERIC NOT NULL,
  type        TEXT NOT NULL,
  description TEXT,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  "premiseId" UUID REFERENCES public.premises(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id    UUID REFERENCES public.users(id),
  referred_id    UUID REFERENCES public.users(id),
  status         TEXT DEFAULT 'pending',
  reward_tokens  INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.premise_applications (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  premise_name      TEXT NOT NULL,
  premise_address   TEXT NOT NULL,
  city_id           TEXT,
  city_name         TEXT,
  city_state        TEXT,
  category_id       TEXT,   -- NOTE: snake_case (this table uses snake_case unlike premises)
  category_name     TEXT,
  owner_email       TEXT NOT NULL,
  owner_id          TEXT,
  agent_user_id     TEXT,
  agent_name        TEXT,
  agent_email       TEXT,
  submitted_by      TEXT,
  reviewed_by       TEXT,
  rejection_reason  TEXT,
  created_premise_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.premise_gates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id  UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.premise_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id  UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('host', 'gatekeeper')),
  identity    TEXT,
  gate_id     UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(premise_id, user_id, role)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FOREIGN KEY ADDITIONS (after all tables exist)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS checkin_gate_id UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkout_gate_id UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INDEXES (performance)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_premises_owner_id          ON public.premises(owner_id);
CREATE INDEX IF NOT EXISTS idx_premises_agent_id          ON public.premises(agent_id);
CREATE INDEX IF NOT EXISTS idx_premises_category_id       ON public.premises("categoryId");
CREATE INDEX IF NOT EXISTS idx_visits_visitor_id          ON public.visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_premise_id          ON public.visits(premise_id);
CREATE INDEX IF NOT EXISTS idx_visits_checkin_gate        ON public.visits(checkin_gate_id);
CREATE INDEX IF NOT EXISTS idx_visits_checkout_gate       ON public.visits(checkout_gate_id);
CREATE INDEX IF NOT EXISTS idx_logs_actor_id              ON public.logs("actorId");
CREATE INDEX IF NOT EXISTS idx_logs_premise_id            ON public.logs("premiseId");
CREATE INDEX IF NOT EXISTS idx_logs_timestamp             ON public.logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cities_district_id         ON public.cities("districtId");
CREATE INDEX IF NOT EXISTS idx_cities_state_id            ON public.cities("stateId");
CREATE INDEX IF NOT EXISTS idx_districts_state_id         ON public.districts("stateId");
CREATE INDEX IF NOT EXISTS idx_premise_members_premise    ON public.premise_members(premise_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_user       ON public.premise_members(user_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_role       ON public.premise_members(role);
CREATE INDEX IF NOT EXISTS idx_premise_members_gate_id    ON public.premise_members(gate_id);
CREATE INDEX IF NOT EXISTS idx_premise_gates_premise      ON public.premise_gates(premise_id);
CREATE INDEX IF NOT EXISTS idx_ratings_visitor_id         ON public.ratings("visitorId");
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id      ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id           ON public.invoices("userId");


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('visitor-snapshots', 'visitor-snapshots', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('premises', 'premises', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('bills', 'bills', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', FALSE) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY IF NOT EXISTS "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "snapshots_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'visitor-snapshots');
CREATE POLICY IF NOT EXISTS "premises_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'premises');


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- is_admin() — used in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- set_updated_at() — auto-update trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Attach trigger to premises
DROP TRIGGER IF EXISTS premises_set_updated_at ON public.premises;
CREATE TRIGGER premises_set_updated_at
  BEFORE UPDATE ON public.premises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Premise member count helpers
CREATE OR REPLACE FUNCTION increment_gatekeeper_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET gatekeeper_count = COALESCE(gatekeeper_count, 0) + 1 WHERE id = premise_id_param; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrement_gatekeeper_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET gatekeeper_count = GREATEST(0, COALESCE(gatekeeper_count, 0) - 1) WHERE id = premise_id_param; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_host_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET host_count = COALESCE(host_count, 0) + 1 WHERE id = premise_id_param; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrement_host_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET host_count = GREATEST(0, COALESCE(host_count, 0) - 1) WHERE id = premise_id_param; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Searchable premise member lookup
CREATE OR REPLACE FUNCTION search_premise_members(
  premise_id_param UUID,
  role_param TEXT DEFAULT NULL,
  search_term_param TEXT DEFAULT '',
  limit_param INT DEFAULT 50,
  offset_param INT DEFAULT 0
)
RETURNS TABLE (
  id UUID, premise_id UUID, user_id UUID, role TEXT, identity TEXT, gate_id UUID,
  is_active BOOLEAN, created_at TIMESTAMPTZ, user_name TEXT, user_email TEXT, user_photo_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pm.id, pm.premise_id, pm.user_id, pm.role, pm.identity, pm.gate_id,
    pm.is_active, pm.created_at, u.name, u.email, u.photo_url
  FROM premise_members pm
  JOIN users u ON pm.user_id = u.id
  WHERE pm.premise_id = premise_id_param
    AND (role_param IS NULL OR pm.role = role_param)
    AND (search_term_param = '' OR u.name ILIKE '%' || search_term_param || '%'
         OR u.email ILIKE '%' || search_term_param || '%'
         OR pm.identity ILIKE '%' || search_term_param || '%')
  ORDER BY pm.created_at DESC
  LIMIT limit_param OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ATOMIC RPC: APPROVE PREMISE APPLICATION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_premise_application(
  p_application_id UUID,
  p_category_id UUID,
  p_admin_id UUID,
  p_admin_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app           premise_applications%ROWTYPE;
  v_owner         users%ROWTYPE;
  v_category      premise_categories%ROWTYPE;
  v_settings      settings%ROWTYPE;
  v_premise_id    UUID := gen_random_uuid();
  v_current_roles JSONB;
  v_updated_roles JSONB;
BEGIN
  SELECT * INTO v_app FROM premise_applications
  WHERE id = p_application_id::TEXT AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found or already processed.');
  END IF;

  SELECT * INTO v_category FROM premise_categories WHERE id = p_category_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected category not found.');
  END IF;

  SELECT * INTO v_owner FROM users WHERE email = v_app.owner_email;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner account not found for email: ' || v_app.owner_email);
  END IF;

  SELECT * INTO v_settings FROM settings WHERE id = 'global';

  IF v_app.agent_user_id IS NOT NULL THEN
    INSERT INTO agents (id, name, phone, city, commission_balance)
    VALUES (v_app.agent_user_id::UUID, COALESCE(v_app.agent_name, 'Unknown Agent'), '', COALESCE(v_app.city_name, 'Unknown'), 0)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO premises (id, name, address, city, "cityId", city_state, is_active, owner_id, "ownerName",
    agent_id, "categoryId", "categoryName", staff, host_count, gatekeeper_count, token_balance)
  VALUES (v_premise_id, v_app.premise_name, v_app.premise_address, COALESCE(v_app.city_name, ''),
    v_app.city_id, COALESCE(v_app.city_state, 'Unknown'), true, v_owner.id, v_owner.name,
    v_app.agent_user_id::UUID, v_category.id::TEXT, v_category.name,
    '[]'::JSONB, 0, 0, COALESCE(v_settings.starting_token_owner, 0));

  v_current_roles := COALESCE(v_owner.premise_roles, '{}'::JSONB);
  v_updated_roles := jsonb_set(v_current_roles, ARRAY[v_premise_id::TEXT],
    COALESCE(v_current_roles->v_premise_id::TEXT, '[]'::JSONB) || '["owner"]'::JSONB);
  UPDATE users SET premise_roles = v_updated_roles WHERE id = v_owner.id;

  UPDATE premise_applications SET status = 'approved', reviewed_by = p_admin_id::TEXT,
    reviewed_at = NOW(), created_premise_id = v_premise_id::TEXT
  WHERE id = p_application_id::TEXT;

  RETURN jsonb_build_object('success', true, 'premise_id', v_premise_id, 'owner_id', v_owner.id,
    'owner_phone', v_owner.phone, 'agent_user_id', v_app.agent_user_id,
    'agent_name', v_app.agent_name, 'agent_email', v_app.agent_email,
    'premise_name', v_app.premise_name);

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'approve_premise_application failed for application %: %', p_application_id, SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION approve_premise_application(UUID, UUID, UUID, TEXT) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premise_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premise_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premise_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Shared read access (service_role bypasses this for writes)
CREATE POLICY "read_users"               ON public.users               FOR SELECT USING (true);
CREATE POLICY "read_premises"            ON public.premises            FOR SELECT USING (true);
CREATE POLICY "read_premise_categories"  ON public.premise_categories  FOR SELECT USING (true);
CREATE POLICY "read_visits"              ON public.visits              FOR SELECT USING (true);
CREATE POLICY "read_logs"                ON public.logs                FOR SELECT USING (true);
CREATE POLICY "read_checkin_tokens"      ON public.checkin_tokens      FOR SELECT USING (true);
CREATE POLICY "read_announcements"       ON public.announcements       FOR SELECT USING (true);
CREATE POLICY "read_settings"            ON public.settings            FOR SELECT USING (true);
CREATE POLICY "read_states"              ON public.states              FOR SELECT USING (true);
CREATE POLICY "read_districts"           ON public.districts           FOR SELECT USING (true);
CREATE POLICY "read_cities"              ON public.cities              FOR SELECT USING (true);
CREATE POLICY "read_agents"              ON public.agents              FOR SELECT USING (true);
CREATE POLICY "read_premise_gates"       ON public.premise_gates       FOR SELECT USING (true);
CREATE POLICY "read_premise_members"     ON public.premise_members     FOR SELECT USING (true);
CREATE POLICY "read_applications"        ON public.premise_applications FOR SELECT USING (public.is_admin());

-- User self-update
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Invoices: user sees own, admin sees all
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING ("userId" = auth.uid() OR public.is_admin());

-- Admin-only write access
CREATE POLICY "premises_insert"       ON public.premises           FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "premises_update"       ON public.premises           FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "premises_delete"       ON public.premises           FOR DELETE USING (public.is_admin());
CREATE POLICY "categories_insert"     ON public.premise_categories FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "categories_update"     ON public.premise_categories FOR UPDATE USING (public.is_admin());
CREATE POLICY "categories_delete"     ON public.premise_categories FOR DELETE USING (public.is_admin());
CREATE POLICY "cities_insert"         ON public.cities             FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "cities_update"         ON public.cities             FOR UPDATE USING (public.is_admin());
CREATE POLICY "districts_insert"      ON public.districts          FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "districts_update"      ON public.districts          FOR UPDATE USING (public.is_admin());
CREATE POLICY "states_insert"         ON public.states             FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "states_update"         ON public.states             FOR UPDATE USING (public.is_admin());
CREATE POLICY "announcements_insert"  ON public.announcements      FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "announcements_update"  ON public.announcements      FOR UPDATE USING (public.is_admin());
CREATE POLICY "announcements_delete"  ON public.announcements      FOR DELETE USING (public.is_admin());

-- Premise gates/members: owner controls
CREATE POLICY "gates_insert"   ON public.premise_gates   FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM premises WHERE id = premise_id AND owner_id = auth.uid()));
CREATE POLICY "gates_update"   ON public.premise_gates   FOR UPDATE USING    (EXISTS (SELECT 1 FROM premises WHERE id = premise_id AND owner_id = auth.uid()));
CREATE POLICY "gates_delete"   ON public.premise_gates   FOR DELETE USING    (EXISTS (SELECT 1 FROM premises WHERE id = premise_id AND owner_id = auth.uid()));
CREATE POLICY "members_insert" ON public.premise_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM premises WHERE id = premise_id AND owner_id = auth.uid()));
CREATE POLICY "members_update" ON public.premise_members FOR UPDATE USING    (EXISTS (SELECT 1 FROM premises WHERE id = premise_id AND owner_id = auth.uid()));
CREATE POLICY "members_delete" ON public.premise_members FOR DELETE USING    (EXISTS (SELECT 1 FROM premises WHERE id = premise_id AND owner_id = auth.uid()));

-- Service role grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON public.premise_gates TO postgres;
GRANT ALL ON public.premise_members TO postgres;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. pg_cron TTL JOBS (enable pg_cron in Supabase Extensions first!)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('delete-expired-logs',           '0 0 * * *', $$ DELETE FROM public.logs WHERE "expiresAt" < NOW(); $$);
SELECT cron.schedule('delete-expired-checkin-tokens', '0 0 * * *', $$ DELETE FROM public.checkin_tokens WHERE "expiresAt" < NOW(); $$);
SELECT cron.schedule('delete-expired-visits',         '0 1 * * *', $$ DELETE FROM public.visits WHERE checkout_time IS NOT NULL AND checkout_time < NOW() - INTERVAL '90 days'; $$);


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- Global settings row (must exist for the app to start)
INSERT INTO public.settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- Default premise categories
INSERT INTO public.premise_categories (name, type, deduction_rate_visitor, deduction_rate_premise)
VALUES
  ('Residential Society', 'residential', 1, 1),
  ('Industrial / Factory', 'industrial', 1, 2),
  ('Commercial / Office', 'standard', 1, 1)
ON CONFLICT DO NOTHING;

/*
  [COUNTRY_CONFIG] — FIRST ADMIN USER
  After a user signs up, run this to grant them admin:
  UPDATE public.users SET role = 'admin' WHERE email = 'your-admin@email.com';
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. REALTIME (enable publications)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Safely add tables to the realtime publication if not already there
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'premises') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.premises;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'visits') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'users') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'premise_applications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.premise_applications;
  END IF;
END $$;


-- █ DONE █ All tables, RLS, functions, and seed data created successfully.
