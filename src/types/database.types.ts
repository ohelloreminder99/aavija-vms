/**
 * AAVIJA VMS — Database Type Definitions
 * Auto-generated from live Supabase schema on 2026-03-20.
 * 
 * IMPORTANT: These types reflect the EXACT column names in the database.
 * Do NOT rename columns without a corresponding migration.
 * 
 * Mixed naming convention note:
 *  - `premises` table uses camelCase (categoryId, ownerName, cityId)
 *  - `premise_applications` uses snake_case (category_id, agent_user_id)
 *  - `users` uses mixed (is_active, companyName, cityId, created_at)
 * 
 * This file is the single source of truth for column names.
 */

// ─── PREMISES ─────────────────────────────────────────────────────────────────

export interface DbPremise {
  id: string;
  name: string;
  address: string;
  city: string;
  cityId: string;
  city_state: string;
  is_active: boolean;
  owner_id: string | null;
  ownerName: string | null;
  token_balance: number;
  agent_id: string | null;
  categoryId: string | null;   // NOTE: camelCase — actual DB column name
  categoryName: string | null; // NOTE: camelCase — actual DB column name
  host_count: number;
  gatekeeper_count: number;
  gate_count: number;
  staff: string[];
  gstNumber: string | null;
  billingAddress: string | null;
  legalName: string | null;
  billingState: string | null;
  created_at: string;
  require_host_verification: boolean;
}

/** Columns safe to select for the admin list view */
export const PREMISE_LIST_COLS =
  'id, name, address, city, cityId, city_state, is_active, owner_id, ownerName, agent_id, categoryId, categoryName, token_balance, created_at' as const;

/** Columns needed for an individual premise detail */
export const PREMISE_DETAIL_COLS =
  'id, name, address, city, cityId, city_state, is_active, owner_id, ownerName, agent_id, categoryId, categoryName, token_balance, host_count, gatekeeper_count, gate_count, staff, gstNumber, billingAddress, legalName, billingState, created_at, require_host_verification' as const;

// ─── USERS ────────────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'owner' | 'host' | 'gatekeeper' | 'visitor';
  phone: string;
  countryCode: string | null;
  is_verified: boolean;
  is_active: boolean;
  is_agent: boolean;
  token_balance_visitor: number;
  global_rating: number;
  active_checkin_id: string | null;
  photo_url: string;
  city: string | null;
  cityId: string | null;
  city_state: string | null;
  companyName: string | null;
  premise_roles: Record<string, string[]>;
  vehicles: unknown;
  selected_vehicle_number: string | null;
  products: unknown;
  gstNumber: string | null;
  billingAddress: string | null;
  legalName: string | null;
  billingState: string | null;
  created_at: string;
  updated_at: string;
  agent_commission_balance: number;
  agent_payout_upi: string | null;
  pan_number: string | null;
  pan_card_url: string | null;
  kyc_verified: boolean;
  referral_code: string | null;
  referred_by: string | null;
  referral_commission_balance: number;
}

/** Columns for user identity (name/email/phone/photo) */
export const USER_IDENTITY_COLS = 'id, name, email, phone, photo_url, role, is_active, is_verified, city, cityId, created_at' as const;

/** Columns for admin user list */
export const USER_LIST_COLS = 'id, name, email, role, phone, is_verified, is_active, is_agent, city, cityId, created_at, premise_roles, token_balance_visitor' as const;

// ─── AGENTS ───────────────────────────────────────────────────────────────────

export interface DbAgent {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  commission_balance: number;
  created_at: string;
}

export const AGENT_COLS = 'id, name, phone, city, commission_balance' as const;

// ─── PREMISE APPLICATIONS ─────────────────────────────────────────────────────

export interface DbPremiseApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  premise_name: string;
  premise_address: string;
  city_id: string;
  city_name: string | null;
  city_state: string | null;
  category_id: string | null;    // NOTE: snake_case — actual DB column name
  category_name: string | null;  // NOTE: snake_case — actual DB column name
  owner_email: string;
  owner_id: string | null;
  agent_user_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
  submitted_by: string;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_premise_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// ─── PREMISE CATEGORIES ───────────────────────────────────────────────────────

export interface DbPremiseCategory {
  id: string;
  name: string;
  type: 'residential' | 'industrial' | 'standard' | null;
  created_at: string;
  deduction_rate_visitor: number;
  deduction_rate_premise: number;
  pdf_export_cost: number;
  csv_export_cost: number;
}

export const CATEGORY_COLS = 'id, name, type, deduction_rate_visitor, deduction_rate_premise' as const;

// ─── LOGS ─────────────────────────────────────────────────────────────────────

export interface DbLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  timestamp: string;
  expiresAt: string | null;
  description: string;
  tokenChange: number | null;
  premiseId: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
}

export const LOG_LIST_COLS = 'id, actorId, actorName, actorRole, action, timestamp, description, tokenChange, premiseId, created_at' as const;

// ─── CITIES ───────────────────────────────────────────────────────────────────

export interface DbCity {
  id: string;
  name: string;
  districtName: string;
  stateName: string;
  districtId: string;
  stateId: string;
}

export const CITY_COLS = 'id, name, districtName, stateName, districtId, stateId' as const;

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

/** Commonly needed settings fields — avoids fetching the entire 80+ column row */
export const SETTINGS_CORE_COLS =
  'id, starting_token_owner, starting_token_visitor, checkin_cost, whatsapp_notification_cost, agent_commission_rate, currency, default_country_code, phone_number_length, allow_unverified_checkin' as const;

export const SETTINGS_WA_COLS =
  'id, wa_template_host_notified, wa_template_payout_approved, wa_template_payout_rejected, wa_template_kyc_verified, wa_template_tokens_converted, wa_template_referral_commission, wa_template_threshold_reached, wa_template_phone_verify, wa_template_agent_assigned, whatsapp_phone_number_id, default_country_code, phone_number_length' as const;

// ─── PAGINATION ───────────────────────────────────────────────────────────────

export interface PaginationOptions {
  page: number;    // 0-indexed
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginationRange(page: number, pageSize: number): { from: number; to: number } {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}
