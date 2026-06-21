# VW EV Service Center — Phase 1 Invoicing & Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn a service order's line items (the estimate) into an invoice, record payments against it, and track payment status — reusing the existing money core. Closes the financial loop: order → priced lines → invoice → payments → paid.

**Architecture:** Same patterns as CRM/Orders. New feature folder `src/features/invoices/` (types, payment schema, payment-status helper, Supabase data layer, Query hooks, components). Pages in `src/pages/`. **Reuses:** `@/lib/money` (`derivePaymentStatus`), `@/features/orders/lineMath` (`computeOrderTotals` to snapshot invoice totals from the order's lines), `@/features/orders/api` (`listLines`), `@/lib/branch`, `@/components/ui/*`, `@/components/ui/Toast`. The invoice **does not duplicate line rows** — it references the order and snapshots `subtotal/discount_total/total` at generation; line detail is read live from the order's `service_order_lines` (estimate = invoice, per the schema comment). One invoice per order.

**Tech Stack:** existing. No new deps.

---

## Carried-forward cross-module follow-ups
- **i18n validation messages** remain hardcoded English (broader refactor, still deferred — note, don't block).
- **`←` back-arrow glyph** RTL flip — apply the same pattern if you add a back link; otherwise still a tracked follow-up.

---

## File Structure
```
src/
├─ features/invoices/
│  ├─ types.ts                  # Invoice, Payment, PaymentMethod, InvoiceListRow, InvoiceDetailRow
│  ├─ schema.ts                 # paymentSchema (+ input/payload types)
│  ├─ schema.test.ts
│  ├─ payments.ts               # sumPayments, paymentStatusFor (pure; uses money.derivePaymentStatus)
│  ├─ payments.test.ts
│  ├─ api.ts                    # generate/get/list invoices; list/add/delete payments; recompute status
│  ├─ hooks.ts                  # Query hooks
│  ├─ InvoiceStatusBadge.tsx
│  └─ PaymentForm.tsx
├─ pages/
│  ├─ InvoicesPage.tsx          # MODIFY: list (replaces placeholder)
│  ├─ InvoicesPage.test.tsx
│  ├─ InvoiceDetailPage.tsx     # totals + payments + record-payment
│  └─ InvoiceDetailPage.test.tsx
├─ pages/OrderDetailPage.tsx    # MODIFY: "Generate invoice" / "View invoice"
├─ App.tsx                      # MODIFY: /invoices/:id route
└─ i18n/{en,ar}.json            # MODIFY: invoices.* + paymentMethod.* + paymentStatus.*
```

---

## Task 1: i18n + InvoiceStatusBadge

**Files:** modify `src/i18n/{en,ar}.json`; create `src/features/invoices/InvoiceStatusBadge.tsx`.

- [ ] **Step 1: Add to `en.json`** (merge, keep existing):
```json
"invoices": {
  "title": "Invoices", "invoice": "Invoice", "generate": "Generate invoice", "view": "View invoice",
  "empty": "No invoices yet", "notFound": "Invoice not found", "forOrder": "For order",
  "subtotal": "Subtotal", "discountTotal": "Discount", "total": "Total", "issued": "Issued",
  "payments": "Payments", "recordPayment": "Record payment", "amount": "Amount", "method": "Method",
  "note": "Note", "paid": "Paid", "balance": "Balance due", "noPayments": "No payments recorded yet",
  "filterByStatus": "Filter by payment status", "allStatuses": "All"
},
"paymentMethod": { "cash": "Cash", "card": "Card", "transfer": "Transfer" },
"paymentStatus": { "unpaid": "Unpaid", "partial": "Partial", "paid": "Paid" }
```

- [ ] **Step 2: Add the SAME keys (Arabic) to `ar.json`:**
```json
"invoices": {
  "title": "الفواتير", "invoice": "فاتورة", "generate": "إنشاء فاتورة", "view": "عرض الفاتورة",
  "empty": "لا توجد فواتير بعد", "notFound": "الفاتورة غير موجودة", "forOrder": "للأمر",
  "subtotal": "المجموع الفرعي", "discountTotal": "الخصم", "total": "الإجمالي", "issued": "تاريخ الإصدار",
  "payments": "المدفوعات", "recordPayment": "تسجيل دفعة", "amount": "المبلغ", "method": "طريقة الدفع",
  "note": "ملاحظة", "paid": "المدفوع", "balance": "المتبقي", "noPayments": "لم تُسجّل أي مدفوعات بعد",
  "filterByStatus": "تصفية حسب حالة الدفع", "allStatuses": "الكل"
},
"paymentMethod": { "cash": "نقدًا", "card": "بطاقة", "transfer": "تحويل" },
"paymentStatus": { "unpaid": "غير مدفوعة", "partial": "مدفوعة جزئيًا", "paid": "مدفوعة" }
```

- [ ] **Step 3: Create `src/features/invoices/InvoiceStatusBadge.tsx`:**
```tsx
import { useTranslation } from "react-i18next";
import type { PaymentStatus } from "@/lib/money";

const colors: Record<PaymentStatus, string> = {
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

export function InvoiceStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${colors[status]}`}>
      {t(`paymentStatus.${status}`)}
    </span>
  );
}
```

- [ ] **Step 4:** `npm test` (parity green) + `npm run build`. Commit: `feat(invoices): i18n strings and payment-status badge`

---

## Task 2: Types + payment schema + payment-status helper (TDD)

**Files:** create `src/features/invoices/types.ts`, `schema.ts`, `schema.test.ts`, `payments.ts`, `payments.test.ts`.

- [ ] **Step 1: Create `src/features/invoices/types.ts`:**
```ts
import type { PaymentStatus } from "@/lib/money";

