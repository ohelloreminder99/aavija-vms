/**
 * AAVIJA VMS — Database Type Definitions
 * Updated: 2026-04-08 — CASE STANDARDIZATION
 * 
 * ALL column names now use snake_case to match the PostgreSQL schema.
 * This file is the single source of truth for column names.
 * 
 * CASING RULE:
 *  - Database columns: snake_case (e.g., category_id, owner_name)
 *  - Frontend-only variables: camelCase (e.g., isLoading, formData)
 */

// ─── PREMISES ─────────────────────────────────────────────────────────────────

export interface DbPremise {
  id: string;
  name: string;
  address: string;
  city: string;
  city_id: string;
  city_state: string;
  is_active: boolean;
  owner_id: string | null;
  owner_name: string | null;
  token_balance: number;
  agent_id: string | null;
  category_id: string | null;
  category_name: string | null;
  host_count: number;
  gatekeeper_count: number;
  gate_count: number;
  staff: string[];
  gst_number: string | null;
  billing_address: string | null;
  legal_name: string | null;
  billing_state: string | null;
  created_at: string;
  updated_at: string;
  require_host_verification: boolean;
}

/** Columns safe to select for the admin list view */
export const PREMISE_LIST_COLS =
  'id, name, address, city, city_id, city_state, is_active, owner_id, owner_name, agent_id, category_id, category_name, token_balance, created_at' as const;

/** Columns needed for an individual premise detail */
export const PREMISE_DETAIL_COLS =
  'id, name, address, city, city_id, city_state, is_active, owner_id, owner_name, agent_id, category_id, category_name, token_balance, host_count, gatekeeper_count, gate_count, staff, gst_number, billing_address, legal_name, billing_state, created_at, updated_at, require_host_verification' as const;

// ─── USERS ────────────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'owner' | 'host' | 'gatekeeper' | 'visitor';
  phone: string;
  country_code: string | null;
  is_verified: boolean;
  is_active: boolean;
  is_agent: boolean;
  token_balance_visitor: number;
  global_rating: number;
  active_checkin_id: string | null;
  photo_url: string;
  city: string | null;
  city_id: string | null;
  city_state: string | null;
  company_name: string | null;
  premise_roles: Record<string, string[]>;
  vehicles: unknown;
  selected_vehicle_number: string | null;
  products: unknown;
  gst_number: string | null;
  billing_address: string | null;
  legal_name: string | null;
  billing_state: string | null;
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
export const USER_IDENTITY_COLS = 'id, name, email, phone, photo_url, role, is_active, is_verified, city, city_id, created_at' as const;

/** Columns for admin user list */
export const USER_LIST_COLS = 'id, name, email, role, phone, is_verified, is_active, is_agent, city, city_id, created_at, premise_roles, token_balance_visitor' as const;

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
  category_id: string | null;
  category_name: string | null;
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
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  timestamp: string;
  expires_at: string | null;
  description: string;
  token_change: number | null;
  premise_id: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
}

export const LOG_LIST_COLS = 'id, actor_id, actor_name, actor_role, action, timestamp, description, token_change, premise_id, context, created_at' as const;

// ─── CITIES ───────────────────────────────────────────────────────────────────

export interface DbCity {
  id: string;
  name: string;
  district_name: string;
  state_name: string;
  district_id: string;
  state_id: string;
}

export const CITY_COLS = 'id, name, district_name, state_name, district_id, state_id' as const;

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
