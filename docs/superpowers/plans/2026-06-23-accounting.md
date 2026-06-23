# Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Accounting page that reports cash-basis revenue, outstanding receivables, payments-by-method, and purchases (cash out) over a chosen period, branch-scoped.

**Architecture:** New `src/features/accounting/` feature folder (types → pure helpers → api → hooks) feeding a single admin page `/accounting`. Pure aggregation helpers are TDD'd in isolation; api does Supabase reads scoped by the active branch; no new tables, no migration.

**Tech Stack:** React 19 + TS (strict), Supabase JS, TanStack Query v5, react-i18next, Vitest + Testing Library. Volt Instrument design system.

**Spec:** `docs/superpowers/specs/2026-06-23-accounting-design.md`
**Branch:** `feat/accounting`

## Global Constraints
- **Money:** JOD, **3 decimals** everywhere; display as `` `${n.toFixed(3)} JOD` ``. Round with the repo's `Math.round(n * 1000 + Number.EPSILON) / 1000` idiom (mirrors `src/features/inventory/stock.ts`; `money.ts` exposes no generic sum/round to reuse).
- **i18n parity enforced** by `src/i18n/i18n.test.ts` — every key MUST exist in BOTH `en.json` and `ar.json`. All user-facing text via `t()`. Arabic must read naturally, not machine-literal.
- **RTL-safe styling only** — logical Tailwind classes (`ms-/me-/ps-/pe-/border-e`); never `left/right/ml/mr`.
- **Branch scoping:** read `useActiveBranch().branchId` (a concrete id, or `null` for "All branches"); when null, do not filter — RLS limits regular admins and super-admins see the consolidated sum. `payments` reach branch via parent `invoices.branch_id`.
- **Date ranges are half-open** `[from, to)` — never double-count boundaries.
- **Wrap money/IDs/dates in `<span className="num">`** (mono tabular).
- Suite green before every commit; `npm run build` clean at the end.

---

### Task 1: i18n keys (accounting + nav)

**Files:**
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/ar.json`
- Test: `src/i18n/i18n.test.ts` (existing parity test — no edit, must stay green)

**Interfaces:**
- Produces: i18n keys consumed by every later UI task — `nav.accounting`, and the `accounting.*` block: `title`, `eyebrow`, `period.thisMonth`, `period.lastMonth`, `period.thisYear`, `period.custom`, `period.from`, `period.to`, `consolidated`, `revenue`, `receivables`, `byMethod`, `purchases`, `count`, `balanceDue`, `invoiceNo`, `poNo`, `receivedOn`, `noPayments`, `noReceivables`, `noPurchases`, `loadError`, `method.cash`, `method.card`, `method.transfer`.

- [ ] **Step 1: Add the `accounting` block + `nav.accounting` to `en.json`**

In `nav` add `"accounting": "Accounting"`. Add a new top-level block:

```json
"accounting": {
  "title": "Accounting",
  "eyebrow": "Finance",
  "period": {
    "thisMonth": "This month",
    "lastMonth": "Last month",
    "thisYear": "This year",
    "custom": "Custom",
    "from": "From",
    "to": "To"
  },
  "consolidated": "Consolidated — all branches",
  "revenue": "Revenue (cash in)",
  "receivables": "Outstanding receivables",
  "byMethod": "Payments by method",
  "purchases": "Purchases (cash out)",
  "count": "Count",
  "balanceDue": "Balance due",
  "invoiceNo": "Invoice",
  "poNo": "PO",
  "receivedOn": "Received",
  "noPayments": "No payments in this period",
  "noReceivables": "Nothing outstanding — all invoices are settled",
  "noPurchases": "No purchases received in this period",
  "loadError": "Could not load accounting data. Please try again.",
  "method": { "cash": "Cash", "card": "Card", "transfer": "Transfer" }
}
```

- [ ] **Step 2: Add the matching `accounting` block + `nav.accounting` to `ar.json`** (natural Arabic, not literal)

In `nav` add `"accounting": "المحاسبة"`. Add:

```json
"accounting": {
  "title": "المحاسبة",
  "eyebrow": "المالية",
  "period": {
    "thisMonth": "هذا الشهر",
    "lastMonth": "الشهر الماضي",
    "thisYear": "هذه السنة",
    "custom": "مخصّص",
    "from": "من",
    "to": "إلى"
  },
  "consolidated": "موحّد — كل الفروع",
  "revenue": "الإيرادات (نقدًا)",
  "receivables": "الذمم المستحقة",
  "byMethod": "المدفوعات حسب الطريقة",
  "purchases": "المشتريات (نقدًا)",
  "count": "العدد",
  "balanceDue": "الرصيد المستحق",
  "invoiceNo": "فاتورة",
  "poNo": "أمر شراء",
  "receivedOn": "تاريخ الاستلام",
  "noPayments": "لا توجد مدفوعات في هذه الفترة",
  "noReceivables": "لا توجد ذمم مستحقة — جميع الفواتير مسدّدة",
  "noPurchases": "لا توجد مشتريات مستلمة في هذه الفترة",
  "loadError": "تعذّر تحميل بيانات المحاسبة. حاول مرة أخرى.",
  "method": { "cash": "نقدًا", "card": "بطاقة", "transfer": "تحويل" }
}
```

- [ ] **Step 3: Run the parity test**

Run: `npm test -- src/i18n/i18n.test.ts`
Expected: PASS (both files have identical key sets).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.json src/i18n/ar.json
git commit -m "feat(accounting): i18n strings (en/ar) + nav key"
```

