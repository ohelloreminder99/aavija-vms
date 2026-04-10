# 🗺️ Aavija VMS — Codebase Map

> **Last updated:** 2026-04-11
> **Purpose:** Quick-reference guide so any developer (or AI agent) can locate any file without scanning the entire tree.

---

## Root-Level Overview

```
Aavija-main/
├── .agent/              # Agent config — MAP.md (this file), SYSTEM.md
├── .github/workflows/   # CI/CD workflows
├── .idx/                # Project IDX (cloud IDE) config
├── .vscode/             # VS Code workspace settings
├── docs/                # 📚 All project documentation (see breakdown below)
├── public/              # Static assets — icons, manifest, service-worker, sample CSVs
├── scripts/             # Utility & debug scripts (see breakdown below)
├── src/                 # ✅ APPLICATION SOURCE CODE (see breakdown below)
├── supabase/            # Supabase CLI project — migrations/
├── node_modules/        # Dependencies (auto-generated, git-ignored)
└── [config files]       # next.config.ts, tailwind.config.ts, tsconfig.json, etc.
```

---

## `docs/` — All Project Documentation

```
docs/
├── AAVIJA_NEW_COUNTRY_MASTER_PROTOCOL.md # Master blueprint for deploying a new country (Vercel, Cloudflare, Sentry, Auth)
├── AAVIJA_SYSTEM_BLUEPRINT_MASTER.md  # Full system architecture overview
├── DATABASE_MASTER_REFERENCE.md       # Database schema documentation
├── DEVELOPER_NOTES.md                 # Developer notes & conventions
├── OPERATIONS_MANUAL.md               # Operations & maintenance manual
├── whatsapp-template.txt              # WhatsApp message template reference
└── architecture/                      # Role-based architecture docs
    ├── README.md
    ├── agent_architecture.md
    ├── gatekeeper_architecture.md
    ├── host_architecture.md
    ├── management_architecture.md
    └── visitor_architecture.md
```

---

## `scripts/` — Utility & Debug Scripts

```
scripts/
├── check-db.ts              # DB health check script
├── rebuild-master-sql.js     # Rebuilds MASTER_DB_SETUP.sql from migrations
└── debug/                    # One-off debugging & test scripts
    ├── check_schema.ts       # DB schema inspector
    ├── check_settings.js     # Settings validator
    ├── check_table_type.js   # Table type checker
    ├── check_users.ts        # User table checker
    ├── debug_schema.py       # Python DB schema debugger
    ├── inspect_regions.js    # Region data inspector
    ├── inspect_user_tables.js # User table inspector (JS)
    ├── inspect_user_tables.ts # User table inspector (TS)
    ├── list_regions_test.js  # Region listing test
    ├── test-row.js           # Row insertion tester
    ├── test_create_gk.ts     # Gatekeeper creation test
    └── test_otp.ts           # OTP flow tester
```

---

## `src/` — Application Source Code

This is where 95% of development happens.

### `src/app/` — Next.js App Router (Pages & API Routes)

```
src/app/
├── (auth)/              # Auth-related pages (login, OTP, register)
├── (legal)/             # Legal pages (terms, privacy policy)
├── api/                 # API routes
│   ├── analytics/       #   → Analytics endpoints
│   ├── health/          #   → Health-check endpoint
│   ├── upload/          #   → File upload endpoint
│   └── webhooks/        #   → Webhook handlers
├── auth/                # Auth callback handlers
├── dashboard/           # 🏢 Main dashboard (role-based)
│   ├── admin/           #   → Super-admin panel
│   ├── gatekeeper/      #   → Gatekeeper QR scanner & visitor log
│   ├── host/            #   → Host availability & visitor management
│   ├── owner/           #   → Premise owner management
│   ├── staff/           #   → Staff dashboard
│   ├── visitor/         #   → Visitor self-service portal
│   ├── profile/         #   → User profile settings
│   └── change-password/ #   → Password change flow
├── demo/                # Demo/preview pages
├── suggest-location/    # Location suggestion form
├── verify-email/        # Email verification flow
├── layout.tsx           # Root layout (providers, metadata)
├── page.tsx             # Landing page entry
├── globals.css          # Global CSS / Tailwind base
├── sitemap.ts           # Dynamic sitemap generation
└── global-error.tsx     # Global error boundary
```

