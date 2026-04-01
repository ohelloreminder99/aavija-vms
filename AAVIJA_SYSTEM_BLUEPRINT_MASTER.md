# Aavija VMS — System Blueprint & Execution Manual

> [!IMPORTANT]
> This document is the **Master Reference** for the Aavija Visitor Management System. It contains every minute detail required to replicate the architecture, database, logic, and design of the application.

---

## 1. Core Architecture & Philosophy
Aavija VMS is a **Multi-Role, Multi-Regional Visitor Management System** built on **Next.js 14**, **Supabase (Postgres)**, and a **Token-Based Economy**.

### Tech Stack
- **Frontend**: Next.js (App Router), Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend/DB**: Supabase (PostgreSQL, Auth, Storage, Real-time).
- **External Integration**: WhatsApp Cloud API (Notifications), Razorpay (Payments), Upstash Redis (Rate Limiting).
- **Security**: PGP Sym-Encryption (pgcrypto) for PII, Atomic SQL Functions (RPCs) for financial integrity.

---

## 2. User Roles & RBAC (Role-Based Access Control)
Access is managed via `public.users.role`, `public.users.is_agent`, and `public.users.premise_roles`.

| Role | Access Level | Description |
| :--- | :--- | :--- |
| **Admin** | **Full Global** | Manages settings, users, premises, and financial payouts. |
| **Owner** | **Premise Lead** | Manages a specific premise, its members (gatekeepers, hosts), and branding. |
| **Agent** | **Broker** | Applies for new premises, earns commission from token purchases. |
| **Host** | **Target** | The person being visited. Receives real-time notifications on visitor arrival. |
| **Gatekeeper** | **Execution** | Scans QR codes, performs check-in/out, manages live traffic at the gate. |
| **Staff** | **Operations** | General operational staff with restricted read/write access. |
| **Visitor** | **Guest** | Generates QR tokens, manages personal visit history and referrals. |

---

## 3. Database Structure & Redirection
The database uses a **Mixed Naming Convention** (Crucial for queries).

### Key Tables
1. **`public.users`**: Profiles, global roles, token balances (`token_balance_visitor`), and `premise_roles` (JSONB mapping premise-to-role).
2. **`public.premises`**: Premise details, category links, token balance, and staff management.
3. **`public.visits`**: Core transaction log. Stores check-in/out times, statuses (`active`, `completed`, `force_closed`), and vehicle details.
4. **`public.logs`**: Immutable audit trail for all system actions.
5. **`public.checkin_tokens`**: Temporary QR code identifiers with specific expiry logic.
6. **`public.settings`**: Singleton row (`id='global'`) controlling all system constants.

### Redirection Logic (`/dashboard/page.tsx`)
- Redirects users based on their `role` and `premise_roles`.
- If a user has multiple premise roles (e.g., Gatekeeper at Premise A, Host at Premise B), they are presented with a **Role Selector** to pick their current "Identity".

---

## 4. "If This Then That" Core Logic

### A. Visitor Check-in Pipeline (The Engine)
1. **Scanner Reads QR**: Decodes the token UUID.
2. **Validation**:
   - IF token is `used` or `expired` → REJECT.
   - IF visitor is `blocked` at premise → REJECT.
   - IF visitor has `active_checkin_id` (already checked in elsewhere) → REJECT.
3. **Token Deduction Logic**:
   - IF Category is **Industrial**: Premise balance must be ≥ `deduction_rate_premise`.
   - IF Category is **Residential**: Host balance must be ≥ `deduction_rate_premise`.
   - Always: Visitor balance must be ≥ `deduction_rate_visitor`.
4. **Execution (Atomic RPC)**:
   - Debit visitor, debit premise/host, create visit, delete QR token.
   - **Safety**: If any single DB operation fails, the entire transaction rolls back.
5. **Notification**: WhatsApp alert sent to Host via Cloud API (Fire-and-forget background promise).

### B. Premise Application Workflow
1. **Submission**: Agent submits with `owner_email`. System checks if owner exists.
2. **Admin Review**: Admin clicks "Approve" and selects a category.
3. **Activation (Atomic RPC `approve_premise_application`)**:
   - Creates premise row.
   - Link `owner_id` to owner user.
   - Update owner's `premise_roles`.
   - Grant `starting_token_owner`.

---

## 5. Security, Safety & Rate Limiting

### Safety from Hacking/Misuse
1. **PII Encryption**: Phone numbers and sensitive IDs are stored encrypted using `pgp_sym_encrypt`. Decryption happens ONLY on the server via `decrypt_pii` RPC. The application code never holds the encryption key.
2. **Atomic Ledger**: Token deductions use SQL RPCs to prevent "Double Spending" or race conditions.
3. **Server-Side Authorization**: All writes happen in `use server` actions which explicitly check `requireAuth()` and user roles before executing.
4. **Maintenance Mode**: Global toggle in `settings` that blocks all critical actions immediately.

### Rate Limiting
1. **Infrastructure Level**: Upstash Redis (Sliding Window).
   - Login: 5/min.
   - Contact Form: 2 every 5 mins.
2. **Application Level**:
   - OTP Requests: Controlled by `otp_request_limit_hourly`.
   - Check-ins: Controlled by `checkin_rate_limit` (Traffic control per hour).

---

## 6. UI/UX & Color Scheme (Minute Details)
Aavija uses a **Hyper-Premium "Liquid Obsidian"** aesthetic.

### Color Palette (HSL)
- **Background**: `147 82% 2%` (#010a05 - Deep Forest Obsidian).
- **Primary**: `142 71% 45%` (#10b981 - Emerald Green).
- **Card**: `150 50% 5%` (Deep metallic charcoal).
- **Accent**: `147 20% 12%`.

### Visual Effects
- **Glassmorphism**: `.glass-card` uses `backdrop-filter: blur(20px)` and semi-transparent obsidian backgrounds.
- **Neon Glows**: `.text-glow` uses `text-shadow` with emerald green.
- **Micro-Animations**:
  - `animate-scan-line`: Moving highlight for QR scanning.
  - `liquid-neon-border`: Gradient borders that look alive.

---

## 7. Admin Settings Reference
Managed in `Admin Dashboard > Settings`.

| Category | Key Settings |
| :--- | :--- |
| **Financial** | Currency, GST Rate, Token Exchange Rate, Agent Commission %. |
| **Security** | QR Expiry (seconds), Check-in Limit/Hour, OTP Limit/Hour. |
| **Operational** | Initial Tokens (Visitor/Owner), Low Token Threshold, History Retention Days. |
| **Integrations** | WhatsApp Phone/Template IDs, Razorpay Key IDs. |
| **Regional** | Default Country Code (+91, +971, etc.), Phone Number Length. |

---

## 8. Deployment Checklist (Replication)
1. **Supabase Setup**: Enable `pgcrypto`, `uuid-ossp`, and `pg_cron`.
2. **Database Initialization**: Run `MASTER_DB_SETUP.sql`.
3. **Environment**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RAZORPAY_KEY_SECRET`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `WHATSAPP_API_KEY`
4. **First Admin**: Manually set `role = 'admin'` for the first user account.