---

### Task 2: Types

**Files:**
- Create: `src/features/accounting/types.ts`

**Interfaces:**
- Produces: `PaymentMethod`, `PresetKey`, `DateRange`, `MonthBucket`, `RevenueSummary`, `MethodRow`, `MethodBreakdown`, `OpenInvoice`, `ReceivablesSummary`, `ReceivedPO`, `PurchasesSummary`, `AccountingSummary`. Consumed by every later task.

- [ ] **Step 1: Write the types file**

```ts
/** Mirrors the DB `payment_method` enum (also used by the invoices feature). */
export type PaymentMethod = "cash" | "card" | "transfer";

export type PresetKey = "this-month" | "last-month" | "this-year" | "custom";

/** Half-open range [from, to); both are ISO timestamp strings. */
export interface DateRange {
  from: string;
  to: string;
}

export interface MonthBucket {
  month: string; // "YYYY-MM"
  total: number;
}
export interface RevenueSummary {
  total: number;
  months: MonthBucket[];
}

export interface MethodRow {
  method: PaymentMethod;
  count: number;
  total: number;
}
export type MethodBreakdown = MethodRow[];

export interface OpenInvoice {
  id: string;
  invoice_number: number;
  total: number;
  paid: number;
  balance: number;
  issued_at: string;
  customer_name: string;
}
export interface ReceivablesSummary {
  total: number;
  invoices: OpenInvoice[];
}

export interface ReceivedPO {
  id: string;
  po_number: number;
  supplier_name: string | null;
  received_at: string | null;
  value: number;
}
export interface PurchasesSummary {
  total: number;
  orders: ReceivedPO[];
}

export interface AccountingSummary {
  revenue: RevenueSummary;
  receivables: ReceivablesSummary;
  methods: MethodBreakdown;
  purchases: PurchasesSummary;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc -b`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/features/accounting/types.ts
git commit -m "feat(accounting): types"
```

---

### Task 3: Period helpers (pure, TDD)

**Files:**
- Create: `src/features/accounting/period.ts`
- Test: `src/features/accounting/period.test.ts`

**Interfaces:**
- Consumes: `DateRange`, `PresetKey` from `./types`.
- Produces: `presetRange(key: Exclude<PresetKey, "custom">, now: Date): DateRange` — half-open local-month/-year boundaries serialized via `toISOString()`. Consumed by the page (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { presetRange } from "./period";

const NOW = new Date(2026, 5, 15, 10, 0, 0); // 15 Jun 2026, local

describe("presetRange", () => {
  it("this-month spans the first of this month to the first of next", () => {
    const r = presetRange("this-month", NOW);
    expect(r.from).toBe(new Date(2026, 5, 1).toISOString());
    expect(r.to).toBe(new Date(2026, 6, 1).toISOString());
  });

  it("last-month spans the previous calendar month", () => {
    const r = presetRange("last-month", NOW);
    expect(r.from).toBe(new Date(2026, 4, 1).toISOString());
    expect(r.to).toBe(new Date(2026, 5, 1).toISOString());
  });

  it("this-year spans Jan 1 to next Jan 1", () => {
    const r = presetRange("this-year", NOW);
    expect(r.from).toBe(new Date(2026, 0, 1).toISOString());
    expect(r.to).toBe(new Date(2027, 0, 1).toISOString());
  });

  it("handles a January 'now' rolling last-month into the prior year", () => {
    const jan = new Date(2026, 0, 10);
    const r = presetRange("last-month", jan);
    expect(r.from).toBe(new Date(2025, 11, 1).toISOString());
    expect(r.to).toBe(new Date(2026, 0, 1).toISOString());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/accounting/period.test.ts`
Expected: FAIL — `presetRange` not exported / module missing.

