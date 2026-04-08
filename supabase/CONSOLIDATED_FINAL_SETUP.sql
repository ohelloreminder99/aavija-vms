-- =============================================================================
-- AAVIJA VMS — CONSOLIDATED MASTER DATABASE SETUP (V8 — snake_case Clean)
-- Generated: 2026-04-08
-- Run this in Supabase SQL Editor on a FRESH project.
-- Prerequisites: Enable extensions pgcrypto, uuid-ossp, pg_cron in Supabase Dashboard.
-- This script is idempotent (safe to run multiple times).
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 0: EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: CORE TABLES (all columns use snake_case)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                          UUID PRIMARY KEY, -- Matches Supabase Auth ID
  name                        TEXT NOT NULL,
  email                       TEXT UNIQUE NOT NULL,
  role                        TEXT NOT NULL DEFAULT 'visitor',
  phone                       TEXT,
  country_code                TEXT,
  is_verified                 BOOLEAN DEFAULT FALSE,
  is_active                   BOOLEAN DEFAULT TRUE,
  is_agent                    BOOLEAN DEFAULT FALSE,
  token_balance_visitor       INTEGER DEFAULT 0,
  global_rating               NUMERIC DEFAULT 5.0,
  active_checkin_id           UUID,
  photo_url                   TEXT,
  city                        TEXT,
  city_id                     TEXT,
  city_state                  TEXT,
  company_name                TEXT,
  premise_roles               JSONB DEFAULT '{}'::JSONB,
  vehicles                    JSONB,
  selected_vehicle_number     TEXT,
  products                    JSONB,
  gst_number                  TEXT,
  billing_address             TEXT,
  legal_name                  TEXT,
  billing_state               TEXT,
  action_timestamps           JSONB DEFAULT '{}'::JSONB,
  agent_commission_balance    NUMERIC DEFAULT 0,
  agent_payout_upi            TEXT,
  pan_number                  TEXT,
  pan_card_url                TEXT,
  kyc_verified                BOOLEAN DEFAULT FALSE,
  referral_code               TEXT,
  referred_by                 TEXT,
  referral_commission_balance NUMERIC DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── STATES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.states (
  id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- ── DISTRICTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.districts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  state_name TEXT NOT NULL,
  state_id   UUID REFERENCES public.states(id) ON DELETE CASCADE
);

-- ── CITIES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cities (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  district_name TEXT NOT NULL,
  state_name    TEXT NOT NULL,
  district_id   UUID REFERENCES public.districts(id) ON DELETE CASCADE,
  state_id      UUID REFERENCES public.states(id) ON DELETE CASCADE
);