export type PaymentMethod = "cash" | "card" | "transfer";

export interface Invoice {
  id: string;
  service_order_id: string;
  invoice_number: number;
  currency: string;
  subtotal: number;
  discount_total: number;
  total: number;
  payment_status: PaymentStatus;
  issued_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  paid_at: string;
}

export type InvoiceListRow = Invoice & {
  service_orders: { order_number: number; customers: { name: string } | null } | null;
};
export type InvoiceDetailRow = InvoiceListRow;
```

- [ ] **Step 2: Write `src/features/invoices/payments.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { sumPayments, paymentStatusFor } from "@/features/invoices/payments";

const p = (amount: number) => ({ amount });

describe("payments", () => {
  it("sums payment amounts (rounded to 3dp)", () => {
    expect(sumPayments([p(10), p(0.333), p(0.333), p(0.334)])).toBe(11);
  });
  it("is unpaid with no payments", () => {
    expect(paymentStatusFor(100, [])).toBe("unpaid");
  });
  it("is partial below total", () => {
    expect(paymentStatusFor(100, [p(40)])).toBe("partial");
  });
  it("is paid at or above total", () => {
    expect(paymentStatusFor(100, [p(60), p(40)])).toBe("paid");
  });
});
```

- [ ] **Step 3:** `npm test` → FAIL.

- [ ] **Step 4: Create `src/features/invoices/payments.ts`:**
```ts
import { derivePaymentStatus, type PaymentStatus } from "@/lib/money";

const round3 = (n: number): number => Math.round(n * 1000 + Number.EPSILON) / 1000;

export function sumPayments(payments: { amount: number }[]): number {
  return round3(payments.reduce((s, p) => s + p.amount, 0));
}

export function paymentStatusFor(total: number, payments: { amount: number }[]): PaymentStatus {
  return derivePaymentStatus(total, sumPayments(payments));
}
```

- [ ] **Step 5:** `npm test` → PASS.

- [ ] **Step 6: Write `src/features/invoices/schema.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { paymentSchema } from "@/features/invoices/schema";

describe("paymentSchema", () => {
  it("requires a positive amount", () => {
    expect(() => paymentSchema.parse({ amount: "0", method: "cash" })).toThrow();
    expect(() => paymentSchema.parse({ amount: "", method: "cash" })).toThrow();
  });
  it("coerces amount and defaults method to cash; nulls empty note", () => {
    const p = paymentSchema.parse({ amount: "12.5", note: "" });
    expect(p.amount).toBe(12.5);
    expect(p.method).toBe("cash");
    expect(p.note).toBeNull();
  });
});
```

- [ ] **Step 7:** `npm test` → FAIL.

- [ ] **Step 8: Create `src/features/invoices/schema.ts`** (zod v4; `ctx.addIssue("msg")` shorthand works):
```ts
import { z } from "zod";