- [ ] **Step 3: Write the implementation**

```ts
import type { DateRange, PresetKey } from "./types";

/** Local midnight at year/monthIndex/day, as an ISO string. `new Date(y, m, d)`
 *  normalizes month under/overflow (e.g. m = -1 → December of prior year). */
const iso = (y: number, m: number, d: number): string => new Date(y, m, d).toISOString();

export function presetRange(key: Exclude<PresetKey, "custom">, now: Date): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === "this-month") return { from: iso(y, m, 1), to: iso(y, m + 1, 1) };
  if (key === "last-month") return { from: iso(y, m - 1, 1), to: iso(y, m, 1) };
  return { from: iso(y, 0, 1), to: iso(y + 1, 0, 1) }; // this-year
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/accounting/period.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/accounting/period.ts src/features/accounting/period.test.ts
git commit -m "feat(accounting): period preset ranges (pure, TDD)"
```

---

### Task 4: Aggregation helpers (pure, TDD)

**Files:**
- Create: `src/features/accounting/summary.ts`
- Test: `src/features/accounting/summary.test.ts`

**Interfaces:**
- Consumes: `MonthBucket`, `MethodBreakdown`, `OpenInvoice`, `ReceivablesSummary`, `ReceivedPO`, `PurchasesSummary`, `PaymentMethod` from `./types`.
- Produces:
  - `sumPayments(rows: { amount: number }[]): number`
  - `bucketByMonth(rows: { paid_at: string; amount: number }[]): MonthBucket[]`
  - `groupByMethod(rows: { method: PaymentMethod; amount: number }[]): MethodBreakdown`
  - `computeReceivables(rows: { id: string; invoice_number: number; total: number; paid: number; issued_at: string; customer_name: string }[]): ReceivablesSummary`
  - `sumReceivedPurchases(rows: { id: string; po_number: number; supplier_name: string | null; received_at: string | null; lines: { received_qty: number; unit_cost: number }[] }[]): PurchasesSummary`
  - Consumed by the hook (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  sumPayments,
  bucketByMonth,
  groupByMethod,
  computeReceivables,
  sumReceivedPurchases,
} from "./summary";

describe("sumPayments", () => {
  it("sums amounts at 3-dp precision", () => {
    expect(sumPayments([{ amount: 10.1 }, { amount: 0.2 }, { amount: 5 }])).toBe(15.3);
  });
  it("returns 0 for no rows", () => {
    expect(sumPayments([])).toBe(0);
  });
});

describe("bucketByMonth", () => {
  it("groups by YYYY-MM ascending", () => {
    const rows = [
      { paid_at: "2026-06-02T08:00:00.000Z", amount: 5 },
      { paid_at: "2026-06-20T08:00:00.000Z", amount: 3 },
      { paid_at: "2026-05-11T08:00:00.000Z", amount: 2 },
    ];
    expect(bucketByMonth(rows)).toEqual([
      { month: "2026-05", total: 2 },
      { month: "2026-06", total: 8 },
    ]);
  });
});

describe("groupByMethod", () => {
  it("groups by method in cash/card/transfer order, omitting absent methods", () => {
    const rows = [
      { method: "cash" as const, amount: 10 },
      { method: "transfer" as const, amount: 4 },
      { method: "cash" as const, amount: 5 },
    ];
    expect(groupByMethod(rows)).toEqual([
      { method: "cash", count: 2, total: 15 },
      { method: "transfer", count: 1, total: 4 },
    ]);
  });
  it("method totals reconcile to sumPayments (invariant)", () => {
    const rows = [
      { method: "cash" as const, amount: 10 },
      { method: "card" as const, amount: 2.5 },
    ];
    const byMethod = groupByMethod(rows).reduce((s, r) => s + r.total, 0);
    expect(Math.round(byMethod * 1000) / 1000).toBe(sumPayments(rows));
  });
});

describe("computeReceivables", () => {
  it("computes balance = total - paid, drops settled, sorts by balance desc", () => {
    const r = computeReceivables([
      { id: "a", invoice_number: 1, total: 100, paid: 40, issued_at: "x", customer_name: "Ahmad" },
      { id: "b", invoice_number: 2, total: 50, paid: 50, issued_at: "x", customer_name: "Sara" },
      { id: "c", invoice_number: 3, total: 80, paid: 0, issued_at: "x", customer_name: "Omar" },
    ]);
    expect(r.total).toBe(140);
    expect(r.invoices.map((i) => i.id)).toEqual(["c", "a"]);
    expect(r.invoices[1].balance).toBe(60);
  });
});