-- ── AGENTS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  phone              TEXT NOT NULL,
  city               TEXT NOT NULL,
  commission_balance NUMERIC DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── PREMISE CATEGORIES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premise_categories (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL,
  deduction_rate_visitor NUMERIC DEFAULT 0,
  deduction_rate_premise NUMERIC DEFAULT 0,
  pdf_export_cost       NUMERIC DEFAULT 0,
  csv_export_cost       NUMERIC DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── PREMISES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premises (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                       TEXT NOT NULL,
  address                    TEXT NOT NULL,
  city                       TEXT NOT NULL,
  city_id                    TEXT,
  city_state                 TEXT,
  is_active                  BOOLEAN DEFAULT TRUE,
  owner_id                   UUID REFERENCES public.users(id) ON DELETE CASCADE,
  owner_name                 TEXT,
  token_balance              INTEGER DEFAULT 0,
  agent_id                   UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  category_id                UUID,
  category_name              TEXT,
  host_count                 INTEGER DEFAULT 0,
  gatekeeper_count           INTEGER DEFAULT 0,
  gate_count                 INTEGER DEFAULT 0,
  staff                      JSONB,
  gst_number                 TEXT,
  billing_address            TEXT,
  legal_name                 TEXT,
  billing_state              TEXT,
  require_host_verification  BOOLEAN DEFAULT FALSE,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ── VISITS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visits (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id          UUID REFERENCES public.users(id),
  visitor_name        TEXT,
  host_id             UUID REFERENCES public.users(id),
  host_name           TEXT,
  premise_id          UUID REFERENCES public.premises(id) ON DELETE CASCADE,
  checkin_time        TIMESTAMPTZ DEFAULT NOW(),
  checkout_time       TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  vehicle_details     JSONB,
  visitor_snapshot_url TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  host_verified       BOOLEAN DEFAULT FALSE,
  host_verified_at    TIMESTAMPTZ,
  host_verified_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  checkin_gate_id     UUID,
  checkout_gate_id    UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOGS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id     UUID,
  actor_name   TEXT,
  actor_role   TEXT,
  action       TEXT NOT NULL,
  timestamp    TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  description  TEXT,
  token_change INTEGER,
  premise_id   UUID REFERENCES public.premises(id) ON DELETE CASCADE,
  context      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── CHECKIN TOKENS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checkin_tokens (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id   UUID REFERENCES public.users(id),
  visitor_name TEXT,
  host_id      UUID REFERENCES public.users(id),
  premise_id   UUID REFERENCES public.premises(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'unused',
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVOICES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id           TEXT PRIMARY KEY,
  user_id      UUID REFERENCES public.users(id),
  user_name    TEXT,
  user_email   TEXT,
  user_phone   TEXT,
  user_state   TEXT,
  premise_id   UUID REFERENCES public.premises(id) ON DELETE CASCADE,
  token_amount NUMERIC,
  amount       NUMERIC DEFAULT 0,
  subtotal     NUMERIC DEFAULT 0,
  gst_amount   NUMERIC,
  total_amount NUMERIC,
  status       TEXT DEFAULT 'pending',
  pdf_url      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  paid_at      TIMESTAMPTZ
);

-- ── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  target_audience JSONB,
  author_id       UUID REFERENCES public.users(id),
  author_name     TEXT,
  is_published    BOOLEAN DEFAULT TRUE,
  priority        TEXT DEFAULT 'normal',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONTACT SUBMISSIONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RATINGS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ratings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id   UUID REFERENCES public.visits(id),
  visitor_id UUID REFERENCES public.users(id),
  host_id    UUID REFERENCES public.users(id),
  premise_id UUID REFERENCES public.premises(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL,
  feedback   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── BLOCKED VISITORS (Premise-level) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premise_blocked_visitors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id       UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  visitor_id       UUID NOT NULL,
  blocked_at       TIMESTAMPTZ DEFAULT NOW(),
  blocked_by       UUID NOT NULL,
  visitor_name     TEXT NOT NULL,
  visitor_photo_url TEXT,
  UNIQUE(premise_id, visitor_id)
);

-- ── BLOCKED VISITORS (Host-level) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.host_blocked_visitors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visitor_id       UUID NOT NULL,
  premise_id       UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  blocked_at       TIMESTAMPTZ DEFAULT NOW(),
  blocked_by       UUID NOT NULL,
  visitor_name     TEXT NOT NULL,
  visitor_photo_url TEXT,
  UNIQUE(host_id, visitor_id, premise_id)
);

-- ── AGENT LEDGER ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type          TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount        NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  description   TEXT,
  context       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PREMISE APPLICATIONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premise_applications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status             TEXT NOT NULL DEFAULT 'pending'
                       CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),
  premise_name       TEXT NOT NULL,
  premise_address    TEXT NOT NULL,
  city_id            UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  city_name          TEXT,
  city_state         TEXT,
  category_id        UUID REFERENCES public.premise_categories(id) ON DELETE SET NULL,
  category_name      TEXT,
  owner_email        TEXT NOT NULL,
  owner_id           UUID,
  agent_user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  agent_name         TEXT,
  agent_email        TEXT,
  submitted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason   TEXT,
  created_premise_id UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at        TIMESTAMPTZ
);

-- ── PREMISE GATES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premise_gates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id  UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PREMISE MEMBERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premise_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id UUID NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('host', 'gatekeeper')),
  identity   TEXT,
  gate_id    UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(premise_id, user_id, role)
);

-- ── RATE LIMITS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key             TEXT PRIMARY KEY,
  request_count   INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  reset_at        TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 minute'
);

