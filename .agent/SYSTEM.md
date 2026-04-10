# 🤖 Aavija VMS — System Architecture & Rules

## 🌍 Project Identity & Vision
**Aavija Visitor Management System (VMS)** is a world-class, multi-tenant platform. It is designed to be deployed globally, starting with India and expanding to regions like Dubai (UAE).

## 🧠 Agent Operational Protocol (CRITICAL)
1. **MASTER SCHEMA SYNC (CRITICAL): Whenever a new file is created to run on the Supabase SQL editor, those changes MUST ALSO be reflected and updated inside `supabase/CONSOLIDATED_FINAL_SETUP.sql`. This ensures that setting up a new database for a new country can always be done flawlessly without repeating historical migration phases.**
2. **NEW COUNTRY SYNCHRONIZATION RULE (CRITICAL): The file `docs/AAVIJA_NEW_COUNTRY_MASTER_PROTOCOL.md` is the absolute Source of Truth for launching the product in a new region. If you add a new environment variable, a new feature that requires third-party API keys (e.g., Razorpay, WhatsApp, Sentry, Google OAuth), or modify infrastructure configurations (Vercel, Cloudflare, Supabase), you MUST update this Protocol document so future countries launch flawlessly. This is a non-negotiable rule.**
3. **SOFT-CODING PRINCIPLE (CRITICAL)**: NEVER hardcode magic numbers for business logic, timings, or thresholds (e.g., `const timeout = 60000`). All tunable parameters MUST be created as configurable columns in the `public.settings` table so the Site Admin can adjust them dynamically from the Dashboard without touching source code.
4. **GPS Rule**: ALWAYS consult `.agent/MAP.md` before suggesting code. **CRITICAL:** If you create, move, or delete ANY file in this project, you MUST immediately update `.agent/MAP.md` and `.agent/SYSTEM.md` to reflect the new state. This is a non-negotiable rule.
5. **TOKEN EFFICIENCY (CRITICAL)**: NEVER read massive binary files, package locks (`package-lock.json`), or massive auto-generated folders (`.next/`, `node_modules/`). Always respect `.cursorignore` and `.agentignore` lists. If you encounter a monolithic "Mega-Page" (>30KB), you MUST break down complex Modals, Tables, and Forms into isolated subcomponents to strictly preserve AI context limits.
6. **Honesty Policy**: If a task is complex, break it into small, verifiable steps for the user.

## 📁 Folder Conventions
| What | Where | Notes |
|------|-------|-------|
| Application source code | `src/` | Pages in `src/app/`, components in `src/components/`, business logic in `src/services/`, utilities in `src/lib/` |
| All project documentation | `docs/` | Blueprint, guides, manuals, architecture docs, reports |
| Role-based architecture docs | `docs/architecture/` | One file per user role |
| Diagnostic / audit reports | `docs/reports/` | CSV exports, diagnostics dumps |
| Utility scripts (production) | `scripts/` | DB health check, SQL rebuild |
| Debug / one-off test scripts | `scripts/debug/` | Schema inspectors, test helpers — NOT at root |
| Database migrations (live) | `supabase/migrations/` | Managed by Supabase CLI |
| Static assets | `public/` | Icons, manifest, service-worker, sample CSVs |
| Agent config & docs | `.agent/` | MAP.md and this file |

> ⚠️ **NEVER place loose scripts, docs, or data files in the project root.** Use the appropriate folder above.

## 💾 Database & Multi-Country Scaling
- **The Master File**: `supabase/CONSOLIDATED_FINAL_SETUP.sql` is the "Source of Truth."
- **Deployment Rule**: Any change to the database (tables, RLS, functions) MUST be mirrored in this Master File so a new country can be launched with a single script execution.
- **Security**: Strict Row Level Security (RLS) is non-negotiable. PII must be encrypted using `pgp_sym_encrypt`.

## 🏗️ Engineering Standards
- **Tech Stack**: Next.js 14+, Supabase, Tailwind CSS, shadcn/ui.
- **Business Logic**: Keep logic in `src/services/`. Keep UI components in `src/components/` "dumb" and focused on display.
- **Internationalization**: NEVER hardcode strings. Use `src/i18n/dictionaries/` for all text to support global users.
- **Reliability**: Use Sentry for tracking and Toast notifications for user feedback.
- **CASE CONSISTENCY RULE**: Always use `camelCase` for TypeScript/Frontend variables and `snake_case` for Database columns and SQL functions. Before finalizing any code, check for and correct any "mixed" casing to ensure the codebase remains uniform.

## 🧹 Codebase Hygiene
- **No root clutter**: All scripts go in `scripts/` or `scripts/debug/`. All docs go in `docs/`.
- Maintain the `src/lib/` folder for shared utilities (Supabase clients, encryption, etc.).
- **Documentation Sync**: After any file relocation, creation, or deletion, you MUST update `.agent/MAP.md` and `.agent/SYSTEM.md`.
- Active master schema lives directly at `supabase/CONSOLIDATED_FINAL_SETUP.sql`.