describe("sumReceivedPurchases", () => {
  it("values each PO as Σ(received_qty × unit_cost), newest first", () => {
    const r = sumReceivedPurchases([
      {
        id: "p1", po_number: 1, supplier_name: "ACME", received_at: "2026-06-01T00:00:00.000Z",
        lines: [{ received_qty: 2, unit_cost: 10 }, { received_qty: 1, unit_cost: 5 }],
      },
      {
        id: "p2", po_number: 2, supplier_name: null, received_at: "2026-06-10T00:00:00.000Z",
        lines: [{ received_qty: 3, unit_cost: 4 }],
      },
    ]);
    expect(r.total).toBe(37);
    expect(r.orders.map((o) => o.id)).toEqual(["p2", "p1"]);
    expect(r.orders[1].value).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/accounting/summary.test.ts`
Expected: FAIL — `summary` module missing.

- [ ] **Step 3: Write the implementation**

```ts
import type {
  MonthBucket,
  MethodBreakdown,
  OpenInvoice,
  ReceivablesSummary,
  ReceivedPO,
  PurchasesSummary,
  PaymentMethod,
} from "./types";

const round3 = (n: number): number => Math.round(n * 1000 + Number.EPSILON) / 1000;
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function sumPayments(rows: { amount: number }[]): number {
  return round3(rows.reduce((s, r) => s + num(r.amount), 0));
}

export function bucketByMonth(rows: { paid_at: string; amount: number }[]): MonthBucket[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const month = r.paid_at.slice(0, 7); // "YYYY-MM" from an ISO string
    map.set(month, (map.get(month) ?? 0) + num(r.amount));
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total: round3(total) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function groupByMethod(rows: { method: PaymentMethod; amount: number }[]): MethodBreakdown {
  const order: PaymentMethod[] = ["cash", "card", "transfer"];
  const map = new Map<PaymentMethod, { count: number; total: number }>();
  for (const r of rows) {
    const e = map.get(r.method) ?? { count: 0, total: 0 };
    e.count += 1;
    e.total += num(r.amount);
    map.set(r.method, e);
  }
  return order
    .filter((m) => map.has(m))
    .map((m) => ({ method: m, count: map.get(m)!.count, total: round3(map.get(m)!.total) }));
}

export function computeReceivables(
  rows: {
    id: string;
    invoice_number: number;
    total: number;
    paid: number;
    issued_at: string;
    customer_name: string;
  }[],
): ReceivablesSummary {
  const invoices: OpenInvoice[] = rows
    .map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      total: num(r.total),
      paid: num(r.paid),
      balance: round3(Math.max(0, num(r.total) - num(r.paid))),
      issued_at: r.issued_at,
      customer_name: r.customer_name,
    }))
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const total = round3(invoices.reduce((s, r) => s + r.balance, 0));
  return { total, invoices };
}

export function sumReceivedPurchases(
  rows: {
    id: string;
    po_number: number;
    supplier_name: string | null;
    received_at: string | null;
    lines: { received_qty: number; unit_cost: number }[];
  }[],
): PurchasesSummary {
  const orders: ReceivedPO[] = rows
    .map((r) => ({
      id: r.id,
      po_number: r.po_number,
      supplier_name: r.supplier_name,
      received_at: r.received_at,
      value: round3(r.lines.reduce((s, l) => s + num(l.received_qty) * num(l.unit_cost), 0)),
    }))
    .sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""));
  const total = round3(orders.reduce((s, o) => s + o.value, 0));
  return { total, orders };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/accounting/summary.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/features/accounting/summary.ts src/features/accounting/summary.test.ts
git commit -m "feat(accounting): aggregation helpers (pure, TDD)"
```

---

### Task 5: Supabase api

**Files:**
- Create: `src/features/accounting/api.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`; `PaymentMethod` from `./types`.
- Produces:
  - `fetchPayments(branchId: string | null, from: string, to: string): Promise<{ paid_at: string; amount: number; method: PaymentMethod }[]>`
  - `fetchOpenInvoices(branchId: string | null): Promise<{ id: string; invoice_number: number; total: number; issued_at: string; paid: number; customer_name: string }[]>`
  - `fetchReceivedPurchases(branchId: string | null, from: string, to: string): Promise<{ id: string; po_number: number; received_at: string | null; supplier_name: string | null; lines: { received_qty: number; unit_cost: number }[] }[]>`
  - Consumed by the hook (Task 6). Return shapes line up exactly with the Task 4 helper inputs.

- [ ] **Step 1: Write the api file**

```ts
import { supabase } from "@/lib/supabase";
import type { PaymentMethod } from "./types";

const num = (v: unknown): number => Number(v ?? 0);

/** Payments received within [from, to); branch reached via parent invoice. */
export async function fetchPayments(
  branchId: string | null,
  from: string,
  to: string,
): Promise<{ paid_at: string; amount: number; method: PaymentMethod }[]> {
  let q = supabase
    .from("payments")
    .select("amount, method, paid_at, invoices!inner(branch_id)")
    .gte("paid_at", from)
    .lt("paid_at", to);
  if (branchId) q = q.eq("invoices.branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as { amount: number; method: PaymentMethod; paid_at: string }[]).map((r) => ({
    paid_at: r.paid_at,
    amount: num(r.amount),
    method: r.method,
  }));
}