-- ── SETTINGS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id                             TEXT PRIMARY KEY,
  -- History & TTL
  log_ttl_days                   INTEGER DEFAULT 30,
  history_days_admin             INTEGER DEFAULT 30,
  history_days_owner             INTEGER DEFAULT 30,
  history_days_host              INTEGER DEFAULT 7,
  history_days_gatekeeper        INTEGER DEFAULT 1,
  history_days_staff             NUMERIC DEFAULT 1,
  history_days_visitor           NUMERIC DEFAULT 1,
  visit_ttl_days                 NUMERIC DEFAULT 30,
  -- Token Economy
  checkin_cost                   INTEGER DEFAULT 1,
  whatsapp_notification_cost     INTEGER DEFAULT 1,
  starting_token_visitor         NUMERIC DEFAULT 0,
  starting_token_owner           NUMERIC DEFAULT 0,
  low_token_threshold            NUMERIC DEFAULT 10,
  hide_token_economy             BOOLEAN DEFAULT FALSE,
  show_token_card_visitor        BOOLEAN DEFAULT TRUE,
  token_exchange_rate            NUMERIC DEFAULT 1,
  max_daily_token_purchase       NUMERIC DEFAULT 1000,
  -- Export costs
  export_history_days_owner      NUMERIC DEFAULT 30,
  export_history_days_host       NUMERIC DEFAULT 7,
  export_history_days_visitor    NUMERIC DEFAULT 7,
  pdf_export_cost_host           NUMERIC DEFAULT 1,
  csv_export_cost_host           NUMERIC DEFAULT 1,
  pdf_export_cost_visitor        NUMERIC DEFAULT 1,
  csv_export_cost_visitor        NUMERIC DEFAULT 1,
  -- Action costs
  mobile_verification_cost       NUMERIC DEFAULT 1,
  star_rating_cost               NUMERIC DEFAULT 1,
  block_visitor_cost             NUMERIC DEFAULT 1,
  unblock_visitor_cost           NUMERIC DEFAULT 1,
  block_visitor_cost_host        NUMERIC DEFAULT 1,
  unblock_visitor_cost_host      NUMERIC DEFAULT 1,
  -- Commission & Agent
  agent_commission_percent       NUMERIC DEFAULT 10,
  agent_commission_rate          NUMERIC DEFAULT 10,
  payout_threshold_agent         NUMERIC DEFAULT 500,
  payout_threshold_referrer      NUMERIC DEFAULT 500,
  token_conversion_rate          NUMERIC DEFAULT 1,
  payout_method_note             TEXT,
  -- Referral
  referral_enabled               BOOLEAN DEFAULT FALSE,
  referral_reward_tokens         NUMERIC DEFAULT 10,
  referral_commission_rate       NUMERIC DEFAULT 0.05,
  referral_min_purchase_tokens   NUMERIC DEFAULT 50,
  referral_first_purchase_only   BOOLEAN DEFAULT TRUE,
  -- TDS
  tds_enabled                    BOOLEAN DEFAULT FALSE,
  tds_rate                       NUMERIC DEFAULT 10,
  tds_annual_exemption           NUMERIC DEFAULT 30000,
  -- Billing
  currency                       TEXT DEFAULT 'INR',
  gst_rate                       NUMERIC DEFAULT 18,
  company_gstin                  TEXT,
  company_name_billing           TEXT,
  company_address_billing        TEXT,
  company_state_billing          TEXT,
  hsn_sac_code                   TEXT,
  cgst_rate_default              NUMERIC DEFAULT 9,
  sgst_rate_default              NUMERIC DEFAULT 9,
  igst_rate_default              NUMERIC DEFAULT 18,
  -- Rate Limiting
  auth_rate_limit                INTEGER DEFAULT 10,
  checkin_rate_limit             INTEGER DEFAULT 100,
  whatsapp_rate_limit            INTEGER DEFAULT 500,
  emergency_access_timeout_mins  INTEGER DEFAULT 30,
  otp_request_limit_hourly       NUMERIC DEFAULT 5,
  -- Maintenance
  is_maintenance_mode            BOOLEAN DEFAULT FALSE,
  maintenance_message            TEXT DEFAULT 'System is undergoing maintenance. Please try again later.',
  -- i18n & Country
  default_country_code           TEXT DEFAULT '+91',
  phone_number_length            NUMERIC DEFAULT 10,
  allow_unverified_checkin       BOOLEAN DEFAULT FALSE,
  -- WhatsApp Templates
  whatsapp_phone_number_id       TEXT,
  wa_template_host_notified      TEXT DEFAULT 'aavija_host_notified',
  wa_template_payout_approved    TEXT DEFAULT 'aavija_payout_approved',
  wa_template_payout_rejected    TEXT DEFAULT 'aavija_payout_rejected',
  wa_template_kyc_verified       TEXT DEFAULT 'aavija_kyc_verified',
  wa_template_tokens_converted   TEXT DEFAULT 'aavija_tokens_converted',
  wa_template_referral_commission TEXT DEFAULT 'aavija_referral_commission',
  wa_template_threshold_reached  TEXT DEFAULT 'aavija_threshold_reached',
  wa_template_phone_verify       TEXT DEFAULT 'aavija_phone_verify',
  wa_template_agent_assigned     TEXT DEFAULT 'aavija_agent_assigned',
  -- Branding
  brand_name                     TEXT DEFAULT 'Aavija',
  brand_tagline                  TEXT DEFAULT 'Visitor Management Ecosystem',
  support_email                  TEXT,
  support_phone                  TEXT,
  razorpay_key_id                TEXT,
  -- Timestamps
  created_at                     TIMESTAMPTZ DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ DEFAULT NOW()
);

