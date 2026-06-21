# VW EV Service Center — Phase 1 Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The manager's landing screen — four KPI cards (cars in workshop, awaiting approval, ready for handover, invoiced today) over a live "workshop by stage" board (active orders grouped by status). Reuses existing orders/invoices data; no new tables.

**Architecture:** A small `src/features/dashboard/` with a PURE, fully-tested aggregation helper (`computeDashboard(orders, invoices, now)`) so all the counting/grouping/date logic is unit-tested without React. The `DashboardPage` fetches all orders (`useOrders()`) + all invoices (`useInvoices()`) and renders KPIs + the board, reusing `OrderStatusBadge`/`statusLabel`. `new Date()` is used in the page (app runtime — fine) and passed into the pure helper as a param (so tests are deterministic).

**Tech Stack:** existing. No new deps.

---

## File Structure
```
src/
├─ features/dashboard/
│  ├─ stats.ts            # computeDashboard (pure) + BOARD_STATUSES
│  ├─ stats.test.ts
│  └─ KpiCard.tsx         # presentational KPI tile
├─ pages/
│  ├─ DashboardPage.tsx   # MODIFY: KPIs + workshop-by-stage board (replaces placeholder)
│  └─ DashboardPage.test.tsx
└─ i18n/{en,ar}.json      # MODIFY: dashboard.* strings
```
Routes: `/` already maps to `DashboardPage` — no route changes.

---

## Task 1: i18n + stats helper (TDD) + KpiCard

**Files:** modify `src/i18n/{en,ar}.json`; create `src/features/dashboard/stats.ts`, `stats.test.ts`, `KpiCard.tsx`.

- [ ] **Step 1: Add to `en.json`** (merge, keep existing):
```json
"dashboard": {
  "title": "Dashboard", "carsInWorkshop": "Cars in workshop", "awaitingApproval": "Awaiting approval",
  "readyForHandover": "Ready for handover", "invoicedToday": "Invoiced today",
  "byStage": "Workshop by stage", "empty": "No active orders"
}
```

- [ ] **Step 2: Add the SAME keys (Arabic) to `ar.json`:**
```json
"dashboard": {
  "title": "لوحة التحكم", "carsInWorkshop": "مركبات في الورشة", "awaitingApproval": "بانتظار الموافقة",
  "readyForHandover": "جاهزة للتسليم", "invoicedToday": "فواتير اليوم",
  "byStage": "الورشة حسب المرحلة", "empty": "لا توجد أوامر نشطة"
}
```

- [ ] **Step 3: Write `src/features/dashboard/stats.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { computeDashboard } from "@/features/dashboard/stats";
import type { OrderListRow } from "@/features/orders/types";
import type { InvoiceListRow } from "@/features/invoices/types";

const order = (over: Partial<OrderListRow>): OrderListRow => ({
  id: "o", branch_id: "b", vehicle_id: "v", customer_id: "c", order_number: 1, status: "intake",
  odometer_at_intake: null, charge_percent: null, hv_battery_state: null, reported_concerns: null,
  intake_notes: null, approved_at: null, approved_by: null, closed_at: null,
  next_service_due_date: null, next_service_due_odometer: null, created_at: "", updated_at: "",
  customers: null, vehicles: null, ...over,
});
const invoice = (over: Partial<InvoiceListRow>): InvoiceListRow => ({
  id: "i", service_order_id: "o", invoice_number: 1, currency: "JOD",
  subtotal: 0, discount_total: 0, total: 0, payment_status: "unpaid", issued_at: "",
  service_orders: null, ...over,
});

describe("computeDashboard", () => {
  const now = new Date("2026-06-21T10:00:00Z");

  it("counts cars in workshop (active statuses, excludes appointment/closed/cancelled)", () => {
    const orders = [
      order({ status: "intake" }), order({ status: "in_progress" }), order({ status: "ready" }),
      order({ status: "appointment" }), order({ status: "closed" }), order({ status: "cancelled" }),
    ];
    const s = computeDashboard(orders, [], now);
    expect(s.carsInWorkshop).toBe(3);
  });

  it("counts awaiting approval and ready for handover", () => {
    const orders = [order({ status: "awaiting_approval" }), order({ status: "awaiting_approval" }), order({ status: "ready" })];
    const s = computeDashboard(orders, [], now);
    expect(s.awaitingApproval).toBe(2);
    expect(s.readyForHandover).toBe(1);
  });

  it("sums invoiced-today by issued_at date only (ignores other days)", () => {
    const invoices = [
      invoice({ total: 100, issued_at: "2026-06-21T08:00:00Z" }),
      invoice({ total: 50, issued_at: "2026-06-21T23:00:00Z" }),
      invoice({ total: 999, issued_at: "2026-06-20T23:00:00Z" }),
    ];
    const s = computeDashboard([], invoices, now);
    expect(s.invoicedToday).toBe(150);
  });

  it("groups active orders into board columns, omitting empty stages", () => {
    const orders = [order({ status: "intake", id: "a" }), order({ status: "intake", id: "b" }), order({ status: "qc", id: "c" })];
    const s = computeDashboard(orders, [], now);
    const intakeCol = s.board.find((c) => c.status === "intake");
    expect(intakeCol?.orders.length).toBe(2);
    expect(s.board.some((c) => c.status === "diagnosis")).toBe(false); // empty stage omitted
  });
});
```

