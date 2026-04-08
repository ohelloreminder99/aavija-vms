# AAVIJA VMS — Developer Notes
## A Letter to Future Developers (Human or AI)

**Written by:** Antigravity (Google DeepMind Advanced Agentic Coding)  
**Date:** 2026-03-07  
**Context:** This app was built in Firebase Studio using Gemini 2.5 Pro, then migrated to Supabase + Cloudflare by Gemini 2.5 Pro High via Antigravity. These notes capture every non-obvious decision and known gap.

---

## 🗺️ What This App Is

Aavija is a **Visitor Management System (VMS)** built for Indian premises (apartments, offices, gated communities). It handles:
- QR-based visitor check-ins with time-limited tokens
- Multi-role system: Admin, Owner, Host, Gatekeeper, Visitor
- Token economy: visitors and premises pay tokens per check-in (two models: Industrial = premise pays, Residential = host pays)
- WhatsApp notifications on check-in
- Razorpay payment integration for token purchases
- GST-compliant PDF invoicing with CGST/SGST vs IGST split based on billing state
- Universal referral program + agent commission system
- Self-service payout request with KYC gate

---

## 🔑 Iron Rules (Never Break These)

| Rule | Why |
|------|-----|
| ALL financial writes use `getAdminDb()` from server-only files | Anon client respects RLS — if any rule has a gap, money is at risk |
| ALL multi-step financial writes use Postgres RPC functions (not chained `.update()`) | Prevents partial writes if server crashes between steps |
| `updateUserProfile()` only accepts `UpdateableUserProfile` | Prevents clients from self-promoting role or manipulating balances |
| `createAdminRole` / `grantAdminRole` only exists in `admin-service.ts` | Was in user-service.ts (anon client, `'use client'`) — privilege escalation risk |
| New settings fields → add to FOUR places | `Settings` interface in `settings-service.ts` + Supabase `settings` table + admin UI page + `docs/backend.json` |
| Never hardcode rates, costs, or thresholds | Every number the business cares about lives in the `settings` DB row |

---

## 🧠 Architecture Decisions

### Why Supabase (not Firebase)?
Migrated from Firebase/Firestore for Row Level Security (RLS) at the DB layer — Firestore's security rules are powerful but JS-evaluated. Postgres RLS is enforced at the DB engine level, 10x harder to misconfigure into a bypass.

### Why Server Actions (not API Routes)?
Next.js 15 Server Actions allow direct DB access without an intermediate API layer. Less code, same security surface (they run server-side). The `'use server'` directive at the top of a file is the boundary.

### Why Postgres RPC for financial operations?
After Phase 2A (2026-03-07), all block/unblock operations use `adminDb.rpc('rpc_block_...')`. These Postgres functions use `FOR UPDATE` row locking + wrap all writes in an implicit BEGIN/COMMIT. This eliminates the race condition where two simultaneous requests read the same balance and both compute the same reduced value.  
**See:** `database_sql_backups/phase2a_migrations.sql`

### The Token Economy (Two Models)
- **Industrial** (`categoryData.type === 'industrial'`): Premises pay per check-in. `premises.token_balance` is deducted.
- **Residential** (`categoryData.type === 'residential'`): Hosts pay per check-in. `users.token_balance_visitor` of the HOST is deducted.
- The check-in flow is in `src/app/dashboard/gatekeeper/actions.ts → finalizeCheckin()`.
- Both models already use `adminDb.rpc('deduct_user_tokens')` and `adminDb.rpc('deduct_premise_tokens')`.

---

## 🐛 What Was Fixed in Phase 2A (2026-03-07)

