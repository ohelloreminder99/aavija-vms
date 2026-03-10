# Aavija VMS: Operations & Business Continuity Manual

> [!IMPORTANT]
> This manual serves as the "Runbook" for Aavija. It contains the technical architecture, service registry, and recovery procedures required to keep the business operational in the absence of the primary founder/developer.

---

## 🏗 Architecture Overview

Aavija is built as a modern, serverless ecosystem:
- **Frontend/Backend:** Next.js (App Router)
- **Database/Auth:** Supabase (PostgreSQL)
- **Edge Logic:** Cloudflare Workers (for regional proxying)
- **Payments:** Razorpay
- **Notifications:** WhatsApp Business API (Meta)
- **Monitoring:** Sentry

---

## 🛠 Service Registry

This section lists every third-party account required to run the application.

### 1. Domain & DNS
- **Registrar:** Namecheap
  - **Account Email:** [INSERT_REGISTRAR_EMAIL]
  - **Purpose:** Owns the `aavija.com` (or regional) domain.
- **DNS/CDN:** Cloudflare
  - **Account Email:** [INSERT_CLOUDFLARE_EMAIL]
  - **Purpose:** Manages DNS records, SSL/TLS, and Edge Workers.

### 2. Hosting & Infrastructure
- **Hosting:** Vercel
  - **Account Email:** [INSERT_VERCEL_EMAIL]
  - **Purpose:** Production build and deployment of the Next.js app.
- **Backend-as-a-Service:** Supabase
  - **Account Email:** [INSERT_SUPABASE_EMAIL]
  - **Critical Components:**
    - **PostgreSQL Database:** Stores all visit logs, users, and tokens.
    - **Storage:** Stores visitor photos and profile images.
    - **Realtime:** Powers the gatekeeper alerts and dashboard updates.

### 3. Financials & Payments
- **Payment Gateway:** Razorpay
  - **Account Email:** [INSERT_RAZORPAY_EMAIL]
  - **Purpose:** Handles token purchases and invoice generation.
  - **Integration:** Uses Webhooks to update token balances in Supabase via Vercel Edge functions.

### 4. Communication
- **WhatsApp API:** Meta for Developers / WhatsApp Business Account
  - **Account Email:** [INSERT_META_EMAIL]
  - **Purpose:** Sends arrival alerts to hosts.
  - **Note:** Costs are managed through the Meta Business Manager credit line.

### 5. Stability & Monitoring
- **Error Tracking:** Sentry
  - **Account Email:** [INSERT_SENTRY_EMAIL]
  - **Purpose:** Real-time crash reporting.

---

## 🔐 Key Management (The "Dead Man's Switch")

All critical API keys are stored in the **Vercel Project Settings (Environment Variables)**. To access them:
1. Log into Vercel.
2. Navigate to `Aavija-main` -> Settings -> Environment Variables.

**Critical Keys to Protect:**
- `SUPABASE_SERVICE_ROLE_KEY`: Unrestricted access to all data.
- `RAZORPAY_KEY_SECRET`: Ability to issue refunds or access payment data.
- `WHATSAPP_API_TOKEN`: Controls notification billing.

---

## 📂 Where to Store This Manual?

For maximum security and reliability, I recommend the following storage strategy:

1. **In Codebase:** Store this file as `OPERATIONS_MANUAL.md` in the root of your private repository.
2. **Password Manager:** Copy the contents of this manual into a "Secure Note" in a password manager (like Bitwarden, 1Password, or Dashlane).
3. **Legacy Vault:** Most password managers have an "Emergency Access" feature. Invite a trusted person (spouse, partner, or fellow lead developer) to have emergency access to your vault after 24-48 hours of inactivity.
4. **Physical Backup:** Keep a printed copy of the *account list* (not the passwords) in a bank locker or safe, along with instructions on how to access the digital vault.

---

## 🔄 Recovery & Maintenance Procedures

### To Re-deploy the App:
1. Clone the GitHub repository.
2. Ensure the `.env` file matches the variables in Vercel.
3. Run `npm run build`.

### To Access Data Directly:
1. Log into the Supabase Dashboard.
2. Use the "Table Editor" to view `visits`, `users`, or `premises`.

### To Update DNS:
1. Log into Cloudflare.
2. Navigate to the DNS tab to point records to Vercel's nameservers.

---

*Manual Last Updated: 2026-03-10*