- [ ] **Step 4:** `npm test` → FAIL.

- [ ] **Step 5: Create `src/features/dashboard/stats.ts`:**
```ts
import type { OrderListRow, OrderStatus } from "@/features/orders/types";
import type { InvoiceListRow } from "@/features/invoices/types";

// Active pipeline stages shown on the board / counted as "in workshop".
export const BOARD_STATUSES: OrderStatus[] = [
  "intake", "diagnosis", "estimate", "awaiting_approval", "in_progress", "qc", "ready",
];

const round3 = (n: number): number => Math.round(n * 1000 + Number.EPSILON) / 1000;

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export interface BoardColumn { status: OrderStatus; orders: OrderListRow[]; }
export interface DashboardStats {
  carsInWorkshop: number;
  awaitingApproval: number;
  readyForHandover: number;
  invoicedToday: number;
  board: BoardColumn[];
}

export function computeDashboard(orders: OrderListRow[], invoices: InvoiceListRow[], now: Date): DashboardStats {
  const active = new Set<OrderStatus>(BOARD_STATUSES);
  const carsInWorkshop = orders.filter((o) => active.has(o.status)).length;
  const awaitingApproval = orders.filter((o) => o.status === "awaiting_approval").length;
  const readyForHandover = orders.filter((o) => o.status === "ready").length;
  const invoicedToday = round3(
    invoices
      .filter((i) => i.issued_at && sameDay(new Date(i.issued_at), now))
      .reduce((s, i) => s + i.total, 0),
  );
  const board: BoardColumn[] = BOARD_STATUSES
    .map((status) => ({ status, orders: orders.filter((o) => o.status === status) }))
    .filter((col) => col.orders.length > 0);
  return { carsInWorkshop, awaitingApproval, readyForHandover, invoicedToday, board };
}
```

- [ ] **Step 6:** `npm test` → PASS.

- [ ] **Step 7: Create `src/features/dashboard/KpiCard.tsx`:**
```tsx
export function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-xl p-4 space-y-1">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs opacity-60">{label}</div>
    </div>
  );
}
```

- [ ] **Step 8:** `npm test` + `npm run build`. Commit: `feat(dashboard): i18n, stats helper, and KPI card`

---

## Task 2: Dashboard page (KPIs + board)

**Files:** modify `src/pages/DashboardPage.tsx` (named export, routed at `/`); create `src/pages/DashboardPage.test.tsx`.