type OpenInvoiceRow = {
  id: string;
  invoice_number: number;
  total: number;
  issued_at: string;
  payments: { amount: number }[] | null;
  service_orders: { customers: { name: string } | null } | null;
};

/** All unpaid/partial invoices (as of now), with their paid-sum + customer name. */
export async function fetchOpenInvoices(
  branchId: string | null,
): Promise<
  { id: string; invoice_number: number; total: number; issued_at: string; paid: number; customer_name: string }[]
> {
  let q = supabase
    .from("invoices")
    .select(
      "id, invoice_number, total, issued_at, payment_status, payments(amount), service_orders(customers(name))",
    )
    .in("payment_status", ["unpaid", "partial"]);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as OpenInvoiceRow[]).map((r) => ({
    id: r.id,
    invoice_number: r.invoice_number,
    total: num(r.total),
    issued_at: r.issued_at,
    paid: (r.payments ?? []).reduce((s, p) => s + num(p.amount), 0),
    customer_name: r.service_orders?.customers?.name ?? "—",
  }));
}

type ReceivedPORow = {
  id: string;
  po_number: number;
  received_at: string | null;
  suppliers: { name: string } | null;
  purchase_order_lines: { received_qty: number; unit_cost: number }[] | null;
};

/** Purchase orders received within [from, to), with supplier + lines. */
export async function fetchReceivedPurchases(
  branchId: string | null,
  from: string,
  to: string,
): Promise<
  {
    id: string;
    po_number: number;
    received_at: string | null;
    supplier_name: string | null;
    lines: { received_qty: number; unit_cost: number }[];
  }[]
> {
  let q = supabase
    .from("purchase_orders")
    .select("id, po_number, received_at, suppliers(name), purchase_order_lines(received_qty, unit_cost)")
    .eq("status", "received")
    .gte("received_at", from)
    .lt("received_at", to);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as ReceivedPORow[]).map((r) => ({
    id: r.id,
    po_number: r.po_number,
    received_at: r.received_at,
    supplier_name: r.suppliers?.name ?? null,
    lines: (r.purchase_order_lines ?? []).map((l) => ({
      received_qty: num(l.received_qty),
      unit_cost: num(l.unit_cost),
    })),
  }));
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc -b`
Expected: clean. (If the Supabase nested-embed cast complains about array-vs-object on `service_orders`/`suppliers`, keep the hand-written row types above — they assert the to-one shape PostgREST returns.)

- [ ] **Step 3: Commit**

```bash
git add src/features/accounting/api.ts
git commit -m "feat(accounting): branch-scoped Supabase reads"
```

---

### Task 6: Hook

**Files:**
- Create: `src/features/accounting/hooks.ts`

**Interfaces:**
- Consumes: `useActiveBranch` from `@/features/branches/ActiveBranchContext`; `api` (Task 5); helpers (Task 4); `AccountingSummary`, `DateRange` from `./types`.
- Produces: `useAccountingSummary(range: DateRange)` → TanStack `UseQueryResult<AccountingSummary>`. Consumed by the page (Task 7). Note: TanStack Query v5 has no `onError` on `useQuery`, so the page renders `isError` inline (no toast here — consistent with `useItems`, which also doesn't toast on read).

- [ ] **Step 1: Write the hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import * as api from "./api";
import {
  sumPayments,
  bucketByMonth,
  groupByMethod,
  computeReceivables,
  sumReceivedPurchases,
} from "./summary";
import type { AccountingSummary, DateRange } from "./types";

export function useAccountingSummary(range: DateRange) {
  const { branchId } = useActiveBranch();
  return useQuery<AccountingSummary>({
    queryKey: ["accounting", branchId, range.from, range.to],
    queryFn: async () => {
      const [payments, openInvoices, purchases] = await Promise.all([
        api.fetchPayments(branchId, range.from, range.to),
        api.fetchOpenInvoices(branchId),
        api.fetchReceivedPurchases(branchId, range.from, range.to),
      ]);
      return {
        revenue: { total: sumPayments(payments), months: bucketByMonth(payments) },
        receivables: computeReceivables(openInvoices),
        methods: groupByMethod(payments),
        purchases: sumReceivedPurchases(purchases),
      };
    },
  });
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/accounting/hooks.ts
git commit -m "feat(accounting): useAccountingSummary hook"
```