### `src/components/` — UI Components

```
src/components/
├── auth/                # Auth-specific components
│   └── RoleGuard.tsx    #   → Role-based access control wrapper
├── dashboard/           # Dashboard-specific components
│   └── OnboardingChecklist.tsx
├── landing/             # Landing page components
│   ├── GlobalPortal.tsx
│   └── RegionalHomepageV2.tsx
├── shared/              # Shared components (used across pages)
│   ├── BuyTokensDialog.tsx
│   ├── DashboardCard.tsx
│   ├── EmptyState.tsx
│   ├── GstDetailsCard.tsx
│   ├── LanguageSwitcher.tsx
│   ├── SessionTimeoutWarning.tsx
│   ├── SkeletonLoaders.tsx
│   ├── TokenHistoryCard.tsx
│   ├── install-pwa-button.tsx
│   └── charts/          #   → Chart components
├── ui/                  # Primitive UI library (shadcn/ui based, 29 components)
│   ├── button.tsx, card.tsx, input.tsx, dialog.tsx,
│   ├── select.tsx, table.tsx, toast.tsx, sheet.tsx, ...
│   └── (29 files total)
├── CommandMenu.tsx       # Cmd+K command palette
├── ErrorCard.tsx         # Error display card
├── QrScanner.tsx         # QR code scanner (gatekeeper check-in)
├── ServiceWorkerRegistration.tsx  # PWA service worker
├── Sidebar.tsx           # Main navigation sidebar
├── SnapshotDialog.tsx    # Snapshot/preview dialog
├── SupabaseErrorListener.tsx  # Supabase error handler
├── UserSetupDialog.tsx   # First-time user setup
└── icons.tsx             # Custom SVG icons
```

### `src/services/` — Business Logic & Server Actions

```
src/services/
├── admin-data-service.ts        # Admin data fetching
├── admin-service.ts             # Admin operations
├── agent-ledger-service.ts      # Agent financial ledger
├── agent-service.ts             # Agent CRUD & management
├── announcement-service.ts      # System announcements
├── block-service.ts             # Visitor/user blocking
├── bulk-member-service.ts       # Bulk member operations
├── city-service.ts              # City geography data
├── contact-actions.ts           # Contact form actions
├── contact-service.ts           # Contact service (stub)
├── district-service.ts          # District geography data
├── encryption-service.ts        # PII encryption helpers
├── invoice-service.ts           # Invoice generation & management
├── location-suggestion-service.ts  # Location suggestions (stub)
├── log-actions.ts               # Visitor log write actions
├── log-reader-actions.ts        # Visitor log read actions
├── log-service.ts               # Log service utilities
├── payment-service.ts           # Payment processing
├── premise-application-actions.ts  # Premise application flow
├── premise-category-actions.ts  # Premise categories
├── premise-category-service.ts  # Category data fetching
├── premise-service.ts           # Premise CRUD
├── rating-service.ts            # Visitor ratings
├── referral-service.ts          # Referral & commission system
├── settings-server.ts           # Server-side settings
├── settings-service.ts          # Settings CRUD
├── state-service.ts             # State geography data
├── token-service.ts             # Visitor token management
├── user-service.ts              # User profile CRUD
├── visit-service.ts             # Visit tracking
├── whatsapp-service.ts          # WhatsApp Cloud API integration
└── __tests__/                   # Service unit tests
```

### `src/lib/` — Utilities & Shared Libraries