- [ ] **Step 1: Replace `src/pages/DashboardPage.tsx`:**
```tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrders } from "@/features/orders/hooks";
import { useInvoices } from "@/features/invoices/hooks";
import { statusLabel } from "@/features/orders/status";
import { computeDashboard } from "@/features/dashboard/stats";
import { KpiCard } from "@/features/dashboard/KpiCard";

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: orders, isLoading } = useOrders();
  const { data: invoices } = useInvoices();
  const stats = computeDashboard(orders ?? [], invoices ?? [], new Date());

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold">{t("dashboard.title")}</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("dashboard.carsInWorkshop")} value={stats.carsInWorkshop} />
        <KpiCard label={t("dashboard.awaitingApproval")} value={stats.awaitingApproval} />
        <KpiCard label={t("dashboard.readyForHandover")} value={stats.readyForHandover} />
        <KpiCard label={t("dashboard.invoicedToday")} value={`${stats.invoicedToday.toFixed(3)} JOD`} />
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">{t("dashboard.byStage")}</h3>
        {isLoading ? (
          <p className="opacity-70">{t("common.loading")}</p>
        ) : stats.board.length === 0 ? (
          <p className="opacity-70">{t("dashboard.empty")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.board.map((col) => (
              <div key={col.status} className="space-y-2">
                <h4 className="text-xs uppercase tracking-wide opacity-60">
                  {statusLabel(t, col.status)} ({col.orders.length})
                </h4>
                {col.orders.map((o) => (
                  <Link key={o.id} to={`/orders/${o.id}`}
                    className="block border rounded-lg px-3 py-2 hover:bg-gray-50 text-sm">
                    <span className="font-medium">
                      #{o.order_number} {o.vehicles?.model ?? ""} {o.vehicles?.plate_number ?? ""}
                    </span>
                    <span className="block opacity-60">{o.customers?.name ?? ""}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/DashboardPage.test.tsx`** — mock `@/features/orders/hooks` (`useOrders`) and `@/features/invoices/hooks` (`useInvoices`); render with a few orders (mixed statuses) + one invoice; assert: a KPI value renders (e.g. cars-in-workshop count), a board column heading (a status label) renders, and an order card (`#N`) links. Add an empty-board case. Wrap in I18nextProvider + MemoryRouter; reset i18n to "en". Mirror `ServiceOrdersPage.test.tsx`.

- [ ] **Step 3:** `npm test` (all pass) + `npm run build`. Commit: `feat(dashboard): manager dashboard with KPIs and stage board`

---

## Task 3: Final review + finish

- [ ] **Step 1:** Final whole-module review (cross-cutting: i18n parity, the helper's correctness vs the page, reuse of orders/invoices hooks, no new fetch patterns, RTL/spacing, tests). Run `npm test` + `npm run build`.
- [ ] **Step 2:** finishing-a-development-branch → merge to `main` + push to origin (per the established flow).

---

## Self-Review (against the spec)
- Manager dashboard with 4 KPIs (cars in workshop, awaiting approval, ready for handover, invoiced today) → Tasks 1–2 ✓
- "Workshop by stage" board (orders grouped by status) → `BOARD_STATUSES` grouping + page ✓
- Reuses orders + invoices data (no new tables/fetch patterns) → `useOrders`/`useInvoices` ✓
- Pure, tested aggregation (counts, date-filtered invoiced-today, grouping) → `stats.ts` + tests ✓
- Bilingual EN/AR, RTL-safe, JOD 3-decimals → i18n + logical classes + toFixed(3) ✓

**Deferred (correctly out of scope):** charts/trends (Phase 2+ analytics); reminders-due widget (depends on Phase 2 next_service_due reminders); per-branch dashboards (multi-branch is Phase-later). Note: the dashboard fetches all orders/invoices and aggregates client-side — fine at MVP volume; revisit with server-side counts if data grows large.

---

## This completes Phase 1 (operational core).
Next phases (separate spec→plan cycles): Phase 2 (customer portal, WhatsApp reminders, software-update-due tracking), Phase 3 (accounting depth, inventory, counter parts-sales).
```