---

### Task 7: Accounting page + test

**Files:**
- Create: `src/pages/AccountingPage.tsx`
- Test: `src/pages/AccountingPage.test.tsx`

**Interfaces:**
- Consumes: `useAccountingSummary` (Task 6); `useActiveBranch` (`isAll`); `presetRange` (Task 3); `PageHeader`, `KpiCard`; i18n keys (Task 1).
- Produces: `AccountingPage` (named export). Consumed by routing (Task 8).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import type { AccountingSummary } from "@/features/accounting/types";

vi.mock("@/features/accounting/hooks", () => ({ useAccountingSummary: vi.fn() }));
vi.mock("@/features/branches/ActiveBranchContext", () => ({
  useActiveBranch: vi.fn(),
  ALL_BRANCHES: "all",
}));

import { useAccountingSummary } from "@/features/accounting/hooks";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import { AccountingPage } from "@/pages/AccountingPage";

const mockSummary = useAccountingSummary as unknown as ReturnType<typeof vi.fn>;
const mockBranch = useActiveBranch as unknown as ReturnType<typeof vi.fn>;

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );

const summary = (over: Partial<AccountingSummary> = {}): AccountingSummary => ({
  revenue: { total: 1234.5, months: [{ month: "2026-06", total: 1234.5 }] },
  receivables: {
    total: 60,
    invoices: [
      { id: "i1", invoice_number: 7, total: 100, paid: 40, balance: 60, issued_at: "2026-06-01T00:00:00.000Z", customer_name: "Ahmad" },
    ],
  },
  methods: [{ method: "cash", count: 2, total: 1234.5 }],
  purchases: {
    total: 25,
    orders: [{ id: "p1", po_number: 3, supplier_name: "ACME", received_at: "2026-06-05T00:00:00.000Z", value: 25 }],
  },
  ...over,
});