-- ── WHATSAPP OTPs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_otps (
  id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  otp        TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── REFERRALS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.users(id),
  referee_id  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAYOUT REQUESTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.users(id),
  amount     NUMERIC NOT NULL,
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROLES ADMIN (Legacy helper table) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles_admin (
  id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  is_admin   BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── REGIONS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('visitor-snapshots', 'visitor-snapshots', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('premises', 'premises', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('bills', 'bills', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_cities_district_id       ON public.cities(district_id);
CREATE INDEX IF NOT EXISTS idx_cities_state_id          ON public.cities(state_id);
CREATE INDEX IF NOT EXISTS idx_districts_state_id       ON public.districts(state_id);
CREATE INDEX IF NOT EXISTS idx_premises_owner_id        ON public.premises(owner_id);
CREATE INDEX IF NOT EXISTS idx_premises_agent_id        ON public.premises(agent_id);
CREATE INDEX IF NOT EXISTS idx_ratings_visitor_id       ON public.ratings(visitor_id);
CREATE INDEX IF NOT EXISTS idx_premise_gates_premise     ON public.premise_gates(premise_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_premise   ON public.premise_members(premise_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_user      ON public.premise_members(user_id);
CREATE INDEX IF NOT EXISTS idx_premise_members_role      ON public.premise_members(role);
CREATE INDEX IF NOT EXISTS idx_premise_members_gate_id   ON public.premise_members(gate_id);
CREATE INDEX IF NOT EXISTS idx_visits_checkin_gate       ON public.visits(checkin_gate_id);
CREATE INDEX IF NOT EXISTS idx_visits_checkout_gate      ON public.visits(checkout_gate_id);
CREATE INDEX IF NOT EXISTS idx_visits_host_verified_at   ON public.visits(host_verified_at);
CREATE INDEX IF NOT EXISTS idx_visits_host_verified_by   ON public.visits(host_verified_by);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at      ON public.rate_limits(reset_at);
CREATE INDEX IF NOT EXISTS idx_premise_applications_status ON public.premise_applications(status, created_at DESC);

-- Add FK from visits to premise_gates (deferred since gates table comes after visits)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visits_checkin_gate_id_fkey') THEN
    ALTER TABLE public.visits ADD CONSTRAINT visits_checkin_gate_id_fkey FOREIGN KEY (checkin_gate_id) REFERENCES public.premise_gates(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visits_checkout_gate_id_fkey') THEN
    ALTER TABLE public.visits ADD CONSTRAINT visits_checkout_gate_id_fkey FOREIGN KEY (checkout_gate_id) REFERENCES public.premise_gates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: FUNCTIONS & RPCs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Admin check helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- PII Encryption key
CREATE OR REPLACE FUNCTION public.get_encryption_key() RETURNS TEXT AS $$
BEGIN RETURN 'AavijaSecureKey2026!!'; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Encrypt PII
CREATE OR REPLACE FUNCTION public.encrypt_pii(p_data TEXT) RETURNS TEXT AS $$
BEGIN
  IF p_data IS NULL OR p_data = '' THEN RETURN p_data; END IF;
  RETURN encode(pgp_sym_encrypt(p_data, public.get_encryption_key()), 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, extensions;

-- Decrypt PII
CREATE OR REPLACE FUNCTION public.decrypt_pii(p_encoded_data TEXT) RETURNS TEXT AS $$
BEGIN
  IF p_encoded_data IS NULL OR p_encoded_data = '' THEN RETURN p_encoded_data; END IF;
  BEGIN
    RETURN pgp_sym_decrypt(decode(p_encoded_data, 'base64'), public.get_encryption_key());
  EXCEPTION WHEN OTHERS THEN RETURN p_encoded_data;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, extensions;

-- PII Encryption trigger
CREATE OR REPLACE FUNCTION public.trig_encrypt_user_pii() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.phone <> OLD.phone) THEN
    NEW.phone := public.encrypt_pii(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tr_encrypt_user_pii ON public.users;
CREATE TRIGGER tr_encrypt_user_pii
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trig_encrypt_user_pii();

-- Decrypted users view
CREATE OR REPLACE VIEW public.decrypted_users
WITH (security_invoker = true) AS
SELECT *, public.decrypt_pii(phone) as decrypted_phone FROM public.users;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS premises_set_updated_at ON public.premises;
CREATE TRIGGER premises_set_updated_at
  BEFORE UPDATE ON public.premises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rate limiter
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT, p_max_requests INTEGER, p_window_interval INTERVAL DEFAULT INTERVAL '1 minute'
) RETURNS BOOLEAN AS $$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits (key, request_count, last_request_at, reset_at)
  VALUES (p_key, 1, NOW(), NOW() + p_window_interval)
  ON CONFLICT (key) DO UPDATE SET
    request_count = CASE WHEN public.rate_limits.reset_at < NOW() THEN 1 ELSE public.rate_limits.request_count + 1 END,
    reset_at = CASE WHEN public.rate_limits.reset_at < NOW() THEN NOW() + p_window_interval ELSE public.rate_limits.reset_at END,
    last_request_at = NOW()
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Search premise members
CREATE OR REPLACE FUNCTION public.search_premise_members(
  premise_id_param UUID, role_param TEXT DEFAULT NULL,
  search_term_param TEXT DEFAULT '', limit_param INT DEFAULT 50, offset_param INT DEFAULT 0
) RETURNS TABLE (
  id UUID, premise_id UUID, user_id UUID, role TEXT, identity TEXT, gate_id UUID,
  is_active BOOLEAN, created_at TIMESTAMPTZ, user_name TEXT, user_email TEXT, user_photo_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pm.id, pm.premise_id, pm.user_id, pm.role, pm.identity, pm.gate_id,
         pm.is_active, pm.created_at, u.name as user_name, u.email as user_email, u.photo_url as user_photo_url
  FROM premise_members pm JOIN users u ON pm.user_id = u.id
  WHERE pm.premise_id = premise_id_param
    AND (role_param IS NULL OR pm.role = role_param)
    AND (search_term_param = '' OR u.name ILIKE '%' || search_term_param || '%' OR u.email ILIKE '%' || search_term_param || '%' OR pm.identity ILIKE '%' || search_term_param || '%')
  ORDER BY pm.created_at DESC LIMIT limit_param OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Gatekeeper/Host counter RPCs
CREATE OR REPLACE FUNCTION public.increment_gatekeeper_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET gatekeeper_count = COALESCE(gatekeeper_count, 0) + 1 WHERE id = premise_id_param; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrement_gatekeeper_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET gatekeeper_count = GREATEST(0, COALESCE(gatekeeper_count, 0) - 1) WHERE id = premise_id_param; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.increment_host_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET host_count = COALESCE(host_count, 0) + 1 WHERE id = premise_id_param; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrement_host_count(premise_id_param UUID) RETURNS VOID AS $$
BEGIN UPDATE premises SET host_count = GREATEST(0, COALESCE(host_count, 0) - 1) WHERE id = premise_id_param; END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Host blocked list
CREATE OR REPLACE FUNCTION public.get_host_blocked_list(p_host_id UUID, p_premise_id UUID)
RETURNS TABLE (
  id UUID, visitor_id UUID, host_id UUID, premise_id UUID,
  visitor_name TEXT, visitor_photo_url TEXT, blocked_at TIMESTAMPTZ, blocked_by UUID
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT h.id, h.visitor_id, h.host_id, h.premise_id, h.visitor_name,
    h.visitor_photo_url, h.blocked_at, h.blocked_by
  FROM public.host_blocked_visitors h
  WHERE h.host_id = p_host_id AND h.premise_id = p_premise_id ORDER BY h.blocked_at DESC;
END;
$$;

-- Block visitor (premise)
CREATE OR REPLACE FUNCTION public.rpc_block_visitor_premise(
  p_premise_id UUID, p_visitor_id UUID, p_block_cost INTEGER, p_actor_id UUID,
  p_actor_name TEXT, p_actor_role TEXT, p_visitor_name TEXT, p_visitor_photo TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_balance INTEGER;
BEGIN
  SELECT token_balance INTO v_current_balance FROM public.premises WHERE id = p_premise_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Premise not found.'); END IF;
  IF v_current_balance < p_block_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE public.premises SET token_balance = v_current_balance - p_block_cost WHERE id = p_premise_id;
  INSERT INTO public.premise_blocked_visitors (visitor_id, premise_id, visitor_name, visitor_photo_url, blocked_at, blocked_by)
  VALUES (p_visitor_id, p_premise_id, p_visitor_name, p_visitor_photo, NOW(), p_actor_id)
  ON CONFLICT (visitor_id, premise_id) DO UPDATE SET visitor_photo_url = p_visitor_photo, blocked_at = NOW();
  INSERT INTO public.logs (actor_id, actor_name, actor_role, action, description, token_change, timestamp, context, expires_at)
  VALUES (p_actor_id, p_actor_name, p_actor_role, 'PREMISE_BLOCK_VISITOR', 'Blocked visitor ' || p_visitor_name, -p_block_cost, NOW(), jsonb_build_object('premiseId', p_premise_id), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Block visitor (host)
CREATE OR REPLACE FUNCTION public.rpc_block_visitor_host(
  p_host_id UUID, p_visitor_id UUID, p_block_cost INTEGER, p_actor_id UUID,
  p_actor_name TEXT, p_actor_role TEXT, p_visitor_name TEXT, p_visitor_photo TEXT,
  p_premise_id UUID, p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_balance INTEGER;
BEGIN
  SELECT token_balance_visitor INTO v_current_balance FROM public.users WHERE id = p_host_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Host profile not found.'); END IF;
  IF v_current_balance < p_block_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE public.users SET token_balance_visitor = v_current_balance - p_block_cost WHERE id = p_host_id;
  INSERT INTO public.host_blocked_visitors (visitor_id, host_id, premise_id, visitor_name, visitor_photo_url, blocked_at, blocked_by)
  VALUES (p_visitor_id, p_host_id, p_premise_id, p_visitor_name, p_visitor_photo, NOW(), p_actor_id)
  ON CONFLICT (host_id, visitor_id, premise_id) DO UPDATE SET visitor_photo_url = p_visitor_photo, blocked_at = NOW();
  INSERT INTO public.logs (actor_id, actor_name, actor_role, action, description, token_change, timestamp, context, expires_at)
  VALUES (p_actor_id, p_actor_name, p_actor_role, 'HOST_BLOCK_VISITOR', 'Blocked visitor ' || p_visitor_name, -p_block_cost, NOW(), jsonb_build_object('premiseId', p_premise_id), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Unblock visitor (host)
CREATE OR REPLACE FUNCTION public.rpc_unblock_visitor_host(
  p_host_id UUID, p_visitor_id UUID, p_premise_id UUID, p_unblock_cost INTEGER,
  p_actor_id UUID, p_actor_name TEXT, p_actor_role TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_balance INTEGER;
BEGIN
  SELECT token_balance_visitor INTO v_current_balance FROM public.users WHERE id = p_host_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Host profile not found.'); END IF;
  IF v_current_balance < p_unblock_cost THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens.'); END IF;
  UPDATE public.users SET token_balance_visitor = v_current_balance - p_unblock_cost WHERE id = p_host_id;
  DELETE FROM host_blocked_visitors WHERE visitor_id = p_visitor_id AND host_id = p_host_id AND premise_id = p_premise_id;
  INSERT INTO public.logs (actor_id, actor_name, actor_role, action, description, token_change, timestamp, context, expires_at)
  VALUES (p_actor_id, p_actor_name, p_actor_role, 'HOST_UNBLOCK_VISITOR', 'Unblocked visitor (ID: ' || p_visitor_id || ')', -p_unblock_cost, NOW(), jsonb_build_object('premiseId', p_premise_id, 'visitorId', p_visitor_id), p_expires_at);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Approve premise application
CREATE OR REPLACE FUNCTION public.approve_premise_application(
  p_application_id UUID, p_category_id UUID, p_admin_id UUID, p_admin_name TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app           premise_applications%ROWTYPE;
  v_owner         users%ROWTYPE;
  v_category      premise_categories%ROWTYPE;
  v_settings      settings%ROWTYPE;
  v_premise_id    UUID := gen_random_uuid();
  v_agent_id      UUID;
  v_current_roles JSONB;
  v_updated_roles JSONB;
BEGIN
  SELECT * INTO v_app FROM premise_applications WHERE id = p_application_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Application not found or already processed.'); END IF;
  v_agent_id := COALESCE(v_app.agent_user_id, v_app.submitted_by);

  SELECT * INTO v_category FROM premise_categories WHERE id = p_category_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Selected category not found.'); END IF;

  SELECT * INTO v_owner FROM users WHERE email = v_app.owner_email;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Owner account not found for email: ' || v_app.owner_email); END IF;

  SELECT * INTO v_settings FROM settings WHERE id = 'global';

  IF v_agent_id IS NOT NULL THEN
    INSERT INTO agents (id, name, phone, city, commission_balance)
    VALUES (v_agent_id, COALESCE(v_app.agent_name, 'Unknown Agent'), '', COALESCE(v_app.city_name, 'Unknown'), 0)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO premises (id, name, address, city, city_id, city_state, is_active, owner_id, owner_name, agent_id, category_id, category_name, staff, host_count, gatekeeper_count, token_balance)
  VALUES (v_premise_id, v_app.premise_name, v_app.premise_address, COALESCE(v_app.city_name, ''), v_app.city_id::TEXT, COALESCE(v_app.city_state, 'Unknown'), true, v_owner.id, v_owner.name, v_agent_id, v_category.id, v_category.name, '[]'::JSONB, 0, 0, COALESCE(v_settings.starting_token_owner, 0));

  v_current_roles := COALESCE(v_owner.premise_roles, '{}'::JSONB);
  v_updated_roles := jsonb_set(v_current_roles, ARRAY[v_premise_id::TEXT], COALESCE(v_current_roles->v_premise_id::TEXT, '[]'::JSONB) || '["owner"]'::JSONB);
  UPDATE users SET premise_roles = v_updated_roles WHERE id = v_owner.id;

  IF COALESCE(v_settings.starting_token_owner, 0) > 0 THEN
    INSERT INTO logs (actor_id, actor_name, actor_role, action, description, token_change, premise_id, context)
    VALUES (p_admin_id, p_admin_name, 'admin', 'INITIAL_TOKEN_ALLOCATION', 'Welcome Bonus: Premise "' || v_app.premise_name || '" received ' || v_settings.starting_token_owner || ' tokens.', v_settings.starting_token_owner, v_premise_id, jsonb_build_object('premiseId', v_premise_id, 'applicationId', p_application_id));

    INSERT INTO invoices (id, user_id, user_name, user_email, user_phone, user_state, premise_id, token_amount, subtotal, total_amount, status)
    VALUES ('INV-' || v_premise_id::text, v_owner.id, v_owner.name, v_owner.email, COALESCE(v_owner.phone, ''), COALESCE(v_app.city_state, 'Unknown'), v_premise_id, v_settings.starting_token_owner, 0, 0, 'paid');
  END IF;

  UPDATE premise_applications SET status = 'approved', reviewed_by = p_admin_id, reviewed_at = NOW(), created_premise_id = v_premise_id WHERE id = p_application_id;

  RETURN jsonb_build_object('success', true, 'premise_id', v_premise_id, 'premise_name', v_app.premise_name, 'owner_name', v_owner.name, 'owner_phone', v_owner.phone);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'approve_premise_application failed for application %: %', p_application_id, SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Role sync helpers
CREATE OR REPLACE FUNCTION public.sync_user_premise_roles_manual(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE role_map JSONB;
BEGIN
  SELECT jsonb_object_agg(p_id, roles) INTO role_map FROM (
    SELECT p_id, jsonb_agg(DISTINCT role) as roles FROM (
      SELECT premise_id as p_id, role FROM public.premise_members WHERE user_id = p_user_id
      UNION SELECT id as p_id, 'owner' as role FROM public.premises WHERE owner_id = p_user_id
    ) combined GROUP BY p_id
  ) t;
  UPDATE public.users SET premise_roles = COALESCE(role_map, '{}'::jsonb) WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_premise_counters()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.premises p SET
    gatekeeper_count = (SELECT count(*) FROM public.premise_members pm WHERE pm.premise_id = p.id AND pm.role = 'gatekeeper'),
    gate_count = (SELECT count(*) FROM public.premise_gates pg WHERE pg.premise_id = p.id),
    host_count = (SELECT count(*) FROM public.premise_members pm WHERE pm.premise_id = p.id AND pm.role = 'host')
  WHERE p.is_active = true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_premise_application(UUID, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_block_visitor_host(UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_unblock_visitor_host(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on ALL tables
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('spatial_ref_sys')) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Drop all existing policies for clean slate
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- [users]
CREATE POLICY "users_select" ON public.users FOR SELECT USING (id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "users_admin_insert" ON public.users FOR INSERT WITH CHECK (is_admin());

-- [premises]
CREATE POLICY "premises_select" ON public.premises FOR SELECT USING (true);
CREATE POLICY "premises_insert" ON public.premises FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "premises_update" ON public.premises FOR UPDATE USING (is_admin() OR owner_id = (SELECT auth.uid()));
CREATE POLICY "premises_delete" ON public.premises FOR DELETE USING (is_admin());

-- [visits]
CREATE POLICY "visits_select" ON public.visits FOR SELECT USING (
  is_admin() OR visitor_id = (SELECT auth.uid()) OR host_id = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM public.premise_members WHERE user_id = (SELECT auth.uid()) AND premise_id = visits.premise_id AND role = 'gatekeeper') OR
  EXISTS (SELECT 1 FROM public.premises WHERE id = visits.premise_id AND owner_id = (SELECT auth.uid()))
);
CREATE POLICY "visits_insert" ON public.visits FOR INSERT WITH CHECK (
  is_admin() OR EXISTS (SELECT 1 FROM public.premise_members WHERE user_id = (SELECT auth.uid()) AND premise_id = visits.premise_id AND role = 'gatekeeper')
);
CREATE POLICY "visits_update" ON public.visits FOR UPDATE USING (
  is_admin() OR EXISTS (SELECT 1 FROM public.premise_members WHERE user_id = (SELECT auth.uid()) AND premise_id = visits.premise_id AND role = 'gatekeeper')
);
CREATE POLICY "visits_delete" ON public.visits FOR DELETE USING (is_admin());

-- [logs]
CREATE POLICY "logs_select" ON public.logs FOR SELECT USING (is_admin() OR actor_id = (SELECT auth.uid()));

-- [settings]
CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_insert" ON public.settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "settings_admin_update" ON public.settings FOR UPDATE USING (is_admin());
CREATE POLICY "settings_admin_delete" ON public.settings FOR DELETE USING (is_admin());

-- [ratings]
CREATE POLICY "ratings_select" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert" ON public.ratings FOR INSERT WITH CHECK (visitor_id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "ratings_update" ON public.ratings FOR UPDATE USING (visitor_id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "ratings_delete" ON public.ratings FOR DELETE USING (visitor_id = (SELECT auth.uid()) OR is_admin());

-- [premise_blocked_visitors]
CREATE POLICY "premise_blocks_access" ON public.premise_blocked_visitors FOR ALL
  USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));

-- [host_blocked_visitors]
CREATE POLICY "host_blocks_access" ON public.host_blocked_visitors FOR ALL
  USING (host_id = (SELECT auth.uid()) OR is_admin());

-- [referrals]
CREATE POLICY "referrals_select" ON public.referrals FOR SELECT
  USING (referrer_id = (SELECT auth.uid()) OR referee_id = (SELECT auth.uid()) OR is_admin());

-- [payout_requests]
CREATE POLICY "payouts_select" ON public.payout_requests FOR SELECT USING (user_id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "payouts_insert" ON public.payout_requests FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- [static data: states, districts, cities, categories]
CREATE POLICY "states_select" ON public.states FOR SELECT USING (true);
CREATE POLICY "states_admin_write" ON public.states FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "districts_select" ON public.districts FOR SELECT USING (true);
CREATE POLICY "districts_admin_write" ON public.districts FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "cities_select" ON public.cities FOR SELECT USING (true);
CREATE POLICY "cities_admin_write" ON public.cities FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "categories_select" ON public.premise_categories FOR SELECT USING (true);
CREATE POLICY "categories_admin_write" ON public.premise_categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- [agents]
CREATE POLICY "agents_select" ON public.agents FOR SELECT USING (is_admin() OR id = (SELECT auth.uid()));
CREATE POLICY "agents_admin_write" ON public.agents FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- [agent_ledger]
CREATE POLICY "agent_ledger_select" ON public.agent_ledger FOR SELECT USING (is_admin() OR agent_id = (SELECT auth.uid()));
CREATE POLICY "agent_ledger_admin_write" ON public.agent_ledger FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- [announcements]
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements_admin_write" ON public.announcements FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- [checkin_tokens]
CREATE POLICY "tokens_select" ON public.checkin_tokens FOR SELECT USING (true);
CREATE POLICY "tokens_admin_write" ON public.checkin_tokens FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- [contact_submissions]
CREATE POLICY "contact_admin_access" ON public.contact_submissions FOR ALL USING (is_admin());

-- [premise_gates]
CREATE POLICY "gates_select" ON public.premise_gates FOR SELECT USING (true);
CREATE POLICY "gates_insert" ON public.premise_gates FOR INSERT WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));
CREATE POLICY "gates_update" ON public.premise_gates FOR UPDATE USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));
CREATE POLICY "gates_delete" ON public.premise_gates FOR DELETE USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));

-- [premise_members]
CREATE POLICY "members_select" ON public.premise_members FOR SELECT USING (true);
CREATE POLICY "members_insert" ON public.premise_members FOR INSERT WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));
CREATE POLICY "members_update" ON public.premise_members FOR UPDATE USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));
CREATE POLICY "members_delete" ON public.premise_members FOR DELETE USING (is_admin() OR EXISTS (SELECT 1 FROM public.premises WHERE id = premise_id AND owner_id = (SELECT auth.uid())));

-- [premise_applications]
CREATE POLICY "app_insert_authed" ON public.premise_applications FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "app_select_own_or_admin" ON public.premise_applications FOR SELECT USING (submitted_by = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "app_update_admin" ON public.premise_applications FOR UPDATE USING (is_admin());

-- [invoices]
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING (user_id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY "invoices_admin_write" ON public.invoices FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- [rate_limits]
CREATE POLICY "rate_limits_admin" ON public.rate_limits FOR ALL USING (is_admin());

-- [regions]
CREATE POLICY "regions_select" ON public.regions FOR SELECT USING (true);
CREATE POLICY "regions_admin_write" ON public.regions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- [whatsapp_otps] — No public access (server-side only via service_role)

-- [roles_admin]
CREATE POLICY "roles_admin_select" ON public.roles_admin FOR SELECT USING (true);
CREATE POLICY "roles_admin_insert" ON public.roles_admin FOR INSERT WITH CHECK (true);

-- Storage policies
CREATE POLICY "Allow public avatars read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Allow public snapshots read" ON storage.objects FOR SELECT USING (bucket_id = 'visitor-snapshots');
CREATE POLICY "Allow public premises read" ON storage.objects FOR SELECT USING (bucket_id = 'premises');

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════
GRANT ALL ON public.premise_gates TO service_role;
GRANT ALL ON public.premise_members TO service_role;
GRANT SELECT ON public.premise_gates TO authenticated;
GRANT SELECT ON public.premise_members TO authenticated;
GRANT ALL ON public.premise_gates TO postgres;
GRANT ALL ON public.premise_members TO postgres;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 8: CRON JOBS (requires pg_cron extension)
-- ═══════════════════════════════════════════════════════════════════════════════
-- CREATE EXTENSION IF NOT EXISTS pg_cron;  -- Must be enabled via Dashboard
-- SELECT cron.schedule('delete-expired-logs', '0 0 * * *', $$ DELETE FROM public.logs WHERE expires_at < NOW(); $$);
-- SELECT cron.schedule('delete-expired-tokens', '0 0 * * *', $$ DELETE FROM public.checkin_tokens WHERE expires_at < NOW(); $$);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 9: REALTIME (enable as needed)
-- ═══════════════════════════════════════════════════════════════════════════════
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.premise_members;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE! Next steps:
-- 1. Enable pg_cron in Supabase Dashboard > Database > Extensions
-- 2. Uncomment and run Section 8 cron jobs
-- 3. Run the make-admin script for your first admin user
-- 4. Configure WhatsApp settings in Admin > Settings
-- ═══════════════════════════════════════════════════════════════════════════════
