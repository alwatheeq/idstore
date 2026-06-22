# Accounting — Design

**Date:** 2026-06-23
**Status:** Designed (brainstorming locked); not yet built.
**Scope:** Financial **reporting only** (read/aggregate). No expense entry, no double-entry bookkeeping.

## Decisions (locked via brainstorming)
- **Scope = reporting only.** Read-only aggregations over existing data (invoices, payments, purchase orders). No new tables, **no migration**. Expense tracking + chart-of-accounts explicitly deferred (YAGNI).
- **Revenue basis = cash.** The headline revenue figure is money **received** (`payments`), not invoiced. Outstanding **receivables** is shown alongside as its own number so the full story is told without an accrual report.
- **Reports included (4):** (1) Revenue (cash in) + month trend, (2) Outstanding receivables + open-invoice list, (3) Payments by method, (4) Purchases (cash out). Parts-margin, per-branch comparison, and top-customers reports were considered and **dropped** for now.
- **Period control:** preset ranges — *This month · Last month · This year · Custom (from–to)* — default **This month** on load. Receivables is "as of now" and ignores the range.
- **Branch scope:** follows the existing `useActiveBranch()` + RLS pattern. Active branch → filtered; **"All branches"** (super-admin) → consolidated **sum** (no side-by-side breakdown, since the comparison report was dropped). A `micro` caption flags consolidated mode.

## Data sources (all existing — verified against schema)
- **Revenue (cash in)** = `Σ payments.amount` where `payments.paid_at ∈ [from, to)`. Month trend buckets the same rows by `paid_at` month. Branch scope: `payments` reaches branch via its parent `invoices.branch_id` (payments has no `branch_id`).
- **Receivables (as of now)** = invoices with `payment_status ∈ ('unpaid','partial')`; per-invoice `balance = total − Σ(its payments.amount)`. Branch scope: `invoices.branch_id` (denormalized in 0007).
- **Payments by method** = period payments grouped by `method` → `{method, count, total}`. Sum of rows reconciles to Revenue.
- **Purchases (cash out)** = purchase orders with `status='received'` AND `received_at ∈ [from, to)`; value = `Σ lines(received_qty × unit_cost)`. Branch scope: `purchase_orders.branch_id`.

## Architecture — `src/features/accounting/`
Follows the repo's feature-folder convention (`types`/`api`/`hooks` + pure helpers, TDD for logic).
- `types.ts` — `DateRange`, `PresetKey`, `RevenueSummary` (total + `MonthBucket[]`), `ReceivablesSummary` (total + `OpenInvoice[]`), `MethodBreakdown` (`MethodRow[]`), `PurchasesSummary` (total + `ReceivedPO[]`), umbrella `AccountingSummary`.
- `period.ts` (+ `period.test.ts`) — **pure**: `presetRange(key, now)` → `{from, to}` (half-open `[from, to)`); `monthBuckets(range)` / bucket-by-`paid_at`. Deterministic given an injected `now`.
- `summary.ts` (+ `summary.test.ts`) — **pure**, Supabase-free: `sumPayments`, `groupByMethod`, `computeReceivables(openInvoices, paymentsByInvoice)`, `sumReceivedPurchases(poLines)`. All money math via `src/lib/money.ts` (JOD 3-decimals; no float drift).
- `api.ts` — Supabase queries scoped by `branchId` + range: `fetchPayments`, `fetchOpenInvoices`, `fetchReceivedPurchases`.
- `hooks.ts` — TanStack Query: `useAccountingSummary(range)` keyed `['accounting', branchId, range]`; errors via `useToast`.

## UI — `src/pages/AccountingPage.tsx` (route `/accounting`)
Volt Instrument design system; generous spacing; all figures in `.num` mono.
- **`PageHeader`** — eyebrow "Finance", title "Accounting"; right side = segmented period presets, Custom reveals from/to inputs. `micro` "Consolidated — all branches" caption under "All branches".
- **Row 1 — headline KPIs:** Revenue (cash in) big JOD figure + month-by-month charge-bar trend; Outstanding receivables (warning tint, period-independent).
- **Row 2 — detail cards:** Payments by method (Cash/Card/Transfer rows: label, count, amount, proportion bar; reconciles to Revenue); Purchases (cash out) total + short list of received POs (number, supplier, received date, value) linking `/purchase-orders/:id`.
- **Receivables drill-down:** list of open invoices (number, customer, issued date, total, **balance due**) each linking to invoice detail — the "who to chase" list.
- **States:** loading skeleton; per-card empty states ("No payments in this period"); admin-only via `RequireRole`. New Sidebar nav item (SVG icon, volt active bar), admin-gated.

## Edge cases
- **Half-open ranges** `[from, to)` so month/period boundaries never double-count.
- **Branch:** `branchId` null ("All branches") → no filter, RLS limits regular admins to home, super sees all (summed). Payments scope via parent invoice's `branch_id`.
- **No negatives:** payments are positive-only (DB check) → revenue can't go negative; a fully-paid invoice drops out of receivables automatically.
- **Timezone:** ranges built in local time, normalized to ISO boundaries against `timestamptz`, so "this month" is the owner's month.

## Testing (TDD-first)
- `period.test.ts` — presets + bucketing against a fixed `now`.
- `summary.test.ts` — each aggregator; the reconciliation invariant (method totals = revenue); empty-data paths.
- `AccountingPage.test.tsx` — renders the 4 cards with mocked hooks; period switch refetches; "All branches" shows consolidated caption.

## Out of scope (deferred)
Expense tracking (→ true P&L), parts gross-margin report, per-branch comparison, top customers, supplier-payment tracking (POs have no payment records — "cash out" approximated by received-PO value), export/PDF.

## Delivery
No migration; nothing to apply to prod. Build bottom-up (types → pure helpers (TDD) → api → hooks → page → nav wiring), suite green throughout; `npm run build` clean; commit on `feat/accounting`.