const optText = z.string().optional().transform((v) => {
  const t = (v ?? "").trim(); return t.length ? t : null;
});
const reqPositive = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) { ctx.addIssue("Must be greater than 0"); return z.NEVER; }
  return n;
});

export const paymentSchema = z.object({
  amount: reqPositive,
  method: z.enum(["cash", "card", "transfer"]).default("cash"),
  note: optText,
});

export type PaymentFormValues = z.input<typeof paymentSchema>;
export type PaymentPayload = z.output<typeof paymentSchema>;
```

- [ ] **Step 9:** `npm test` (all pass) + `npm run build`. Commit: `feat(invoices): types, payment schema, payment-status helper`

---

## Task 3: Data layer (api + hooks)

**Files:** create `src/features/invoices/api.ts`, `hooks.ts`.

- [ ] **Step 1: Create `src/features/invoices/api.ts`:**
```ts
import { supabase } from "@/lib/supabase";
import { listLines } from "@/features/orders/api";
import { computeOrderTotals } from "@/features/orders/lineMath";
import { sumPayments, paymentStatusFor } from "./payments";
import type { Invoice, Payment, InvoiceListRow, InvoiceDetailRow } from "./types";
import type { PaymentPayload } from "./schema";

export async function getInvoiceByOrder(orderId: string): Promise<Invoice | null> {
  const { data, error } = await supabase.from("invoices").select("*").eq("service_order_id", orderId).maybeSingle();
  if (error) throw error;
  return (data as Invoice) ?? null;
}

export async function generateInvoice(orderId: string): Promise<Invoice> {
  const existing = await getInvoiceByOrder(orderId);
  if (existing) return existing; // idempotent: one invoice per order
  const lines = await listLines(orderId);
  const totals = computeOrderTotals(lines);
  const { data, error } = await supabase.from("invoices").insert({
    service_order_id: orderId, currency: "JOD",
    subtotal: totals.subtotal, discount_total: totals.discountTotal, total: totals.total,
    payment_status: "unpaid",
  }).select().single();
  if (error) throw error;
  return data as Invoice;
}

export async function getInvoice(id: string): Promise<InvoiceDetailRow> {
  const { data, error } = await supabase.from("invoices")
    .select("*, service_orders(order_number, customers(name))").eq("id", id).single();
  if (error) throw error;
  return data as unknown as InvoiceDetailRow;
}

