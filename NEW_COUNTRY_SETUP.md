# 🌍 Aavija VMS — New Country Database Setup Guide

> Follow this step-by-step whenever you deploy Aavija to a new country/region.
> Estimated time: ~15 minutes

---

## Step 1 — Create a New Supabase Project

1. Go to → https://supabase.com/dashboard
2. Click **New Project**
3. Fill in:
   - **Name**: `aavija-uae` (or country code)
   - **Database Password**: Save this somewhere safe
   - **Region**: Pick closest to your target country
4. Wait ~2 minutes for the project to initialize

---

## Step 2 — Enable Extensions

In your new Supabase project:

1. Go to **Database → Extensions** (left sidebar)
2. Search and **enable** each of these:
   - ✅ `pgcrypto` — for OTP encryption
   - ✅ `uuid-ossp` — for UUID generation
   - ✅ `pg_cron` — for scheduled TTL cleanup jobs

---

## Step 3 — Run the Master SQL File

1. Go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open this file from your local project:
   ```
   database_sql_backups/MASTER_DB_SETUP.sql
   ```
4. Copy the **entire contents** and paste into the SQL Editor
5. Click **Run** (or press `Ctrl+Enter`)
6. Wait for it to complete — you should see: `Success. No rows returned`

> ✅ This creates ALL tables, indexes, RLS policies, functions, crons, buckets, and seed data in one shot.

---

## Step 4 — Promote Your First Admin User

1. Go to your new deployment URL and **sign up** with your admin email
2. Come back to Supabase → **SQL Editor** → New Query
3. Run:
   ```sql
   UPDATE public.users
   SET role = 'admin'
   WHERE email = 'your-admin@email.com';
   ```
4. Confirm with:
   ```sql
   SELECT id, name, email, role FROM public.users;
   ```

---

## Step 5 — Configure Country-Specific Settings

In SQL Editor, run and customize:

```sql
UPDATE public.settings SET
  -- 🌐 Currency & Locale
  currency              = 'AED',      -- INR / AED / USD / SGD etc.
  default_country_code  = '+971',     -- +91 / +971 / +1 / +65 etc.
  phone_number_length   = 9,          -- 10 for India, 9 for UAE, 10 for US

  -- 🏢 Branding
  brand_name            = 'Aavija UAE',
  brand_tagline         = 'Smart Visitor Management',
  support_email         = 'support@uae.aavija.com',
  support_phone         = '+971XXXXXXXXX',

  -- 🧾 Tax / GST
  gst_rate              = 5,          -- 18 for India (GST), 5 for UAE (VAT), 0 for some
  company_name_billing  = 'Aavija Technologies LLC',
  company_address_billing = 'Dubai, UAE',
  company_gstin         = NULL,       -- Only for India

  -- 💰 Token Economy (adjust per country)
  token_exchange_rate   = 1,          -- 1 token = 1 AED (or fraction)
  starting_token_visitor = 10,
  starting_token_owner  = 0

WHERE id = 'global';
```

---

## Step 6 — Get Your API Keys

In Supabase → **Project Settings → API**:

| Key | Where to use |
|---|---|
| `Project URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret! |

---

## Step 7 — Set Environment Variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** and add:

```bash
# Supabase (from Step 6)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# App URL
NEXT_PUBLIC_APP_URL=https://uae.aavija.com

# WhatsApp (get from your WhatsApp BSP — Gupshup / WATI / etc.)
WHATSAPP_API_KEY=<key>
WHATSAPP_API_URL=<url>
WHATSAPP_SENDER_PHONE=<sender-number>

# Payments (Razorpay for India; use country equivalent for others)
RAZORPAY_KEY_ID=<key>
RAZORPAY_KEY_SECRET=<secret>

# Sentry (create a new project per country at sentry.io)
NEXT_PUBLIC_SENTRY_DSN=<dsn>
```

> ⚠️ **Service role key** must NEVER be in `NEXT_PUBLIC_` prefix — it's server-only.

---

## Step 8 — Seed Geography Data

Add states/districts/cities for the new country. You can do this via:

**Option A — Admin Dashboard**: Go to Admin → Geography → Add States/Districts/Cities

**Option B — SQL bulk import**:
```sql
INSERT INTO public.states (name) VALUES
  ('Dubai'), ('Abu Dhabi'), ('Sharjah');

INSERT INTO public.districts (name, "stateName") VALUES
  ('Deira', 'Dubai'), ('Bur Dubai', 'Dubai');

-- etc.
```

---

## Step 9 — Add Premise Categories

```sql
INSERT INTO public.premise_categories (name, type, deduction_rate_visitor, deduction_rate_premise)
VALUES
  ('Residential Community', 'residential', 1, 1),
  ('Industrial Zone', 'industrial', 1, 2),
  ('Commercial Tower', 'standard', 1, 1)
