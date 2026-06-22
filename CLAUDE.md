# CLAUDE.md

Guidance for AI agents working in this repo. Keep it accurate and concise — it loads into every session.

## What this is
**Watheeq EV / "idstore"** — a management app for a Volkswagen **electric-vehicle** service center. Bilingual **English-first (LTR) + Arabic (RTL) toggle**. Admin app + a read-only **customer portal**. See `README.md` for setup and `docs/superpowers/` for the per-module specs & plans.

## Commands
- `npm run dev` — dev server (Vite). Don't run it in automation; it's long-running.
- `npm test` — Vitest (run mode). **Always green before committing.**
- `npm run build` — `tsc -b && vite build` (strict typecheck + bundle). Must be clean.
- `npm run lint` — ESLint (flat config).

## Stack
Vite + React 19 + TypeScript (strict, `verbatimModuleSyntax`) · Supabase (Postgres/Auth/Storage) · Tailwind v3 · Radix `DirectionProvider` · react-i18next · TanStack Query v5 · react-router-dom v7 · react-hook-form + **zod v4** · Vitest + Testing Library.

## Architecture / where things live
- `src/features/<feature>/` — feature-scoped `types.ts`, `schema.ts` (zod), `api.ts` (Supabase calls), `hooks.ts` (TanStack Query), components. Features: `customers`, `orders`, `invoices`, `dashboard`, `portal`.
- `src/pages/` — route page components (admin); `src/pages/portal/` — customer portal pages.
- `src/auth/` — `AuthProvider`, `useAuth`, `useRole` (admin vs customer), `RequireRole` guard, admin `LoginPage`.
- `src/lib/` — `supabase.ts` (client), `money.ts` (currency math), `branch.ts`, `phone.ts`.
- `src/components/ui/` — shared primitives: `TextField`, `Button` (+ `buttonClasses`), `Select`, `Toast` (`useToast`).
- `supabase/migrations/` — SQL migrations (see "Database" below).

## Conventions (follow these)
- **Money:** Jordanian Dinar (JOD), **3 decimals** everywhere (`toFixed(3)`). All money math goes through `src/lib/money.ts` (`computeLineTotal`, `computeInvoiceTotals`, `derivePaymentStatus`) — never re-implement it.
- **Zod schema = the persistence source of truth.** A column missing from a feature's `schema.ts` input silently won't save. Add new columns to the schema.
- **i18n parity is enforced** by a test — every key must exist in BOTH `src/i18n/en.json` and `ar.json`. Arabic must be natural (not machine-literal). All user-facing text via `t()`.
- **RTL-safe styling only** — use logical Tailwind classes (`ms-`/`me-`/`ps-`/`pe-`/`border-e`); never hardcoded `left`/`right`/`ml`/`mr`. (Known debt: literal `←` back-arrows don't mirror.)
- **Data hooks** wrap api with TanStack Query; mutations `invalidateQueries` the relevant keys and surface errors via `useToast`. Forms use `useForm<FormValues, unknown, Payload>` + `zodResolver` so `onSubmit` gets the transformed payload; async-loaded edit forms need the `values` prop (not just `defaultValues`).
- **Generous spacing** in UI (the owner's preference): `space-y-*`, block labels, padded inputs — don't cram.
- **TDD for logic** (money, schemas, helpers); components tested with mocked hooks/data.

## Security model (important)
- RLS is **per-customer** (migration `0003`): every table SELECT = `is_admin() OR owned-by current_customer_id()`; writes = `is_admin()` only. `admin_users` table lists admins. The customer portal is **read-only** at both the UI and RLS layers — never add customer write paths.
- Customer portal auth = **phone + 6-digit PIN** → `phoneToEmail()` synthetic email → `signInWithPassword`. Provisioning is client-side via a throwaway Supabase client (no server). `useRole` is **fail-closed**: unknown users → `"none"` → login, never admin.

## Database / migrations — DO NOT auto-apply to prod
- Migrations live in `supabase/migrations/`. **Applying them to the live DB is a human-authorized step** — the auto-classifier blocks prod writes on vague prompts; ask for explicit authorization, or have the user run the SQL. (Project ref `hbsbbsbezqlxqslkwquy`; env var is `VITE_SUPABASE_PUBLISHABLE_KEY`, not `ANON_KEY`.)
- **Applied to prod:** `0001`, `0002_invoices_unique_order.sql`, `0003_customer_portal_rls.sql` (the `admin_users` seed was bundled into the 0003 apply via `insert ... select id from auth.users`, since there was a single auth user = the admin).
- **Applied to prod:** also `0004_software_updates.sql`, `0005_vehicle_model_images.sql`, `0006_order_concerns.sql`, `0007_multi_branch.sql` (branch metadata, `admin_users.home_branch_id`+`can_access_all_branches` with the existing owner seeded super, `invoices.branch_id` backfill, branch-scoped RLS via `is_super_admin()`/`admin_home_branch()`/`can_access_branch(b)`), and `0008_inventory.sql` (shared catalog `inventory_items`+`suppliers`; per-branch `inventory_stock` + `inventory_movements` ledger with a `apply_inventory_movement` trigger that keeps stock in sync; branch-scoped RLS on stock/movements). No pending migrations.
- **Multi-branch model:** admins have a home branch + a super flag; super sees all branches and an "All branches" view, regular admins are pinned to home (RLS-enforced). The app scopes every query/insert to the **active branch** (React context `useActiveBranch()`, top-bar `BranchSwitcher`). Inserts require a concrete branch — create actions are disabled under "All branches".

## Working style
- Branch per module/sub-project; merge to `main` and push to GitHub (`alwatheeq/idstore`) when done. Don't commit/push unless asked.
- **After any subagent/file-gen work, run `git status`** — a cut-off generator has twice left source files untracked that still built locally (only caught at push). Tracked ≠ on-disk.
- Each module = its own spec → plan → reviewed build (see `docs/superpowers/{specs,plans}/`).

## Phase status
Phase 1 (operational core) complete: CRM, Service Orders + intake/inspection, Invoicing, Dashboard. Phase 2: Customer Portal, Software-update tracking done; Notifications (WhatsApp) remain. Phase 3 (in progress): **multi-branch DONE** (Phase A — branch CRUD, active-branch context/switcher, branch-scoped queries + RLS). Remaining Phase 3: inventory — **Phase B DONE** (catalog/suppliers/per-branch stock/movements receive·issue·adjust·transfer·count/low-stock/valuation; `src/features/inventory/`, `/inventory` + `/inventory/:id` + `/suppliers`); **Phase C** (purchase orders), **Phase D** (order↔inventory: pick parts from catalog → auto-decrement stock). Then accounting. UI uses the "Volt Instrument" design system (see `src/index.css` tokens).