export async function listInvoices(status?: string): Promise<InvoiceListRow[]> {
  let q = supabase.from("invoices")
    .select("*, service_orders(order_number, customers(name))")
    .order("issued_at", { ascending: false });
  if (status) q = q.eq("payment_status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as InvoiceListRow[];
}

export async function listPayments(invoiceId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from("payments")
    .select("*").eq("invoice_id", invoiceId).order("paid_at", { ascending: true });
  if (error) throw error;
  return data as Payment[];
}

/** Recompute and persist the invoice's payment_status from its payments. */
async function refreshStatus(invoiceId: string): Promise<void> {
  const { data: inv, error: e1 } = await supabase.from("invoices").select("total").eq("id", invoiceId).single();
  if (e1) throw e1;
  const payments = await listPayments(invoiceId);
  const status = paymentStatusFor((inv as { total: number }).total, payments);
  const { error } = await supabase.from("invoices").update({ payment_status: status }).eq("id", invoiceId);
  if (error) throw error;
}

export async function addPayment(invoiceId: string, payload: PaymentPayload): Promise<Payment> {
  const { data, error } = await supabase.from("payments")
    .insert({ ...payload, invoice_id: invoiceId }).select().single();
  if (error) throw error;
  await refreshStatus(invoiceId);
  return data as Payment;
}

export async function deletePayment(p: Payment): Promise<void> {
  const { error } = await supabase.from("payments").delete().eq("id", p.id);
  if (error) throw error;
  await refreshStatus(p.invoice_id);
}

export { sumPayments };
```

- [ ] **Step 2: Create `src/features/invoices/hooks.ts`** — mirror the orders hooks. Hooks: `useInvoices(status?)` (`["invoices", status ?? "all"]`), `useInvoice(id)` (`["invoice", id]`), `useInvoiceByOrder(orderId)` (`["invoice-by-order", orderId]`, enabled !!orderId), `useGenerateInvoice()` (mutationFn orderId → generateInvoice; onSuccess invalidate `["invoices"]` + `["invoice-by-order"]`), `usePayments(invoiceId)` (`["payments", invoiceId]`), `useAddPayment(invoiceId)` (onSuccess invalidate `["payments", invoiceId]` + `["invoice", invoiceId]` + `["invoices"]`), `useDeletePayment(invoiceId)` (same invalidations). Read `src/features/orders/hooks.ts` first and follow its structure exactly.

- [ ] **Step 3:** `npm run build` clean, `npm test` pass. Commit: `feat(invoices): supabase data layer and query hooks`

---

## Task 4: Invoices list page

**Files:** modify `src/pages/InvoicesPage.tsx` (named export, routed at `/invoices`); create `src/pages/InvoicesPage.test.tsx`.

- [ ] **Step 1: Replace `InvoicesPage.tsx`** — heading; a payment-status `<Select>` filter (options: `invoices.allStatuses` + each of unpaid/partial/paid via `paymentStatus.*`) driving `useInvoices(status)`; loading/empty; a list where each row links to `/invoices/:id` showing `#invoice_number`, the order number + customer name (`row.service_orders?.order_number`, `row.service_orders?.customers?.name`), the `total.toFixed(3)` JOD, and an `<InvoiceStatusBadge status={row.payment_status} />`. Mirror `ServiceOrdersPage.tsx` structure (buttonClasses not needed — no "new" button; invoices are generated from orders). RTL-safe, generous spacing.

- [ ] **Step 2: Create `InvoicesPage.test.tsx`** — mock `@/features/invoices/hooks` `useInvoices`; assert a row (`#1`, customer, "Paid" badge, total) and the empty state render. Mirror `ServiceOrdersPage.test.tsx` (incl. the getAllByText note if a status label collides with a filter option).

- [ ] **Step 3:** tests + build green. Commit: `feat(invoices): invoices list with payment-status filter`

---

## Task 5: Invoice detail + record payment

**Files:** create `src/features/invoices/PaymentForm.tsx`, `src/pages/InvoiceDetailPage.tsx`, `src/pages/InvoiceDetailPage.test.tsx`.

- [ ] **Step 1: Create `PaymentForm.tsx`** — react-hook-form + `zodResolver(paymentSchema)` (`useForm<PaymentFormValues, unknown, PaymentPayload>`); fields: amount (numeric TextField), method (`<Select>` from paymentMethod.*), note (TextField); Save/Cancel; `onSubmit: (p: PaymentPayload) => void`. Mirror the orders LineForm typing.

- [ ] **Step 2: Create `InvoiceDetailPage.tsx`** — `useInvoice(id)` (loading + notFound "Invoice not found"); header: `#invoice_number`, link "For order #<order_number>" → `/orders/<service_order_id>`, customer name, `InvoiceStatusBadge`. Totals block: subtotal/discount/total (`toFixed(3)` JOD). Payments section: `usePayments(id)` list (amount, method label, note, date) + computed **balance due** = `total - sumPayments(payments)` (`toFixed(3)`); a "Record payment" toggle showing `PaymentForm` → `useAddPayment(id).mutate(payload, {onSuccess: close, onError: toast})`; per-payment delete (confirm → `useDeletePayment(id)`). Empty state `invoices.noPayments`. Use `useToast` on mutation errors. RTL-safe, generous spacing.

- [ ] **Step 3: Create `InvoiceDetailPage.test.tsx`** — mock `@/features/invoices/hooks` (`useInvoice` → invoice with joined order/customer + total; `usePayments` → one payment; `useAddPayment`/`useDeletePayment` → `{mutate:vi.fn(), isPending:false}`) and `@/components/ui/Toast`. Assert: invoice number, total (toFixed(3)), the payment row, and the balance-due figure render; and the not-found state. Wrap in I18nextProvider + MemoryRouter. (No QueryClient needed — hooks mocked.)

- [ ] **Step 4:** tests + build green. Commit: `feat(invoices): invoice detail with payment recording`

---

## Task 6: Order detail integration + routes + integration test

**Files:** modify `src/pages/OrderDetailPage.tsx`, `src/App.tsx`; create `src/pages/Invoices.integration.test.tsx`.

- [ ] **Step 1: Order detail → invoice link.** In `OrderDetailPage.tsx`, add (near the status controls) an invoice affordance using `useInvoiceByOrder(id)`: if an invoice exists, a `<Link to={`/invoices/${invoice.id}`} className={buttonClasses("ghost")}>{t("invoices.view")}</Link>`; else a `<Button onClick={() => generate.mutate(id, { onSuccess: (inv) => navigate(`/invoices/${inv.id}`), onError: () => toast.show(t("errors.saveFailed")) })}>{t("invoices.generate")}</Button>` using `useGenerateInvoice()`. Import `useNavigate`. Update `OrderDetailPage.test.tsx`'s `@/features/orders/hooks` mock is unaffected, but ADD a mock for `@/features/invoices/hooks` (`useInvoiceByOrder: () => ({ data: null })`, `useGenerateInvoice: () => ({ mutate: vi.fn(), isPending: false })`) so the page still renders under existing tests.

- [ ] **Step 2: Add route** in `App.tsx` under the AppLayout group (catch-all last): `<Route path="/invoices/:id" element={<InvoiceDetailPage />} />` (import it). `/invoices` already routes to `InvoicesPage`.

- [ ] **Step 3: Create `src/pages/Invoices.integration.test.tsx`** — mock `@/features/invoices/api` (`listInvoices` → one row; `getInvoice` → that invoice w/ joined order+customer; `listPayments` → []) and render `/invoices` → click → assert the detail header (`#<invoice_number>` + total) renders. Mirror `Orders.integration.test.tsx` (real hooks + QueryClient + ToastProvider + i18n + router).

- [ ] **Step 4:** full suite + build green. Commit: `feat(invoices): order→invoice link, route, integration test`

---

## Self-Review (against the spec)

**Spec coverage (Invoicing portion):**
- Invoice generated from the order's line items, snapshotting totals via the money core → `generateInvoice` + `computeOrderTotals` (Task 3) ✓
- Estimate = invoice sharing `service_order_lines` (no duplicated lines; invoice references order) → design honored ✓
- Invoices list + detail; payment-status badge → Tasks 4, 5 ✓
- Record payments (cash/card/transfer + note); payment status derived (unpaid/partial/paid) via `derivePaymentStatus` → `payments.ts` + Tasks 3, 5 ✓
- JOD 3-decimals throughout (`toFixed(3)`); balance due shown ✓
- Order ↔ invoice link → Task 6 ✓

**Deferred (correctly out of this plan):** `next_service_due` capture at handover (Phase-2 reminders depend on it but reminders aren't built — small, add when building Phase 2); editing an issued invoice / re-snapshot on line change (Phase 1 generates once; document that regenerating isn't supported — delete+regenerate is the manual path); refunds / negative payments (out of scope — `amount > 0` enforced); accounting ledger (Phase 3).

**Placeholder scan:** Logic-critical tasks (schema, payments helper, api) have full code; UI tasks (4–6) give complete data contracts + key snippets and the exact sibling components to mirror.

**Type consistency:** `Invoice`/`Payment`/`PaymentMethod`, `InvoiceListRow`/`InvoiceDetailRow`, `PaymentPayload` align across schema/api/hooks/pages; `PaymentStatus` reused from `@/lib/money`; query keys consistent with invalidations; routes (`/invoices`, `/invoices/:id`) match links.

---

## Next Plan
- `2026-06-21-vw-ev-phase1-dashboard.md` (KPIs + "workshop by stage" board; reads orders by status + invoiced-today from invoices)
```
