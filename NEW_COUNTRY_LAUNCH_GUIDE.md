# Aavija VMS: New Country Launch Guide

This guide provides a step-by-step technical and operational checklist for launching the Aavija Visitor Management System in a new country.

---

## 1. Infrastructure Setup

### A. Domain & DNS (Cloudflare)
1.  **Subdomain Strategy**: Assign a country-specific subdomain (e.g., `india.aavija.com`, `uae.aavija.com`).
2.  **DNS Records**:
    - Add an `A` record or `CNAME` for the new subdomain in Cloudflare.
    - Ensure "Proxy status" is enabled for DDoS protection and SSL.
3.  **WAF Rules**: If the country has specific compliance needs (e.g., GDPR), configure Cloudflare Geo-blocking or custom WAF rules.

### B. Deployment (Vercel)
1.  **New Web Project**:
    - You can use a single Vercel project with multi-domain mapping or separate projects for isolation.
2.  **Environment Variables**:
    Ensure the following keys are set in the Vercel Production environment:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (Private)
    - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
    - `RAZORPAY_KEY_SECRET` (Private)
    - `WHATSAPP_PHONE_NUMBER_ID`
    - `WHATSAPP_ACCESS_TOKEN` (Private)
    - `NEXT_PUBLIC_ADMIN_EMAIL` (To bootstrap the first admin)

### C. Site Identity (Supabase Auth Settings)
1.  **Site URL**: In Supabase Dashboard -> Auth -> Configuration, set the **Site URL** to `https://[your-subdomain].aavija.com`.
2.  **Redirect URLs**: Add `https://[your-subdomain].aavija.com/**` to the allow-list.

---

## 2. Supabase Configuration (Database & Storage)

All logic for token handling and check-ins resides in the code, while data persists in Supabase.

### A. SQL Initialization Sequence
Run the following scripts in the **Supabase SQL Editor** in this EXACT order to ensure all dependencies and security policies are correct:

#### Phase 1: Core System
1.  **`database_sql_backups/00-MASTER-SYNC.sql`**: The baseline schema (Tables, Auth, basic RLS).
2.  **`database_sql_backups/phase2a_migrations.sql`**: Billing & basic commissions.
3.  **`database_sql_backups/phase2b_migrations.sql`**: Agent-as-User redesign.
4.  **`database_sql_backups/phase2c_migrations.sql`**: Logging & Referral fixes.
5.  **`database_sql_backups/phase3b_landing_softcoding.sql`**: Content management features.
6.  **`database_sql_backups/phase4_scalable_management.sql`**: Enterprise-level controls.

#### Phase 2: Architectural Hardening & Performance
7.  **`database_sql_backups/01-100-YEAR-INDEXES-AND-RPCS.sql`**: Atomic token logic and performance indexes.
8.  **`supabase/migrations/CONSOLIDATED_FINAL_SETUP.sql`**: (CRITICAL) This consolidates all recent 2026 security patches, stabilizes the `premise_members` structure, and clears performance warnings.
9.  **`database_sql_backups/02-AUTO-DELETION-PG-CRON.sql`**: (CRITICAL) Enables `pg_cron` for automated data cleanup.

#### Phase 3: Regional & Operational Setup
10. **`database_sql_backups/04-I18N-SETTINGS.sql`**: Enables multi-lingual selection.
11. **`database_sql_backups/09-GLOBAL-REGISTRY.sql`**: Prepares the State/City schema.
12. **`database_sql_backups/make-admin.sql`**: Run this with the target admin's email to bootstrap the dashboard.