ON CONFLICT DO NOTHING;
```

---

## Step 10 — Verify Everything Works

Run these checks in SQL Editor:

```sql
-- ✅ Settings row exists
SELECT id, currency, default_country_code FROM public.settings WHERE id = 'global';

-- ✅ Admin user exists
SELECT id, name, email, role FROM public.users WHERE role = 'admin';

-- ✅ Tables all created (should return 20+ rows)
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- ✅ RLS enabled on all tables
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
-- ^ Should return EMPTY (all tables have RLS on)

-- ✅ Key functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;
-- ^ Should include: approve_premise_application, is_admin, search_premise_members, etc.
```

---

## Step 11 — Redeploy / Go Live

1. Trigger a new Vercel deployment (or `git push`)
2. Visit your new country URL
3. Sign in with your admin account
4. Test: create a premise, run a check-in, approve an application

---

## 📁 Key Files Reference

| File | Purpose |
|---|---|
| `database_sql_backups/MASTER_DB_SETUP.sql` | The single SQL file for fresh database |
| `DATABASE_MASTER_REFERENCE.md` | AI agent guide — schema, column naming rules, migration history |
| `src/types/database.types.ts` | TypeScript types matching DB schema exactly |
| `.env.local` | Local dev environment variables (never commit!) |

---

## 🎨 Shared UI Components (Phase 3A — added to all deployments)

Located in `src/components/shared/` — available across all country deployments:

| Component | File | Usage |
|---|---|---|
| `EmptyState` | `EmptyState.tsx` | Drop-in for any empty list. Takes `icon`, `title`, `description`, `actionLabel`, `onAction` |
| `SkeletonTableRows` | `SkeletonLoaders.tsx` | Replaces `<TableBody>` during loading. Takes `rows` and `cols` props |
| `SkeletonCard` | `SkeletonLoaders.tsx` | Skeleton for card-based layouts (applications, dashboard cards) |
| `SkeletonStat` | `SkeletonLoaders.tsx` | Small stat skeleton for dashboard headers |

**Usage example:**
```tsx
// Loading state — skeleton rows instead of a spinner
if (isLoading) return <SkeletonTableRows rows={5} cols={7} />;

// Empty state — friendly message instead of blank screen
if (data.length === 0) return (
  <EmptyState
    icon={Building}
    title="No Properties Found"
    description="Create the first one to get started."
    actionLabel="+ Add Property"
    onAction={() => setIsOpen(true)}
  />
);
```

**Mobile fix:** All data tables must have `overflow-x-auto` on their wrapper div:
```tsx
<div className="rounded-3xl border border-white/10 overflow-hidden overflow-x-auto">
  <Table>...</Table>
</div>
```

---

## 🔐 Security Hardening (Phase 3B — applied to all deployments)

### Input Sanitization
All user-supplied text goes through HTML stripping to prevent stored XSS:

```typescript
// src/lib/sanitize.ts — import these in any Server Action
import { zSanitize, zSanitizeOptional } from '@/lib/sanitize';

// Apply to Zod text fields:
const MySchema = z.object({
  name:    z.string().transform(zSanitize),           // required
  address: z.string().optional().transform(v => zSanitizeOptional(v)), // optional
});
```

**Files with sanitization applied:**
- `src/lib/sanitize.ts` — utility (source of truth)
- `src/services/premise-application-actions.ts` — ApplicationSchema
- `src/services/contact-actions.ts` — ContactSchema
- `src/app/dashboard/admin/premises/actions.ts` — updatePremiseAdmin (name, address, city)

> When adding a new Server Action that accepts user text, always import `zSanitize` and apply it to text fields.

### Optimistic Locking (Premise Edits)
Prevents two admins overwriting each other's changes:

- DB: `premises.updated_at` column + auto-update trigger (in `MASTER_DB_SETUP.sql`)
- Server: `updatePremiseAdmin()` accepts `expectedUpdatedAt` and returns `{ conflict: true }` if stale
- UI: `handleEditSubmit` passes `selectedPremise.updated_at` → shows conflict toast if mismatched



## ⚠️ Common Mistakes to Avoid

| Mistake | Fix |
|---|---|
| Using `category_id` in premises queries | Use `categoryId` (camelCase) |
| Using `select('*')` in server actions | Use explicit columns from `database.types.ts` |
| Forgetting to run `MASTER_DB_SETUP.sql` | Only running partial old SQL files |
| Exposing `SUPABASE_SERVICE_ROLE_KEY` client-side | It must be server-only (no `NEXT_PUBLIC_` prefix) |
| Skipping pg_cron extension | Logs and tokens won't auto-expire |

---

## 📊 Observability (Phase 3C — applied to all deployments)

### Admin Health Dashboard
Live system overview available for all admins at:
```
/dashboard/admin/health
```
Shows: active check-ins (with live pulse), visits today, pending applications, platform totals, 24h log count, and service status indicators. **Auto-refreshes every 60 seconds.**

### Performance Timing
Critical server actions are instrumented using `src/lib/with-timing.ts`:
```typescript
import { withTiming } from '@/lib/with-timing';