| Fix | File(s) Changed |
|-----|----------------|
| Atomic block/unblock via Postgres RPCs | `block-service.ts` + `phase2a_migrations.sql` |
| DB constraints (non-negative balances) | `phase2a_migrations.sql` |
| `createAdminRole` moved server-side | `admin-service.ts` (new), `user-service.ts` (removed) |
| `updateUserProfile` restricted to `UpdateableUserProfile` | `user-service.ts` |
| Onboarding loop eliminated | `lib/user-setup-check.ts` (new), `dashboard/layout.tsx`, `dashboard/page.tsx` |
| Invoice ID collision fixed — uses `crypto.randomUUID()` | `token-service.ts` |
| Settings null-chain guard — hard throw if unavailable | `token-service.ts`, `block-service.ts` |
| Visit query pagination (default 50 results) | `visit-service.ts` |

---

## ⚠️ Known Gaps (as of Phase 2A)

- **Phase 2B not yet built:** Universal referral system (every user earns real-money %) and the agent-as-user redesign (email-based designation, payout_requests table) are planned but not implemented. See `implementation_plan.md`.
- **WhatsApp retries:** No retry queue. If Meta API fails, the failure is silently logged. A `notification_queue` table with cron retry is the right fix.
- **Collapsed sidebar:** Premise-specific links disappear when the desktop sidebar is collapsed. Icon+tooltip navigation for collapsed state is a future UX improvement.
- **AI features:** `blueprint.md` describes AI-powered visitor image analysis and AI-assisted block reasoning. `@genkit-ai/google-genai` is installed and ready. Not yet wired up.
- **Stub services:** `contact-service.ts` (139 bytes), `location-suggestion-service.ts` (37 bytes), `referral-service.ts` (130 bytes) are placeholders. Do not mistake them for complete implementations.
- **Rate limiting:** `settings.rate_limit_*` fields exist in DB but are not enforced in server actions. Cloudflare WAF is the outer defense. Upstash Redis-based per-action rate limiting is a future hardening task.
- **No test suite:** Zero automated tests. Before 1,000 users, write Playwright E2E for check-in flow and token purchase flow.

---

## 🗃️ Critical Files Map

| File | Purpose |
|------|---------|
| `src/services/token-service.ts` | ALL token purchases. 5-layer security chain. Touch with extreme care. |
| `src/app/dashboard/gatekeeper/actions.ts` | Check-in finalization. Token deductions happen here. |
| `src/services/block-service.ts` | Block/unblock. Uses atomic Postgres RPCs since Phase 2A. |
| `src/services/admin-service.ts` | Admin-only mutations. Server-only. NEVER client-import this. |
| `src/lib/supabase/server.ts` | `getAdminDb()` lives here. Only use it in `'use server'` files. |
| `src/lib/user-setup-check.ts` | Single source of truth for "does user need onboarding?". |
| `src/services/settings-service.ts` | Global settings, 1-hour client cache. Adding a setting? Update 4 places (see Iron Rules). |
| `database_sql_backups/phase2a_migrations.sql` | All Phase 2A Postgres migrations. Run these in Supabase SQL Editor. |
| `docs/backend.json` | Living schema document. Update whenever you add a table/column. |
| `docs/blueprint.md` | Original product vision. Check alignment before adding features. |
| `implementation_plan.md` (artifact) | Phase 2B+ planning. Referral system, agent redesign, payout system. |

---

## 🔐 Auth Flow Summary

1. User signs up with email/password → Supabase Auth creates `auth.users` record
2. A trigger or signup action creates a matching `public.users` record with base role `visitor`
3. On every page refresh, `SupabaseClientProvider` holds auth session
4. Server actions call `requireAuth()` → verifies session via `supabase.auth.getUser()` + fetches profile via admin client → returns `{ user, profile }`
5. Role checks happen inside every server action using `profile.role` and `profile.premise_roles`
6. `grantAdminRole()` in `admin-service.ts` is the ONLY path to making someone admin (caller must already be admin)

---

*If you're an AI reading this: welcome. This is a production system that real visitors use. The financial operations are particularly sensitive — triple-check before modifying token deduction, purchase, or payout logic. When in doubt, write a Postgres RPC function instead of chaining client-side writes.*