### B. Geography Data (SQL)
You must populate the geography tables so users can select their locations:
-   **Link**: [09-GLOBAL-REGISTRY.sql](file:///d:/Supabase/antigravity/Aavija-main/Aavija-main/database_sql_backups/09-GLOBAL-REGISTRY.sql)
-   Run custom `INSERT` statements for the `states`, `districts`, and `cities` of the target country.

### C. Storage Buckets
Ensure the following buckets exist and are set to "Public":
- `avatars` (Visitor profile photos)
- `visitor-snapshots` (Check-in photos)
- `premises` (Premise branding)
- `bills` (Invoices/Receipts)

---

## 3. Third-Party Service Integration

### A. Razorpay (Payments & Billing)
1.  **Currency Support**: Ensure your Razorpay account supports the target country's currency (e.g., AED, USD).
2.  **API Keys**: Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Vercel.
3.  **Webhooks**: Point Razorpay webhooks to `https://[your-subdomain]/api/webhooks/razorpay` to handle payment failures/successes.

### B. Meta WhatsApp Cloud API
1.  **Phone Number ID**: Obtain from Meta Developers portal and add to `WHATSAPP_PHONE_NUMBER_ID`.
2.  **Access Token**: Generate a **Permanent System User Token** in Business Settings.
3.  **Templates**: Mirror the templates listed in `src/services/whatsapp-service.ts` (e.g., `aavija_payout_approved`, `aavija_referral_commission`) in the Meta Business Manager for the target language/region.

---

## 4. Admin Dashboard Configuration

Once the site is live, log in as Admin and navigate to **Dashboard -> Token Settings**:

1.  **Currency**: Set to the local currency code (e.g., `USD`, `AED`).
2.  **Token Exchange Rate**: Define how much 1 token costs in that currency.
3.  **Country Code**: Set the `default_country_code` (e.g., `+971`).
4.  **Phone Length**: Set the expected length (e.g., `9` for UAE mobile numbers).
5.  **Tax Rates**: Configure `cgst_rate_default`, `sgst_rate_default`, and `igst_rate_default` based on local tax laws (or set to 0 if not applicable).
6.  **Billing Identity**: Update `company_name_billing` and `company_address_billing` for local legal compliance.

---

## 6. Architectural Hardening (100-Year Scalability)

To ensure the system remains fast and automated over years of operation, you must run the following hardening steps:

### A. Performance Indexing
Run **`01-100-YEAR-INDEXES-AND-RPCS.sql`**. This script adds B-Tree indexes to all foreign keys and status columns.
- **Why?** Without these, as your `visits` table grows to 1,000,000+ rows, the dashboard will become slow. These indexes ensure lookups stay lightning-fast (O(log N)).

### B. Automated Maintenance (pg_cron)
Run **`02-AUTO-DELETION-PG-CRON.sql`**. This script automated the physical deletion of old data.
1.  **Enables pg_cron**: Installs the scheduler in Supabase.
2.  **Purge Logic**: Automatically deletes "Completed" visits, old "Logs", and "Old Ledger" records based on the **Visit TTL Days** setting in your Admin Dashboard.
3.  **Scheduling**: Sets a job to run every midnight.
- **Why?** This prevents "Database Bloat." By automatically purging old snapshots and history, your database size remains manageable and cost-effective forever.

---

## 7. Final Verification Checklist

1.  [ ] **Signup**: Create a new visitor account and verify OTP (WhatsApp).
2.  [ ] **Token Purchase**: Complete a test purchase via Razorpay.
3.  [ ] **Check-in**: Generate a QR code as a visitor and check-in via a Gatekeeper account.
4.  [ ] **Notification**: Confirm the Host receives a WhatsApp arrival alert.
5.  [ ] **Invoicing**: Verify the generated PDF invoice reflects local tax and address.

---

## 8. Manual Supabase Dashboard Settings

Some configurations cannot be done via SQL and must be toggled manually in the Supabase UI:

### A. Auth (WhatsApp OTP)
1.  Navigate to **Auth -> SMS Provider**.
2.  Choose **WhatsApp** (instead of standard SMS).
3.  Input your **WhatsApp Phone Number ID** and **Access Token** (from the Meta portal).
4.  Configure the **Template Name** (e.g., `aavija_phone_verify`).

### B. Realtime (Visual Check)
1.  Navigate to **Database -> Replication**.
2.  Ensure the `supabase_realtime` publication has the following tables toggled **ON**:
    - `visits`, `users`, `logs`, `premises`, `checkin_tokens`.
- **Note**: Running `enable-realtime.sql` (Phase 2) already does this via SQL, but a visual check is recommended for production stability.

### C. Storage CORS & Access
1.  Navigate to **Storage -> Configuration -> CORS**.
2.  Ensure your specific subdomain is allowed to access the buckets (`avatars`, `visitor-snapshots`, etc.) with `GET`, `POST`, and `PUT` methods.
3.  Ensure the buckets are set to **Public** so visitors can see snapshots.