const result = await withTiming('my_action_name', async () => {
  return await db.from('table').select('...');
}, { slowThresholdMs: 2000, context: { userId } });
```
Any action exceeding `slowThresholdMs` automatically sends a Sentry warning with duration and context.

**Currently instrumented:**
- `approve_premise_application` RPC (inline, 3000ms threshold)
- `getHealthMetrics` (all 10 COUNT queries, 3000ms threshold)

### Sentry Alerting
Configure in your Sentry project (sentry.io → Alerts):
- Alert when `[SLOW]` messages appear (slow DB queries)
- Alert when `approve_premise_application` exception rate > 0
- Alert when any `captureException` occurs from `premise-application-actions`

---

## 🧪 Testing (Phase 3D)

Run the unit test suite (no DB or network required):
```bash
# Using node directly (works on Windows with restricted PowerShell)
node node_modules/vitest/vitest.mjs run

# Or if npm scripts work:
npm test
```

**Test file:** `src/__tests__/unit.test.ts`

| Test Group | What's tested |
|---|---|
| `sanitizeText` | XSS tag stripping, entity removal, whitespace trim |
| `sanitizeOptional` | null/undefined/empty handling |
| `zSanitize / zSanitizeOptional` | Zod transform wrappers |
| `withTiming` | Return value, error propagation, context |
| Optimistic locking | Conflict detection logic (pure, no DB) |
| `paginationRange` | Page 0/1/2 range calculations |

> When adding new server utilities, add corresponding tests to `unit.test.ts`.

---

## ⚙️ Automations (Phase 4 — apply to every deployment)

### 1. Rebuild Master SQL After Every Migration

**When:** After adding any new file to `supabase/migrations/`

```bash
node scripts/rebuild-master-sql.js
```

This reads all migration files in `supabase/migrations/` (chronological order), prepends the base `CONSOLIDATED_FINAL_SETUP.sql`, writes a fresh `database_sql_backups/MASTER_DB_SETUP.sql`, and prints a summary. **Always run this before deploying to a new country.**

> ✅ Already ran: 21 migrations included, 78 KB

---

### 2. GitHub Actions CI (Auto-runs on every push)

**File:** `.github/workflows/ci.yml`

Three jobs run automatically on every push/PR to `main`, `master`, or `develop`:

| Job | What it checks |
|---|---|
| `test` | Vitest unit tests + `tsc --noEmit` typecheck |
| `lint` | ESLint |
| `rebuild-sql-check` | Verifies `MASTER_DB_SETUP.sql` exists |

**Step-by-step to enable:**
1. Push your code to GitHub (if not already)
2. Go to your repo → **Actions** tab
3. The CI workflow will appear automatically — GitHub reads `.github/workflows/ci.yml`
4. On your next push, tests run. You'll see ✅ or ❌ on every pull request

**Add a badge to your README:**
```markdown
![CI](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/ci.yml/badge.svg)
```

---

### 3. Session Timeout Warning (Already Wired)

**File:** `src/components/shared/SessionTimeoutWarning.tsx`

Mounted in `src/app/dashboard/layout.tsx` — active for **all authenticated users**.

- Checks JWT expiry every **60 seconds**
- Shows a toast **5 minutes before** the session expires: *"⏱️ Session expiring in X min"*
- No config needed — works automatically

---

### 4. CSV Export (Use Anywhere)

**File:** `src/lib/export-csv.ts`

One-liner to add a download button on any admin list page:

```typescript
import { exportToCsv, filenameWithDate } from '@/lib/export-csv';

// Export all columns
exportToCsv(visits, filenameWithDate('visits'));

// Export specific columns only
exportToCsv(users, filenameWithDate('users'), ['name', 'email', 'role', 'created_at']);
```

**To add to any table page:**
```tsx
<Button variant="ghost" onClick={() => exportToCsv(data, filenameWithDate('my-data'))}>
  <Download className="h-4 w-4 mr-2" />
  Export CSV
</Button>
```

> `papaparse` is already installed — no new dependencies needed.

---

### 5. DB Backup Verification (Run after setup)

After creating a new Supabase project, confirm WAL/PITR is enabled (requires Pro plan):

```sql
-- In SQL Editor — should return "replica" or "logical" on paid plans
SELECT name, setting FROM pg_settings WHERE name = 'wal_level';
```

And confirm pg_cron jobs are running:
```sql
-- Check last 5 cron job runs
SELECT jobname, start_time, end_time, status
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 5;
```

> ⚠️ If `cron.job_run_details` returns empty, your cleanup jobs haven't run yet — wait 24h after setup or trigger them manually.


