'use client';

import { useDoc } from '@/supabase';
import React from 'react';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===

// Matches the Settings entity in docs/backend.json
export interface Settings {
  id?: string;
  starting_token_visitor?: number;
  starting_token_owner?: number;
  low_token_threshold?: number;
  history_days_gatekeeper?: number;
  history_days_owner?: number;
  history_days_host?: number;
  history_days_staff?: number;
  history_days_visitor?: number;
  export_history_days_owner?: number;
  export_history_days_host?: number;
  export_history_days_visitor?: number;
  pdf_export_cost_host?: number;
  csv_export_cost_host?: number;
  pdf_export_cost_visitor?: number;
  csv_export_cost_visitor?: number;
  mobile_verification_cost?: number;
  star_rating_cost?: number;
  block_visitor_cost?: number;
  unblock_visitor_cost?: number;
  block_visitor_cost_host?: number;
  unblock_visitor_cost_host?: number;
  show_token_card_visitor?: boolean;
  hide_token_economy?: boolean;
  log_ttl_days?: number;
  visit_ttl_days?: number;
  currency?: string;
  token_exchange_rate?: number;
  gst_rate?: number;
  agent_commission_rate?: number;
  default_country_code?: string;
  phone_number_length?: number;
  allow_unverified_checkin?: boolean;
  otp_request_limit_hourly?: number;
  otp_validity_duration_seconds?: number;
  otp_spam_cooldown_minutes?: number;
  qr_code_expiry_seconds?: number;
  rate_limit_max_requests?: number;
  rate_limit_window_ms?: number;
  allow_concurrent_checkins?: boolean;
  enable_multilingual?: boolean;
  // Billing specific settings
  company_gstin?: string;
  company_name_billing?: string;
  company_address_billing?: string;
  company_state_billing?: string;
  hsn_sac_code?: string;
  cgst_rate_default?: number;
  sgst_rate_default?: number;
  igst_rate_default?: number;
  // Legal Settings
  legal_grievance_officer?: string;
  legal_entity_name?: string;
  legal_support_email?: string;
  legal_address?: string;
  legal_jurisdiction_city?: string;
  legal_email?: string;
  // Phase 2B — Payout & TDS Settings
  payout_threshold_agent?: number;
  payout_threshold_referrer?: number;
  tds_enabled?: boolean;
  tds_rate?: number;
  tds_annual_exemption?: number;
  payout_method_note?: string;
  token_conversion_rate?: number;
  // Phase 2C — Referral System Settings
  referral_enabled?: boolean;
  referral_reward_tokens?: number;
  referral_commission_rate?: number;
  referral_min_purchase_tokens?: number;
  referral_first_purchase_only?: boolean;
  // Phase 3B — Landing Page Settings
  landing_hero_title?: string;
  landing_hero_subtitle?: string;
  landing_cta_primary?: string;
  landing_cta_secondary?: string;
  landing_features?: any[];
  // Production & Security Settings
  auth_rate_limit?: number;
  checkin_rate_limit?: number;
  whatsapp_rate_limit?: number;
  max_daily_token_purchase?: number;
  emergency_access_timeout_mins?: number;
  is_maintenance_mode?: boolean;
  maintenance_message?: string;
  // Branding & Identity
  brand_name?: string;
  brand_tagline?: string;
  support_email?: string;
  support_phone?: string;
  whatsapp_phone_number_id?: string;
  // WhatsApp Template Names
  wa_template_host_notified?: string;
  wa_template_payout_approved?: string;
  wa_template_payout_rejected?: string;
  wa_template_kyc_verified?: string;
  wa_template_tokens_converted?: string;
  wa_template_referral_commission?: string;
  wa_template_threshold_reached?: string;
  wa_template_phone_verify?: string;
  wa_template_agent_assigned?: string;
  wa_template_premise_approved?: string;
  wa_template_new_premise_application?: string;
  // Security & Keys
  razorpay_key_id?: string;
}

// === REPOSITORY FUNCTIONS (HOOKS & ASYNC) ===

const SETTINGS_DOC_ID = 'global'; // Use a singleton document for global settings
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

let cachedSettings: { data: Settings | null, timestamp: number } | null = null;

/**
 * Clears the client-side settings cache.
 * This should be called on user logout to ensure the next user doesn't see stale data.
 */
export function clearSettingsCache() {
  cachedSettings = null;
}

/**
 * Hook to fetch the global app settings, with caching.
 * Fetches data once and caches it for 1 hour to reduce reads.
 * @returns An object with { data, isLoading, error }
 */
export function useSettings() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [data, setData] = React.useState<Settings | null>(cachedSettings?.data ?? null);

  React.useEffect(() => {
    if (cachedSettings && (Date.now() - cachedSettings.timestamp < CACHE_DURATION_MS)) {
      setData(cachedSettings.data);
      setIsLoading(false);
      return;
    }

    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const supabase = await createClient();
        const { data: settingsData, error: err } = await supabase
          .from('settings')
          .select('*')
          .eq('id', SETTINGS_DOC_ID)
          .single();

        if (err) {
          if (err.code === 'PGRST116') {
            // No rows found, safe to ignore if not initialized
            cachedSettings = { data: null, timestamp: Date.now() };
            setData(null);
          } else {
            throw err;
          }
        } else {
          cachedSettings = { data: settingsData, timestamp: Date.now() };
          setData(settingsData);
        }

        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch settings:", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { data, isLoading, error };
}


/**
 * Updates the global app settings document.
 * This is a non-blocking write and also clears the client-side cache.
 * @param _db Parameter ignored
 * @param data The partial settings data to update.
 */
export async function updateSettings(_db: any, data: Partial<Settings>) {
  const supabase = await createClient();
  clearSettingsCache();

  const { error } = await supabase.from('settings').update(data).eq('id', SETTINGS_DOC_ID);
  if (error) throw error;
}