```
src/lib/
├── supabase/
│   ├── client.ts         # Browser Supabase client
│   └── server.ts         # Server-side Supabase client (cookies-based)
├── env.ts                # Environment variable validation
├── export-csv.ts         # CSV export utility
├── multi-tenant.ts       # Multi-tenancy helpers
├── offline-store.ts      # IndexedDB offline data store
├── rate-limit.ts         # Rate limiting utility
├── sanitize.ts           # Input sanitization
├── user-setup-check.ts   # User first-setup detection
├── utils.ts              # General utilities (cn, etc.)
├── with-timing.ts        # Performance timing wrapper
├── app-check-verification.ts  # App check token verification
└── placeholder-images.json    # Placeholder image data
```

### `src/supabase/` — Supabase Client Providers

```
src/supabase/
├── client-provider.tsx   # Client-side Supabase provider
├── error-emitter.ts      # Error event emitter
├── index.ts              # Re-exports
├── non-blocking-login.tsx # Non-blocking auth login
└── provider.tsx          # Server-side auth provider
```

### Other `src/` Directories

```
src/hooks/               # Custom React hooks
├── use-debounce.ts      #   → Debounce hook
├── use-pwa-install.ts   #   → PWA install prompt hook
└── use-toast.ts         #   → Toast notification hook

src/i18n/                # Internationalization
├── LanguageContext.tsx   #   → Language context provider
└── dictionaries/        #   → Translation JSON files

src/styles/              # Design system
└── design-tokens.json   #   → Color/spacing/typography tokens

src/types/               # TypeScript type definitions
└── database.types.ts    #   → Supabase auto-generated DB types

src/__tests__/           # Integration / E2E tests
src/test/                # Test utilities & setup

src/middleware.ts         # Next.js middleware (auth, i18n routing)
src/instrumentation.ts   # Sentry server instrumentation
src/instrumentation-client.ts  # Sentry client instrumentation
```

---

## `supabase/` — Database Migrations (Supabase CLI)

```
supabase/
└── migrations/                   # Database migrations & consolidated setup
    └── CONSOLIDATED_FINAL_SETUP.sql # Full consolidated schema (snake_case clean)
```

> 1. **MASTER SCHEMA SYNC (CRITICAL): Whenever a new file is created to run on the Supabase SQL editor, those changes MUST ALSO be reflected and updated inside `supabase/migrations/CONSOLIDATED_FINAL_SETUP.sql`. This ensures that setting up a new database for a new country can always be done flawlessly without repeating historical migration phases.**
> - Active master schema lives directly at `supabase/migrations/CONSOLIDATED_FINAL_SETUP.sql`.

---

## Root Config Files (Quick Reference)

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js configuration (redirects, headers, i18n) |
| `tailwind.config.ts` | Tailwind CSS theme & plugin config |
| `tsconfig.json` | TypeScript compiler options |
| `package.json` | Dependencies & npm scripts |
| `postcss.config.mjs` | PostCSS plugins |
| `components.json` | shadcn/ui component config |
| `vitest.config.ts` | Vitest test runner config |
| `sentry.*.config.ts` | Sentry error reporting config |
| `.env.local` | Environment variables (secrets — git-ignored) |
| `.env.example` | Env template for new developers |
| `.eslintrc.json` | ESLint rules |
| `.gitignore` | Git ignore rules |
| `README.md` | Project README |

---

## Key User Roles in the App

| Role | Dashboard Route | Description |
|------|----------------|-------------|
| **Admin** | `/dashboard/admin` | Super-admin — manages entire platform |
| **Owner** | `/dashboard/owner` | Premise owner — manages their premise |
| **Gatekeeper** | `/dashboard/gatekeeper` | Scans visitor QR codes at entry |
| **Host** | `/dashboard/host` | Receives & approves visitors |
| **Staff** | `/dashboard/staff` | Staff member within a premise |
| **Visitor** | `/dashboard/visitor` | Self-service visitor portal |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14+ (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (OTP via WhatsApp) |
| **Notifications** | WhatsApp Cloud API |
| **Monitoring** | Sentry |
| **PWA** | Service Worker + manifest.json |
| **i18n** | Custom dictionary-based system |
| **Testing** | Vitest |
