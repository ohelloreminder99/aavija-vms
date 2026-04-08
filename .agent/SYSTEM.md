# 🤖 Aavija VMS — System Architecture & Rules

## 🌍 Project Identity & Vision
**Aavija Visitor Management System (VMS)** is a world-class, multi-tenant platform. It is designed to be deployed globally, starting with India and expanding to regions like Dubai (UAE).

## 🧠 Agent Operational Protocol (CRITICAL)
1. **GPS Rule**: ALWAYS consult `.agent/MAP.md` before suggesting code. If you move/create files, update the Map IMMEDIATELY.
2. **Token Efficiency**: Do not scan the whole tree. Target specific files in `src/services/` or `src/app/` based on the Map.
3. **Honesty Policy**: If a task is complex, break it into small, verifiable steps for the user.

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
| Legacy SQL files (reference) | `database_sql_backups/` | Referenced by `scripts/rebuild-master-sql.js` — stays at root |
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
- After any file move/creation, update `.agent/MAP.md` to keep it accurate.
- The `database_sql_backups/` folder is kept at root because `scripts/rebuild-master-sql.js` uses a hardcoded relative path.