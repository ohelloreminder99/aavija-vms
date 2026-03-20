# Aavija VMS — Database Master Reference (AI Agent Guide)

> **Purpose**: This file is the authoritative reference for any AI agent working on this codebase.
> Read this before touching any database query, migration, or server action.
> Last updated: 2026-03-20

---

## 🚀 New Country Setup — Checklist

When deploying a new regional Supabase instance (e.g., `uae.aavija.com`):

1. **Create a new Supabase project** at https://supabase.com
2. **Enable Extensions** (in Supabase Dashboard → Database → Extensions):
   - `pgcrypto` ✅
   - `uuid-ossp` ✅
   - `pg_cron` ✅
3. **Run the master SQL file** in Supabase SQL Editor:
   ```
   database_sql_backups/MASTER_DB_SETUP.sql
   ```
   This creates ALL tables, RLS, functions, crons, seed data in one shot.

4. **Set environment variables** for the new deployment (see `.env.example`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<new-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<new-service-role-key>
   ```

5. **Promote the first admin** (after the admin user signs up):
   ```sql
   UPDATE public.users SET role = 'admin' WHERE email = 'admin@example.com';
   ```

6. **Configure country-specific settings** in admin dashboard or SQL:
   ```sql
   UPDATE public.settings SET
     currency = 'AED',                -- [COUNTRY_CONFIG]
     default_country_code = '+971',   -- [COUNTRY_CONFIG]
     phone_number_length = 9,         -- [COUNTRY_CONFIG]
     brand_name = 'Aavija UAE',       -- [COUNTRY_CONFIG]
     gst_rate = 5,                    -- [COUNTRY_CONFIG] — VAT in UAE
     company_name_billing = 'Aavija Technologies LLC'  -- [COUNTRY_CONFIG]
   WHERE id = 'global';
   ```

7. **Seed cities/districts/states** for the new country's geography.

8. **Add Sentry DSN** (project-specific) to Vercel env vars.

---

## ⚠️ Critical Naming Conventions (READ BEFORE WRITING QUERIES)

This codebase has a **mixed naming convention** in the DB — this is the #1 source of bugs.

| Table | Naming Style | Example |
|---|---|---|
| `premises` | **camelCase columns** | `categoryId`, `ownerName`, `cityId` |
| `users` | **camelCase columns** | `companyName`, `countryCode`, `billingAddress` |
| `premise_applications` | **snake_case columns** | `category_id`, `city_name`, `owner_email` |
| `logs` | **camelCase columns** | `actorId`, `actorName`, `premiseId`, `tokenChange` |
| `visits` | **snake_case columns** | `visitor_id`, `host_id`, `checkin_time` |
| `invoices` | **camelCase columns** | `userId`, `gstAmount`, `totalAmount`, `createdAt` |
| `agent_ledger_entries` | **camelCase columns** | `agentId`, `premiseId` |
| `ratings` | **camelCase columns** | `visitorId`, `hostId`, `premiseId` |
| `checkin_tokens` | **snake_case + camelCase mix** | `visitor_id` (snake), `expiresAt` (camelCase) |

### Column Casing Quick Reference

```typescript
// premises table
premises.categoryId    ✅   // NOT category_id
premises.ownerName     ✅   // NOT owner_name
premises.cityId        ✅   // NOT city_id
premises.agent_id      ✅   // Exception: agent_id IS snake_case

// users table
users.companyName      ✅   // NOT company_name
users.countryCode      ✅   // NOT country_code
users.premise_roles    ✅   // snake_case
users.photo_url        ✅   // snake_case

// premise_applications table (ALL snake_case)
premise_applications.category_id   ✅
premise_applications.city_name     ✅
premise_applications.agent_user_id ✅
```

---

## 📊 Table Reference

### `public.users`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | = Supabase Auth UID |
| `role` | TEXT | `'visitor'`, `'owner'`, `'admin'`, `'host'`, `'gatekeeper'` |
| `premise_roles` | JSONB | `{ "premise_uuid": ["owner"], "premise2_uuid": ["host"] }` |
| `is_agent` | BOOL | Agents can submit premise applications |
| `token_balance_visitor` | INT | Visitor token balance |
| `action_timestamps` | JSONB | Rate limiting timestamps per action type |
| `countryCode` | TEXT | camelCase! E.g., `"+91"` |
| `companyName` | TEXT | camelCase! |

### `public.premises`
| Column | Type | Notes |
|---|---|---|
| `categoryId` | TEXT | Stored as TEXT (not UUID FK), references `premise_categories.id` |
| `categoryName` | TEXT | Denormalized copy of category name |
| `ownerName` | TEXT | Denormalized copy of owner name |
| `cityId` | TEXT | camelCase! Matches `cities.id::TEXT` |
| `agent_id` | UUID | FK to `agents.id` (snake_case exception!) |
| `staff` | JSONB | Legacy — use `premise_members` table instead |
| `updated_at` | TIMESTAMPTZ | Auto-updated by `set_updated_at()` trigger |

### `public.premise_categories`
| Column | Type | Notes |
|---|---|---|
| `type` | TEXT | `'residential'`, `'industrial'`, `'standard'` |
| `deduction_rate_visitor` | NUMERIC | Tokens deducted from visitor per visit |
| `deduction_rate_premise` | NUMERIC | Tokens deducted from premise per visit |

### `public.logs`
| Column | Type | Notes |
|---|---|---|
| `actorId` | UUID | camelCase! |
| `premiseId` | UUID | camelCase! |
| `tokenChange` | INT | camelCase! Positive = credit, Negative = debit |
| `expiresAt` | TIMESTAMPTZ | TTL — deleted by pg_cron nightly |

### `public.premise_applications`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | Stored as TEXT UUID (NOT UUID type) |
| `category_id` | TEXT | snake_case! (different from `premises.categoryId`) |
| All others | TEXT/TIMESTAMPTZ | All snake_case |

### `public.settings` (always single row: `id = 'global'`)
Key fields used in logic:
- `starting_token_owner` — tokens given to owner on premise creation
- `starting_token_visitor` — tokens given on user signup
- `checkin_cost` — tokens deducted per check-in
- `agent_commission_percent` — % of payment to agent
- `otp_request_limit_hourly` — max OTPs per hour
- `currency`, `default_country_code`, `phone_number_length` — [COUNTRY_CONFIG]

---

## 🔧 Key Database Functions

| Function | Purpose |
|---|---|
| `is_admin()` | Used in RLS policies — checks if current auth user is admin |
| `set_updated_at()` | Trigger that auto-updates `updated_at` on any row update |
| `approve_premise_application(p_application_id, p_category_id, p_admin_id, p_admin_name)` | Atomically approves an application, creates premise, updates owner roles |
| `search_premise_members(premise_id, role, search_term, limit, offset)` | Paginated, searchable member lookup |
| `increment_gatekeeper_count(premise_id)` | Safe counter increment |
| `decrement_gatekeeper_count(premise_id)` | Safe counter decrement (min 0) |
| `increment_host_count(premise_id)` | Safe counter increment |
| `decrement_host_count(premise_id)` | Safe counter decrement (min 0) |

---

## 🗂️ Migration History (Chronological)

All migrations are in `supabase/migrations/`. Run in this order on a fresh DB:

| File | What it does |
|---|---|
| `database_sql_backups/MASTER_DB_SETUP.sql` | **🔴 USE THIS — runs everything below** |
| `CONSOLIDATED_FINAL_SETUP.sql` | Creates gates/members tables, scalable RLS |
| `20260315_dynamic_settings.sql` | Adds dynamic settings columns |
| `20260315_branding_services_settings.sql` | Adds branding columns to settings |
| `20260315_pii_encryption.sql` | pgcrypto-based OTP encryption |
| `20260315_rate_limiting.sql` | Rate limiting logic |
| `20260315_host_verification.sql` | Host photo verification flow |
| `20260315_gate_auditing.sql` | Gate-level check-in tracking |
| `20260315_scalable_search.sql` | Full-text search on members |
| `20260317_fix_pgcrypto.sql` | Ensures pgcrypto extension exists |
| `20260320_premise_applications.sql` | Premise application workflow |
| `20260320_fix_premise_category_types.sql` | Adds type check constraint |
| `20260320_universal_rls_policies.sql` | Unified RLS rewrites |
| `20260320_atomic_premise_approval.sql` | Atomic RPC for approval |
| `20260320_premises_updated_at.sql` | Adds updated_at + trigger to premises |

> ✅ **MASTER_DB_SETUP.sql supersedes all of the above.** Only run individual files if you're patching an existing database.

---

## 🏗️ TypeScript Schema Types

The canonical TypeScript types for all tables live in:
```
src/types/database.types.ts
```

This file has:
- `DbPremise`, `DbUser`, `DbLog`, etc. — typed row interfaces
- `PREMISE_LIST_COLS`, `USER_IDENTITY_COLS`, `LOG_LIST_COLS` — pre-built select strings for explicit column queries
- `paginationRange(page, pageSize)` — helper for Supabase `.range()` calls

**Always use these constants instead of `select('*')`.**

---

## 🔐 Security Architecture

- All writes go through **Next.js Server Actions** (`'use server'`), which use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- Client components only use `anon key` for reads (safe due to RLS selects being `USING (true)`)
- **Admin operations** check `profile.role === 'admin'` server-side before any DB write
- **Rate limiting** is implemented via `action_timestamps` JSONB in the users row
- **OTP security**: stored encrypted via pgcrypto, expire after 5 minutes

---

## 📝 When Adding a New Column

1. Add to the table in your migration SQL
2. Update `src/types/database.types.ts` with the new column
3. Update the relevant `*_COLS` constant in `database.types.ts`
4. Update `MASTER_DB_SETUP.sql` to include the column so future deployments get it
5. Run a Snyk code scan after your changes

---

## 🌐 Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# WhatsApp (Gupshup / WATI / etc.)
WHATSAPP_API_KEY=<key>
WHATSAPP_API_URL=<url>
WHATSAPP_SENDER_PHONE=<phone>

# Payments (Razorpay — India; change for other countries)
RAZORPAY_KEY_ID=<key>
RAZORPAY_KEY_SECRET=<secret>

# Error Monitoring
NEXT_PUBLIC_SENTRY_DSN=<dsn>

# App URL
NEXT_PUBLIC_APP_URL=https://<domain>
```