describe("AccountingPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockBranch.mockReturnValue({ branchId: "b1", isAll: false });
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, isError: false });
  });

  it("renders the four report cards with figures", () => {
    wrap(<AccountingPage />);
    expect(screen.getByText("Revenue (cash in)")).toBeInTheDocument();
    expect(screen.getByText("1234.500 JOD")).toBeInTheDocument();
    expect(screen.getByText("Outstanding receivables")).toBeInTheDocument();
    expect(screen.getByText("Payments by method")).toBeInTheDocument();
    expect(screen.getByText("Purchases (cash out)")).toBeInTheDocument();
  });

  it("links each open invoice to its detail page", () => {
    wrap(<AccountingPage />);
    expect(screen.getByText("Ahmad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ahmad/ })).toHaveAttribute("href", "/invoices/i1");
  });

  it("shows the consolidated caption under All branches", () => {
    mockBranch.mockReturnValue({ branchId: null, isAll: true });
    wrap(<AccountingPage />);
    expect(screen.getByText("Consolidated — all branches")).toBeInTheDocument();
  });

  it("refetches when the period preset changes", () => {
    wrap(<AccountingPage />);
    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    // Latest call's range should be the full-year span (Jan→Jan), not a single month.
    const lastRange = mockSummary.mock.calls.at(-1)![0];
    expect(lastRange.from.slice(5, 7)).toBe("01");
    expect(lastRange.to.slice(5, 7)).toBe("01");
  });

  it("shows the error state when the query fails", () => {
    mockSummary.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    wrap(<AccountingPage />);
    expect(screen.getByText(/Could not load accounting data/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/AccountingPage.test.tsx`
Expected: FAIL — `AccountingPage` module missing.

- [ ] **Step 3: Write the page**

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/features/dashboard/KpiCard";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import { useAccountingSummary } from "@/features/accounting/hooks";
import { presetRange } from "@/features/accounting/period";
import type { DateRange, PresetKey } from "@/features/accounting/types";

const PRESETS: Exclude<PresetKey, "custom">[] = ["this-month", "last-month", "this-year"];
const presetLabelKey: Record<Exclude<PresetKey, "custom">, string> = {
  "this-month": "accounting.period.thisMonth",
  "last-month": "accounting.period.lastMonth",
  "this-year": "accounting.period.thisYear",
};

const money = (n: number) => `${n.toFixed(3)} JOD`;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
/** Convert a yyyy-mm-dd input value to a local-midnight ISO string. */
const inputToIso = (v: string, endExclusive = false): string => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d + (endExclusive ? 1 : 0)).toISOString();
};

export function AccountingPage() {
  const { t } = useTranslation();
  const { isAll } = useActiveBranch();
  const [preset, setPreset] = useState<PresetKey>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range: DateRange = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) {
      return { from: inputToIso(customFrom), to: inputToIso(customTo, true) };
    }
    const key = preset === "custom" ? "this-month" : preset;
    return presetRange(key, new Date());
  }, [preset, customFrom, customTo]);

  const { data, isLoading, isError } = useAccountingSummary(range);

  const segBtn = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"
    }`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("accounting.title")}
        eyebrow={t("accounting.eyebrow")}
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1">
            {PRESETS.map((p) => (
              <button key={p} type="button" className={segBtn(preset === p)} onClick={() => setPreset(p)}>
                {t(presetLabelKey[p])}
              </button>
            ))}
            <button
              type="button"
              className={segBtn(preset === "custom")}
              onClick={() => setPreset("custom")}
            >
              {t("accounting.period.custom")}
            </button>
          </div>
        }
      >
        {isAll && <span className="micro">{t("accounting.consolidated")}</span>}
      </PageHeader>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5 text-sm">
            <span className="micro block">{t("accounting.period.from")}</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="micro block">{t("accounting.period.to")}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
        </div>
      )}

      {isError ? (
        <div className="card grid place-items-center p-12 text-sm text-danger">
          {t("accounting.loadError")}
        </div>
      ) : isLoading || !data ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="micro">{t("accounting.revenue")}</div>
              <div className="num mt-3 text-3xl font-semibold tracking-tight text-volt-deep">
                {money(data.revenue.total)}
              </div>
              {data.revenue.months.length > 0 && (
                <div className="mt-5 flex items-end gap-1.5" aria-hidden>
                  {(() => {
                    const max = Math.max(...data.revenue.months.map((m) => m.total), 1);
                    return data.revenue.months.map((m) => (
                      <div key={m.month} className="flex-1" title={`${m.month}: ${money(m.total)}`}>
                        <div
                          className="rounded-t bg-volt"
                          style={{ height: `${Math.max(4, (m.total / max) * 56)}px` }}
                        />
                        <div className="num mt-1 text-center text-[10px] text-muted">
                          {m.month.slice(5)}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            <KpiCard label={t("accounting.receivables")} value={money(data.receivables.total)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <div className="micro mb-4">{t("accounting.byMethod")}</div>
              {data.methods.length === 0 ? (
                <p className="text-sm text-muted">{t("accounting.noPayments")}</p>
              ) : (
                <div className="space-y-3">
                  {data.methods.map((m) => (
                    <div key={m.method} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{t(`accounting.method.${m.method}`)}</span>
                      <span className="flex items-center gap-3">
                        <span className="num text-muted">×{m.count}</span>
                        <span className="num font-semibold text-ink">{money(m.total)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-5">
              <div className="micro mb-1">{t("accounting.purchases")}</div>
              <div className="num text-2xl font-semibold text-ink">{money(data.purchases.total)}</div>
              {data.purchases.orders.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{t("accounting.noPurchases")}</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {data.purchases.orders.map((o) => (
                    <Link
                      key={o.id}
                      to={`/purchase-orders/${o.id}`}
                      className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 text-sm transition-colors hover:border-line-strong hover:bg-paper-2"
                    >
                      <span className="text-ink">
                        <span className="num text-muted">{t("accounting.poNo")} #{o.po_number}</span>{" "}
                        {o.supplier_name ?? ""}
                      </span>
                      <span className="num font-semibold text-ink">{money(o.value)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight text-ink">
              {t("accounting.receivables")}
            </h3>
            {data.receivables.invoices.length === 0 ? (
              <div className="card grid place-items-center p-10 text-sm text-muted">
                {t("accounting.noReceivables")}
              </div>
            ) : (
              <div className="space-y-2">
                {data.receivables.invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3 text-sm transition-colors hover:border-line-strong hover:bg-paper-2"
                  >
                    <span>
                      <span className="num text-muted">{t("accounting.invoiceNo")} #{inv.invoice_number}</span>{" "}
                      <span className="font-medium text-ink">{inv.customer_name}</span>
                      <span className="num ms-2 text-xs text-muted">{day(inv.issued_at)}</span>
                    </span>
                    <span className="text-end">
                      <span className="num block font-semibold text-warn">{money(inv.balance)}</span>
                      <span className="num block text-xs text-muted">
                        {money(inv.paid)} / {money(inv.total)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/AccountingPage.test.tsx`
Expected: PASS (5 tests). If the receivables `<h3>` "Outstanding receivables" collides with the KpiCard label in a `getByText`, the test already scopes via roles/links — keep both; `getByText` for the KpiCard label matches the card, the `<h3>` is a separate node and only queried implicitly.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AccountingPage.tsx src/pages/AccountingPage.test.tsx
git commit -m "feat(accounting): Accounting page (4 reports, period control)"
```

---

### Task 8: Wire route + sidebar nav

**Files:**
- Modify: `src/App.tsx` (import + route)
- Modify: `src/components/Sidebar.tsx` (icon + nav item)

**Interfaces:**
- Consumes: `AccountingPage` (Task 7); `nav.accounting` (Task 1).
- Produces: reachable `/accounting` route + sidebar entry.

- [ ] **Step 1: Add the route in `src/App.tsx`**

Add the import alongside the other page imports:

```tsx
import { AccountingPage } from "@/pages/AccountingPage";
```

Add the route inside the admin `<AppLayout />` group, right after the `/invoices/:id` route:

```tsx
          <Route path="/accounting" element={<AccountingPage />} />
```

- [ ] **Step 2: Add the icon + nav item in `src/components/Sidebar.tsx`**

In the `icons` object, add an `accounting` entry (a simple bar-chart/ledger glyph):

```tsx
  accounting: icon(
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
```

In the `items` array, add the entry after `invoices` (logical place — finance near invoices):

```tsx
  { to: "/accounting", key: "accounting", end: false },
```

- [ ] **Step 3: Typecheck + run the page test again (route renders)**

Run: `npx tsc -b && npm test -- src/pages/AccountingPage.test.tsx`
Expected: clean build, tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx
git commit -m "feat(accounting): /accounting route + sidebar nav"
```

---

### Task 9: Full verification + docs

**Files:**
- Modify: `CLAUDE.md` (Phase status line)

**Interfaces:**
- Consumes: everything above.
- Produces: green suite, clean build, updated phase status.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: ALL green (existing ~178 + the new period/summary/page tests). If `i18n.test.ts` fails, a key is missing from one locale — fix parity.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: `tsc -b` clean + `vite build` succeeds.

- [ ] **Step 3: `git status` — confirm nothing untracked**

Run: `git status`
Expected: clean working tree (no untracked `src/features/accounting/*` — the repo's recurring gotcha is a generator leaving source untracked; verify every new file is committed).

- [ ] **Step 4: Update the Phase status in `CLAUDE.md`**

In the `## Phase status` section, change the trailing "Remaining: accounting; Phase 2 WhatsApp notifications." to:

```
**Accounting (reporting) DONE** — read-only `/accounting`: cash-basis revenue + month trend, outstanding receivables, payments-by-method, purchases (cash out); period presets + custom range; branch-scoped; no migration (`src/features/accounting/`). Remaining: Phase 2 WhatsApp notifications.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark accounting (reporting) complete in CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- Cash-basis revenue + month trend → Task 4 (`sumPayments`, `bucketByMonth`), Task 7 (trend bars). ✓
- Outstanding receivables + open-invoice list → Task 4 (`computeReceivables`), Task 5 (`fetchOpenInvoices`), Task 7 (list). ✓
- Payments by method → Task 4 (`groupByMethod`), Task 7 (card). ✓
- Purchases (cash out) → Task 4 (`sumReceivedPurchases`), Task 5 (`fetchReceivedPurchases`), Task 7 (card). ✓
- Period presets + custom, default This month → Task 3 + Task 7 state. ✓
- Branch scope incl. "All branches" consolidated + caption → Task 5 (branch filters), Task 7 (`isAll` caption). ✓
- Half-open ranges, JOD 3-dp, no negatives, timezone → Tasks 3/4 + constraints. ✓
- Admin-only route + nav → Task 8 (route sits inside `RequireRole role="admin"` group). ✓
- Tests: period, summary (incl. reconciliation invariant), page → Tasks 3/4/7. ✓
- No migration → confirmed; nothing in plan applies to prod. ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `fetchPayments`/`fetchOpenInvoices`/`fetchReceivedPurchases` return shapes match `sumPayments`/`bucketByMonth`/`groupByMethod`/`computeReceivables`/`sumReceivedPurchases` inputs exactly; `useAccountingSummary` composes them into `AccountingSummary`; the page reads `data.revenue/receivables/methods/purchases`. Names align across tasks.

## Out of scope (per spec)
Expense tracking, parts gross-margin, per-branch comparison, top customers, supplier-payment tracking, export/PDF. No new migration.
