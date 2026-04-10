# 🌍 Aavija VMS — New Country Master Launch Protocol

> ⚠️ **CRITICAL RULE**: This document is the absolute source of truth for all brand new country deployments. If any environment variables, API providers (WhatsApp, Razorpay, Sentry, Google Auth), or core architectures change, this protocol MUST be updated immediately to prevent fragmentation when opening new branches.

---

## Step 1: Infrastructure Initialization (Supabase)

Aavija uses Supabase as its primary backend and authentication engine. Do this **first**:

1. **Create Project**: Go to [Supabase Dashboard](https://supabase.com/dashboard) and create a New Project named after the target region (e.g., `aavija-uae`, `aavija-canada`). Select the AWS region closest to the operation.
2. **Enable Extensions**: Navigate to **Database → Extensions** and toggle the following ON before running any SQL:
   - `pgcrypto`
   - `uuid-ossp`
   - `pg_cron`
3. **Execute Master SQL**: Navigate to **SQL Editor** → **New Query**, paste the entire contents of `database_sql_backups/MASTER_DB_SETUP.sql`, and hit **Run**. Wait for the "Success" toast.
   *(This ensures all schemas, roles, tables, B-Tree indexes, Row Level Security rules, and all recent migration fixes are applied in one single step).*

---

## Step 2: Site Identity & Google OAuth SSO

Aavija supports passwordless authentication and Google SSO.

### A. Core Auth Settings
1. Go to Supabase → **Authentication → URL Configuration**.
2. **Site URL**: Enter `https://your-country.aavija.com` (e.g., `https://uae.aavija.com`).
3. **Redirect URLs**: Add `https://your-country.aavija.com/**` to the allow list. Ensure `http://localhost:3000/**` is also there for local debugging.
4. **Security Settings**: Ensure **Confirm email** is enabled (Prevents unauthorized bad actors claiming accounts). Enable **Link identities with the same email**.

### B. Google OAuth
If deploying Google Auth, you must create new Google Cloud Credentials linked exclusively to the new country's subdomain.
1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Go to **APIs & Services → Credentials**.
3. Create new **OAuth Client ID** (Web Application).
4. **Authorized Redirect URIs**: You must add the specific callback URL provided by your Supabase project (find this in Supabase → Authentication → Providers → Google). It looks like: `https://<project-ref>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**.
6. Back in Supabase → **Authentication → Providers → Google**, paste the Client ID and Secret, and click **Save**.

---

## Step 3: Anti-Ban Reverse Proxy (Cloudflare Worker)

To ensure the app survives potential ISP bans on the `supabase.co` domain globally, we must **hide** Supabase behind Cloudflare.

1. In Cloudflare, go to **Workers & Pages** -> **Create Application** -> **Create Worker**.
2. Name it `supabase-proxy-[country_code]` (e.g., `supabase-proxy-uae`) and Deploy.
3. Click **Edit Code** and paste the following:
   ```javascript
   export default {
     async fetch(request, env) {
       const url = new URL(request.url);
       // Mask the request to the real Supabase backend
       url.hostname = 'YOUR_SUPABASE_PROJECT_REF_ID.supabase.co';
       return fetch(new Request(url, request));
     }
   }
   ```
4. Replace `YOUR_SUPABASE_PROJECT_REF_ID` with the ID from Step 1.
5. Click **Deploy**.
6. Copy the Worker's `*.workers.dev` URL or attach a Custom Domain to it (e.g., `api.uae.aavija.com`). You will use this in the next step.

---

## Step 4: Frontend Deployment (Vercel)

1. Go to [Vercel](https://vercel.com) and create a New Project from the Aavija source repository.
2. **Framework Preset**: Next.js.
3. Before deploying, configure the **Environment Variables**:

| Variable Key | Source | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cloudflare Proxy | **CRITICAL**: Use the Worker URL from Step 3, *NOT* the raw Supabase URL! |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (Settings->API) | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (Settings->API) | 🛑 Server-side ONLY. |
| `NEXT_PUBLIC_APP_URL` | Self (e.g., `https://uae.aavija.com`) | Used for hardcoded redirects |
| `WHATSAPP_API_KEY` | Third Party (Meta/Gupshup) | |
| `WHATSAPP_API_URL` | Third Party | |
| `WHATSAPP_SENDER_PHONE` | Third Party | |
| `RAZORPAY_KEY_ID` | Payment Provider | Or region equivalent |
| `RAZORPAY_KEY_SECRET` | Payment Provider | Or region equivalent |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry Dashboard | Get from Step 6 |

4. Click **Deploy**.

---

## Step 5: Routing & Security (Cloudflare)

To link your Vercel deployment cleanly to the country’s subdomain with maximum DDoS protection.

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) and select the `aavija.com` zone.
2. Go to **DNS → Records**.
3. Create a **CNAME** record:
   - **Name**: `uae` (or country code)
   - **Target**: `cname.vercel-dns.com`
   - **Proxy status**: 🟠 **Proxied** (Enable the orange cloud).
4. Back in Vercel, go to the active project → **Settings → Domains**.
5. Add `uae.aavija.com`. Vercel will verify the domain through Cloudflare.

---

## Step 6: Application Telemetry (Sentry)

To ensure we capture UI crashes and slow server-actions natively:

1. Go to [Sentry.io](https://sentry.io).
2. Create a **New Project** → Platform **Next.js**.
3. Name it `aavija-web-[country_code]`.
4. Copy the unique **DSN Key**.
5. Add this as `NEXT_PUBLIC_SENTRY_DSN` inside the Vercel project environment variables (from Step 4) and trigger a redeployment in Vercel to burn in the new DSN.

---

## Step 7: Post-Launch Groundwork

Once the domain resolves successfully in the browser (Step 5), perform the final operational setup.

### A. Create The Prime Admin
1. Register normally through the `/signup` screen using your admin email.
2. Go to Supabase → **SQL Editor** and promote yourself:
   ```sql
   UPDATE public.users SET role = 'admin' WHERE email = 'your-admin@email.com';
   ```
3. You can now access `/dashboard/admin`.

### B. Configure Country Dynamics
As the Prime Admin, go under **Dashboard → Service Configuration** and **Dashboard → Token Settings** to align the application:
1. Default Currency Code (e.g. `AED`)
2. Local Taxation Rules (e.g. 5% VAT)
3. Pricing multipliers (Token Exchange Rates)
4. Phone Length parsing configuration.

### C. Test Checkin Pipeline
1. Create a dummy premise.
2. Assign yourself as Owner, then assign yourself as Gatekeeper.
3. Open a separate incognito window, sign up as a Visitor.
4. Scan the generic QR Code using the Gatekeeper app and ensure a successful checkin block.

✅ **Aavija is officially launched in the targeted country.**
