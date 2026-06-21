# VW EV Service Center — Phase 1 Service Orders + Intake/Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the service order (job card) module — create an order against an existing customer+vehicle, capture intake (structured fields + photos/video to Supabase Storage + notes), move it through the lifecycle, and manage priced line items (the estimate) using the existing money core. This is the spine the Invoicing and Dashboard modules attach to.

**Architecture:** Same patterns as the CRM module. Feature folder `src/features/orders/` (types, status helper, zod schemas, Supabase data layer incl. Storage, TanStack Query hooks). Pages in `src/pages/`. Reuses `@/lib/money` (line/invoice math), `@/lib/branch`, `@/components/ui/*`, the CRM `useCustomers`/`useVehicles` hooks for selection, and the `inspection-media` private Storage bucket. Line items persist their computed `line_total` via `computeLineTotal`. Invoicing (generating an invoice record + payments) is the NEXT plan — this plan ends at a priced, status-tracked job card with intake media.

**Tech Stack:** existing (React/TS/Supabase/Tailwind/i18n/Query/Router/react-hook-form/zod). No new deps.

---

## Cross-module follow-ups to fold in here (from CRM review)
- **i18n validation messages:** add a small i18n-aware zod error helper so validation messages translate (don't hardcode English). Do it once in Task 2 and reuse.
- **Shared mutation-error surface:** add a minimal `useToast`/inline error pattern (Task 1) and use it on mutations across this module.

---

## File Structure

```
src/
├─ components/ui/
│  ├─ Toast.tsx / toast.tsx        # NEW: minimal toast context + hook (shared error surface)
│  └─ Select.tsx                   # NEW: labelled <select> primitive (status, pickers)
├─ features/orders/
│  ├─ types.ts                     # ServiceOrder, ServiceOrderLine, InspectionMedia, OrderStatus
│  ├─ status.ts                    # status order, labels(t), nextStatus, canAdvance
│  ├─ status.test.ts
│  ├─ schema.ts                    # intakeSchema, lineSchema (+ input/payload types)
│  ├─ schema.test.ts
│  ├─ lineMath.ts                  # maps DB line row <-> money.ts LineInput; toLinePayload
│  ├─ lineMath.test.ts
│  ├─ api.ts                       # orders + lines + media (Storage) CRUD
│  ├─ hooks.ts                     # TanStack Query hooks
│  ├─ OrderStatusBadge.tsx
│  ├─ IntakeForm.tsx               # intake fields form
│  ├─ LineItemsEditor.tsx          # add/edit/delete lines, live totals
│  ├─ LineItemsEditor.test.tsx
│  └─ InspectionMedia.tsx          # upload + gallery (signed URLs)
├─ pages/
│  ├─ ServiceOrdersPage.tsx        # MODIFY: list + status filter (replaces placeholder)
│  ├─ ServiceOrdersPage.test.tsx
│  ├─ NewOrderPage.tsx             # customer+vehicle pick → intake → create
│  └─ OrderDetailPage.tsx          # job card: header, status, intake, lines, media
├─ App.tsx                         # MODIFY: /orders/new, /orders/:id routes
└─ i18n/{en,ar}.json               # MODIFY: orders.* strings
```

---

## Task 1: i18n strings + shared Toast + Select primitive

**Files:** modify `src/i18n/en.json`, `src/i18n/ar.json`; create `src/components/ui/Toast.tsx`, `src/components/ui/Select.tsx`.

- [ ] **Step 1: Add an `orders` block + `status` labels to `en.json`** (merge, keep existing):
```json
"orders": {
  "title": "Service Orders", "newOrder": "New service order", "order": "Order",
  "selectCustomer": "Customer", "selectVehicle": "Vehicle", "allStatuses": "All statuses",
  "intake": "Intake & inspection", "odometer": "Odometer (km)", "charge": "Charge %",
  "battery": "HV battery state", "concerns": "Reported concerns", "intakeNotes": "Inspection notes",
  "advance": "Advance status", "approve": "Mark approved", "empty": "No service orders yet",
  "lines": "Line items", "addLine": "Add line", "description": "Description", "qty": "Qty",
  "unitPrice": "Unit price", "discount": "Discount", "lineType": "Type", "lineTotal": "Total",
  "subtotal": "Subtotal", "discountTotal": "Discount", "grandTotal": "Total",
  "media": "Photos & video", "upload": "Upload", "noMedia": "No photos or video yet",
  "notFound": "Service order not found", "approvedAt": "Approved"
},
"status": {
  "appointment": "Appointment", "intake": "Intake", "diagnosis": "Diagnosis",
  "estimate": "Estimate", "awaiting_approval": "Awaiting approval", "in_progress": "In progress",
  "qc": "Quality check", "ready": "Ready", "closed": "Closed", "cancelled": "Cancelled"
},
"lineType": { "service": "Service", "part": "Part", "fee": "Fee" },
"discountType": { "none": "None", "amount": "Amount", "percent": "Percent" },
"errors": { "saveFailed": "Could not save. Please try again." }
```

- [ ] **Step 2: Add the SAME keys (natural Arabic) to `ar.json`:**
```json
"orders": {
  "title": "أوامر الصيانة", "newOrder": "أمر صيانة جديد", "order": "الأمر",
  "selectCustomer": "العميل", "selectVehicle": "المركبة", "allStatuses": "كل الحالات",
  "intake": "الاستلام والفحص", "odometer": "العداد (كم)", "charge": "نسبة الشحن %",
  "battery": "حالة بطارية الجهد العالي", "concerns": "الأعطال المُبلّغ عنها", "intakeNotes": "ملاحظات الفحص",
  "advance": "تقديم الحالة", "approve": "اعتماد", "empty": "لا توجد أوامر صيانة بعد",
  "lines": "البنود", "addLine": "إضافة بند", "description": "الوصف", "qty": "الكمية",
  "unitPrice": "سعر الوحدة", "discount": "الخصم", "lineType": "النوع", "lineTotal": "الإجمالي",
  "subtotal": "المجموع الفرعي", "discountTotal": "الخصم", "grandTotal": "الإجمالي",
  "media": "الصور والفيديو", "upload": "رفع", "noMedia": "لا توجد صور أو فيديو بعد",
  "notFound": "أمر الصيانة غير موجود", "approvedAt": "اعتُمد"
},
"status": {
  "appointment": "موعد", "intake": "استلام", "diagnosis": "تشخيص",
  "estimate": "تقدير", "awaiting_approval": "بانتظار الموافقة", "in_progress": "قيد التنفيذ",
  "qc": "فحص الجودة", "ready": "جاهز", "closed": "مغلق", "cancelled": "ملغى"
},
"lineType": { "service": "خدمة", "part": "قطعة", "fee": "رسوم" },
"discountType": { "none": "بدون", "amount": "مبلغ", "percent": "نسبة" },
"errors": { "saveFailed": "تعذّر الحفظ. حاول مرة أخرى." }
```

- [ ] **Step 3: Create `src/components/ui/Toast.tsx`** — minimal toast context (the shared mutation-error surface):
```tsx
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string };
const ToastCtx = createContext<{ show: (m: string) => void }>({ show: () => {} });
export const useToast = () => useContext(ToastCtx);

let nextId = 1;
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 inset-x-0 flex flex-col items-center gap-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="bg-red-600 text-white text-sm rounded-lg px-4 py-2 shadow-lg">{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
```
Wire `<ToastProvider>` into `src/main.tsx` (inside the providers, around `<App/>`; it needs no other context). Note `Date.now()` is fine in app runtime (this is not a workflow script).

- [ ] **Step 4: Create `src/components/ui/Select.tsx`:**
```tsx
import { forwardRef, useId } from "react";

type Option = { value: string; label: string };
type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: Option[]; error?: string };

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, error, id, ...rest }, ref
) {
  const generated = useId();
  const fieldId = id ?? rest.name ?? generated;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium">{label}</label>
      <select id={fieldId} ref={ref} className="w-full border rounded-lg px-3 py-2 bg-transparent" {...rest}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
```

- [ ] **Step 5:** Run `npm test` (i18n parity must pass) and `npm run build`. Commit: `feat(orders): i18n strings, toast, and select primitive`

---

## Task 2: Order types + status helper + zod schemas (TDD)

**Files:** create `src/features/orders/types.ts`, `status.ts`, `status.test.ts`, `schema.ts`, `schema.test.ts`.

- [ ] **Step 1: Write `src/features/orders/status.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { ORDER_STATUSES, nextStatus, canAdvance } from "@/features/orders/status";

describe("order status flow", () => {
  it("lists the lifecycle in order", () => {
    expect(ORDER_STATUSES[0]).toBe("appointment");
    expect(ORDER_STATUSES).toContain("in_progress");
    expect(ORDER_STATUSES[ORDER_STATUSES.length - 1]).toBe("cancelled");
  });
  it("advances to the next linear status", () => {
    expect(nextStatus("intake")).toBe("diagnosis");
    expect(nextStatus("qc")).toBe("ready");
  });
  it("does not advance past 'closed'", () => {
    expect(nextStatus("closed")).toBeNull();
  });
  it("cannot advance a cancelled or closed order", () => {
    expect(canAdvance("cancelled")).toBe(false);
    expect(canAdvance("closed")).toBe(false);
    expect(canAdvance("intake")).toBe(true);
  });
});
```

- [ ] **Step 2:** Run `npm test`, confirm FAIL.

- [ ] **Step 3: Create `src/features/orders/types.ts`:**
```ts
export type OrderStatus =
  | "appointment" | "intake" | "diagnosis" | "estimate" | "awaiting_approval"
  | "in_progress" | "qc" | "ready" | "closed" | "cancelled";
export type LineType = "service" | "part" | "fee";
export type DiscountType = "none" | "amount" | "percent";

export interface ServiceOrder {
  id: string;
  branch_id: string;
  vehicle_id: string;
  customer_id: string;
  order_number: number;
  status: OrderStatus;
  odometer_at_intake: number | null;
  charge_percent: number | null;
  hv_battery_state: string | null;
  reported_concerns: string | null;
  intake_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  closed_at: string | null;
  next_service_due_date: string | null;
  next_service_due_odometer: number | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderLine {
  id: string;
  service_order_id: string;
  line_type: LineType;
  description: string;
  quantity: number;
  unit_price: number;
  discount_type: DiscountType;
  discount_value: number;
  line_total: number;
  created_at: string;
}

export interface InspectionMedia {
  id: string;
  service_order_id: string;
  media_type: "photo" | "video";
  storage_path: string;
  caption: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Create `src/features/orders/status.ts`:**
```ts
import type { TFunction } from "i18next";
import type { OrderStatus } from "./types";

// The forward linear pipeline (cancelled is a terminal side-state, not in the line).
const PIPELINE: OrderStatus[] = [
  "appointment", "intake", "diagnosis", "estimate", "awaiting_approval",
  "in_progress", "qc", "ready", "closed",
];

export const ORDER_STATUSES: OrderStatus[] = [...PIPELINE, "cancelled"];

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = PIPELINE.indexOf(s);
  if (i === -1 || i >= PIPELINE.length - 1) return null; // not in pipeline, or already 'closed'
  return PIPELINE[i + 1];
}

export function canAdvance(s: OrderStatus): boolean {
  return nextStatus(s) !== null;
}

export function statusLabel(t: TFunction, s: OrderStatus): string {
  return t(`status.${s}`);
}
```

- [ ] **Step 5:** Run `npm test`, confirm the status tests PASS.

- [ ] **Step 6: Write `src/features/orders/schema.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { intakeSchema, lineSchema } from "@/features/orders/schema";

describe("intakeSchema", () => {
  it("requires customer and vehicle", () => {
    expect(() => intakeSchema.parse({ customer_id: "", vehicle_id: "" })).toThrow();
  });
  it("coerces numeric intake fields and nulls blanks", () => {
    const p = intakeSchema.parse({
      customer_id: "c1", vehicle_id: "v1", odometer_at_intake: "15000",
      charge_percent: "80", hv_battery_state: "", reported_concerns: "", intake_notes: "",
    });
    expect(p.odometer_at_intake).toBe(15000);
    expect(p.charge_percent).toBe(80);
    expect(p.hv_battery_state).toBeNull();
  });
  it("rejects charge outside 0-100", () => {
    expect(() => intakeSchema.parse({ customer_id: "c", vehicle_id: "v", charge_percent: "150" })).toThrow();
  });
});

describe("lineSchema", () => {
  it("requires a description and positive qty", () => {
    expect(() => lineSchema.parse({ description: "", quantity: "1", unit_price: "10" })).toThrow();
    expect(() => lineSchema.parse({ description: "Brake pads", quantity: "0", unit_price: "10" })).toThrow();
  });
  it("coerces numbers and defaults discount to none", () => {
    const p = lineSchema.parse({ description: "Brake pads", quantity: "2", unit_price: "12.5" });
    expect(p.quantity).toBe(2);
    expect(p.unit_price).toBe(12.5);
    expect(p.discount_type).toBe("none");
    expect(p.discount_value).toBe(0);
  });
});
```

- [ ] **Step 7:** Run `npm test`, confirm FAIL.

- [ ] **Step 8: Create `src/features/orders/schema.ts`** (reuse the optional helpers' style from `@/features/customers/schema`; numbers via coercion; charge 0–100). Use zod v4 (`ctx.addIssue("msg")` string shorthand works — verified):
```ts
import { z } from "zod";

const optText = z.string().optional().transform((v) => {
  const t = (v ?? "").trim(); return t.length ? t : null;
});
const reqText = (msg: string) => z.string().trim().min(1, msg);

// blank -> null; numeric string -> number; else error. Optional bounds.
const optNum = (opts?: { min?: number; max?: number; int?: boolean }) =>
  z.union([z.string(), z.number()]).optional().transform((v, ctx) => {
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || (opts?.int && !Number.isInteger(n))) { ctx.addIssue("Must be a number"); return z.NEVER; }
    if (opts?.min != null && n < opts.min) { ctx.addIssue(`Must be ≥ ${opts.min}`); return z.NEVER; }
    if (opts?.max != null && n > opts.max) { ctx.addIssue(`Must be ≤ ${opts.max}`); return z.NEVER; }
    return n;
  });

// required number > 0 (for line quantity)
const reqPositive = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) { ctx.addIssue("Must be greater than 0"); return z.NEVER; }
  return n;
});
const reqNonNeg = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) { ctx.addIssue("Must be 0 or more"); return z.NEVER; }
  return n;
});

export const intakeSchema = z.object({
  customer_id: reqText("Customer is required"),
  vehicle_id: reqText("Vehicle is required"),
  odometer_at_intake: optNum({ min: 0, int: true }),
  charge_percent: optNum({ min: 0, max: 100, int: true }),
  hv_battery_state: optText,
  reported_concerns: optText,
  intake_notes: optText,
});

export const lineSchema = z.object({
  line_type: z.enum(["service", "part", "fee"]).default("service"),
  description: reqText("Description is required"),
  quantity: reqPositive,
  unit_price: reqNonNeg,
  discount_type: z.enum(["none", "amount", "percent"]).default("none"),
  discount_value: reqNonNeg.default(0),
});

export type IntakeFormValues = z.input<typeof intakeSchema>;
export type IntakePayload = z.output<typeof intakeSchema>;
export type LineFormValues = z.input<typeof lineSchema>;
export type LinePayload = z.output<typeof lineSchema>;
```

- [ ] **Step 9:** Run `npm test` (all pass), `npm run build` clean. Commit: `feat(orders): types, status helper, and intake/line schemas`

---

## Task 3: Line math bridge (TDD)

**Files:** create `src/features/orders/lineMath.ts`, `lineMath.test.ts`.

The DB line columns are snake_case; `@/lib/money` expects camelCase `LineInput`. This bridges them and computes the persisted `line_total` and the order totals.

- [ ] **Step 1: Write `src/features/orders/lineMath.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { lineToInput, computeLineTotalFromRow, computeOrderTotals } from "@/features/orders/lineMath";
import type { ServiceOrderLine } from "@/features/orders/types";

const row = (over: Partial<ServiceOrderLine>): ServiceOrderLine => ({
  id: "l", service_order_id: "o", line_type: "service", description: "x",
  quantity: 1, unit_price: 0, discount_type: "none", discount_value: 0, line_total: 0,
  created_at: "", ...over,
});

describe("lineMath", () => {
  it("maps a row to money LineInput", () => {
    expect(lineToInput(row({ quantity: 2, unit_price: 12.5 }))).toEqual({
      quantity: 2, unitPrice: 12.5, discountType: "none", discountValue: 0,
    });
  });
  it("computes a line total from a row (percent discount)", () => {
    expect(computeLineTotalFromRow(row({ quantity: 1, unit_price: 200, discount_type: "percent", discount_value: 10 }))).toBe(180);
  });
  it("computes order totals reconciling with summed line totals", () => {
    const lines = [
      row({ quantity: 1, unit_price: 100, discount_type: "amount", discount_value: 10 }),
      row({ quantity: 2, unit_price: 50, discount_type: "percent", discount_value: 10 }),
    ];
    expect(computeOrderTotals(lines)).toEqual({ subtotal: 200, discountTotal: 20, total: 180 });
  });
});
```

- [ ] **Step 2:** Run `npm test`, confirm FAIL.

- [ ] **Step 3: Create `src/features/orders/lineMath.ts`:**
```ts
import { computeLineTotal, computeInvoiceTotals, type LineInput } from "@/lib/money";
import type { ServiceOrderLine, DiscountType } from "./types";
import type { LinePayload } from "./schema";

export function lineToInput(l: Pick<ServiceOrderLine, "quantity" | "unit_price" | "discount_type" | "discount_value">): LineInput {
  return { quantity: l.quantity, unitPrice: l.unit_price, discountType: l.discount_type, discountValue: l.discount_value };
}

export function computeLineTotalFromRow(l: ServiceOrderLine): number {
  return computeLineTotal(lineToInput(l));
}

/** Compute the persisted line_total for a validated line payload (used on insert/update). */
export function lineTotalForPayload(p: LinePayload): number {
  return computeLineTotal({
    quantity: p.quantity, unitPrice: p.unit_price,
    discountType: p.discount_type as DiscountType, discountValue: p.discount_value,
  });
}

export function computeOrderTotals(lines: ServiceOrderLine[]) {
  return computeInvoiceTotals(lines.map(lineToInput));
}
```

- [ ] **Step 4:** Run `npm test` (pass), `npm run build`. Commit: `feat(orders): line math bridge to money core`

---

## Task 4: Orders data layer (api + hooks)

**Files:** create `src/features/orders/api.ts`, `hooks.ts`.

- [ ] **Step 1: Create `src/features/orders/api.ts`:**
```ts
import { supabase } from "@/lib/supabase";
import { getDefaultBranchId } from "@/lib/branch";
import { lineTotalForPayload } from "./lineMath";
import type { ServiceOrder, ServiceOrderLine, InspectionMedia, OrderStatus } from "./types";
import type { IntakePayload, LinePayload } from "./schema";

const BUCKET = "inspection-media";

export async function listOrders(status?: OrderStatus): Promise<ServiceOrder[]> {
  let q = supabase.from("service_orders").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data as ServiceOrder[];
}

export async function getOrder(id: string): Promise<ServiceOrder> {
  const { data, error } = await supabase.from("service_orders").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ServiceOrder;
}

export async function createOrder(payload: IntakePayload): Promise<ServiceOrder> {
  const branch_id = await getDefaultBranchId();
  const { data, error } = await supabase.from("service_orders")
    .insert({ ...payload, branch_id, status: "intake" }).select().single();
  if (error) throw error;
  return data as ServiceOrder;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<ServiceOrder> {
  const patch: Record<string, unknown> = { status };
  if (status === "closed") patch.closed_at = new Date().toISOString();
  const { data, error } = await supabase.from("service_orders").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as ServiceOrder;
}

export async function approveOrder(id: string, approvedBy: string): Promise<ServiceOrder> {
  const { data, error } = await supabase.from("service_orders")
    .update({ approved_at: new Date().toISOString(), approved_by: approvedBy, status: "in_progress" })
    .eq("id", id).select().single();
  if (error) throw error;
  return data as ServiceOrder;
}

// ----- Lines -----
export async function listLines(orderId: string): Promise<ServiceOrderLine[]> {
  const { data, error } = await supabase.from("service_order_lines")
    .select("*").eq("service_order_id", orderId).order("created_at", { ascending: true });
  if (error) throw error;
  return data as ServiceOrderLine[];
}

export async function createLine(orderId: string, payload: LinePayload): Promise<ServiceOrderLine> {
  const line_total = lineTotalForPayload(payload);
  const { data, error } = await supabase.from("service_order_lines")
    .insert({ ...payload, service_order_id: orderId, line_total }).select().single();
  if (error) throw error;
  return data as ServiceOrderLine;
}

export async function updateLine(id: string, payload: LinePayload): Promise<ServiceOrderLine> {
  const line_total = lineTotalForPayload(payload);
  const { data, error } = await supabase.from("service_order_lines")
    .update({ ...payload, line_total }).eq("id", id).select().single();
  if (error) throw error;
  return data as ServiceOrderLine;
}

export async function deleteLine(id: string): Promise<void> {
  const { error } = await supabase.from("service_order_lines").delete().eq("id", id);
  if (error) throw error;
}

// ----- Media (Supabase Storage) -----
export async function listMedia(orderId: string): Promise<InspectionMedia[]> {
  const { data, error } = await supabase.from("inspection_media")
    .select("*").eq("service_order_id", orderId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as InspectionMedia[];
}

export async function uploadMedia(orderId: string, file: File): Promise<InspectionMedia> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (up.error) throw up.error;
  const media_type = file.type.startsWith("video") ? "video" : "photo";
  const { data, error } = await supabase.from("inspection_media")
    .insert({ service_order_id: orderId, storage_path: path, media_type }).select().single();
  if (error) throw error;
  return data as InspectionMedia;
}

export async function signedMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteMedia(m: InspectionMedia): Promise<void> {
  await supabase.storage.from(BUCKET).remove([m.storage_path]);
  const { error } = await supabase.from("inspection_media").delete().eq("id", m.id);
  if (error) throw error;
}
```

- [ ] **Step 2: Create `src/features/orders/hooks.ts`** — TanStack Query hooks mirroring the CRM hooks pattern: `useOrders(status?)`, `useOrder(id)`, `useCreateOrder()`, `useAdvanceStatus(id)` (calls `updateOrderStatus` to `nextStatus`), `useApproveOrder(id)`, `useLines(orderId)`, `useCreateLine(orderId)`, `useUpdateLine(orderId)`, `useDeleteLine(orderId)`, `useMedia(orderId)`, `useUploadMedia(orderId)`, `useDeleteMedia(orderId)`. Query keys: `["orders", status ?? "all"]`, `["order", id]`, `["lines", orderId]`, `["media", orderId]`. Each mutation invalidates the relevant keys (advance/approve invalidate `["orders"]` and `["order", id]`; line mutations invalidate `["lines", orderId]`; media mutations invalidate `["media", orderId]`). Follow the EXACT structure of `src/features/customers/hooks.ts` (read it first). For `useAdvanceStatus`, import `nextStatus` from `./status` and compute the target; the mutationFn receives the current status.

- [ ] **Step 3:** `npm run build` clean, `npm test` pass. Commit: `feat(orders): supabase data layer and query hooks`

---

## Task 5: Orders list page (status filter)

**Files:** modify `src/pages/ServiceOrdersPage.tsx`; create `src/pages/ServiceOrdersPage.test.tsx`; create `src/features/orders/OrderStatusBadge.tsx`.

- [ ] **Step 1: Create `OrderStatusBadge.tsx`** — small pill rendering `statusLabel(t, status)` with a neutral colored background per status group (intake/diagnosis = blue, in_progress = amber, ready/closed = green, cancelled = gray). RTL-safe.

- [ ] **Step 2: Replace `ServiceOrdersPage.tsx`** — heading + "New service order" link (`buttonClasses()` on a `<Link to="/orders/new">`); a status `<Select>` filter (options = `orders.allStatuses` + each `ORDER_STATUSES` label) driving `useOrders(status)`; loading/empty states; a list where each row links to `/orders/:id` showing `#order_number`, the vehicle/customer (fetch via a joined select OR show ids for now — prefer joining customer name: extend `listOrders` select to `*, customers(name), vehicles(plate_number, model)` and read nested; if you add the join, update the `ServiceOrder` list type usage with a list-specific type `OrderListRow`). Keep it simple and typed.

- [ ] **Step 3: Create `ServiceOrdersPage.test.tsx`** — mock `@/features/orders/hooks` `useOrders` to return rows and empty; assert a row (`#1` / status label) and the empty state render; wrap in i18n + router. Mirror `CustomersPage.test.tsx`.

- [ ] **Step 4:** tests + build green. Commit: `feat(orders): service orders list with status filter`

---

## Task 6: New order page (customer + vehicle picker + intake)

**Files:** create `src/pages/NewOrderPage.tsx`, `src/features/orders/IntakeForm.tsx`.

- [ ] **Step 1: Create `IntakeForm.tsx`** — react-hook-form + `zodResolver(intakeSchema)` with `useForm<IntakeFormValues, unknown, IntakePayload>`. Fields: a customer `<Select>` (options from `useCustomers()`), a vehicle `<Select>` (options from `useVehicles(selectedCustomerId)` — the vehicle select is disabled until a customer is chosen; watch the `customer_id` field via RHF `watch`), then `odometer_at_intake`, `charge_percent` (numeric TextFields), `hv_battery_state`, `reported_concerns`, `intake_notes` (TextFields). Save + Cancel. `onSubmit: (payload: IntakePayload) => void`. Use the `values`-prop pattern only if editing (here it's create-only, so defaultValues blank is fine).

- [ ] **Step 2: Create `NewOrderPage.tsx`** — renders `<IntakeForm>`; on submit calls `useCreateOrder().mutate(payload, { onSuccess: (o) => navigate(\`/orders/${o.id}\`), onError: () => toast.show(t("errors.saveFailed")) })`. Uses `useToast`.

- [ ] **Step 3:** build + tests green. Commit: `feat(orders): new order intake form and page`

---

## Task 7: Order detail — header, status, intake display

**Files:** create `src/pages/OrderDetailPage.tsx`.

- [ ] **Step 1: Create `OrderDetailPage.tsx`** — loads `useOrder(id)`; loading + not-found (`orders.notFound`) states. Header: `#order_number`, `OrderStatusBadge`, vehicle + customer (fetch the order's customer via `useCustomer(order.customer_id)` and vehicle via a new `useVehicle(id)` hook OR display ids; prefer customer name + vehicle plate — add a small `getVehicle(id)` to CRM api/hooks if needed, or join in `getOrder`). Status controls: an "Advance status" button (visible when `canAdvance(status)`) calling `useAdvanceStatus`; when `status === "awaiting_approval"`, show an "Mark approved" button calling `useApproveOrder` (stamps approved_at/by — use the logged-in user's email from `useAuth().session?.user?.email ?? "admin"`). Intake panel: odometer, charge %, battery, concerns, notes (read-only display). Then render `<LineItemsEditor orderId={id} />` and `<InspectionMedia orderId={id} />` (Tasks 8-9). Use `useToast` + `onError` on mutations.

- [ ] **Step 2:** build + tests green. Commit: `feat(orders): order detail page with status workflow`

---

## Task 8: Line items editor (TDD on the totals UI)

**Files:** create `src/features/orders/LineItemsEditor.tsx`, `LineItemsEditor.test.tsx`.

- [ ] **Step 1: Create `LineItemsEditor.tsx`** — `useLines(orderId)` lists lines in a table (description, type, qty, unit price, discount, line_total). An inline add row (or toggled `LineForm`) with `line_type` Select, description TextField, qty/unit_price numeric, discount_type Select + discount_value; on submit `useCreateLine`. Per-row edit (inline) via `useUpdateLine` and delete via `useDeleteLine` (with confirm). Below the table show **live totals** via `computeOrderTotals(lines)`: subtotal, discount, grand total (JOD, 3 decimals — format with `toFixed(3)`). Each line's displayed total uses the persisted `line_total`. Mutations use `useToast` onError.

- [ ] **Step 2: Create `LineItemsEditor.test.tsx`** — mock `@/features/orders/hooks` so `useLines` returns two lines; assert each line_total renders and the computed grand total renders (e.g. lines summing to "180.000"). Mock the mutation hooks as `{ mutate: vi.fn(), isPending: false }`. Wrap in i18n + a QueryClient is not needed since hooks are mocked.

- [ ] **Step 3:** tests + build green. Commit: `feat(orders): line items editor with live totals`

---

## Task 9: Inspection media (upload + gallery)

**Files:** create `src/features/orders/InspectionMedia.tsx`.

- [ ] **Step 1: Create `InspectionMedia.tsx`** — `useMedia(orderId)` lists media; an `<input type="file" accept="image/*,video/*" multiple>` whose onChange calls `useUploadMedia` for each file (show uploading state; onError toast). Render a gallery grid: for each media item, resolve its signed URL (a small `MediaThumb` component that calls `signedMediaUrl(path)` via a `useQuery(["signed", path])` and renders `<img>` for photo / `<video controls>` for video). Each item has a delete button (confirm → `useDeleteMedia`). Empty state `orders.noMedia`. RTL-safe grid, generous spacing.

- [ ] **Step 2:** build + tests green. Commit: `feat(orders): inspection media upload and gallery`

---

## Task 10: Wire routes + integration test

**Files:** modify `src/App.tsx`; create `src/pages/Orders.integration.test.tsx`.

- [ ] **Step 1: Add routes** under the AppLayout group (keep catch-all last):
```tsx
<Route path="/orders/new" element={<NewOrderPage />} />
<Route path="/orders/:id" element={<OrderDetailPage />} />
```
(import `NewOrderPage`, `OrderDetailPage`; `ServiceOrdersPage` already routed at `/orders`.)

- [ ] **Step 2: Create `Orders.integration.test.tsx`** — mock `@/features/orders/api` (listOrders → one row; getOrder → that order; listLines → []; listMedia → []) and `@/features/customers/hooks` as needed; render `/orders` → click the order → assert the detail header (`#<order_number>` and the status label) renders. Mirror `Customers.integration.test.tsx` (real hooks + QueryClient, api mocked).

- [ ] **Step 3:** full suite + build green. Commit: `test(orders): list→detail integration test`

---

## Self-Review (against the spec)

**Spec coverage (Service Orders + Intake/Inspection):**
- Job-card lifecycle (9-stage status enum) → `status.ts` + status controls (Tasks 2, 7) ✓
- Intake: structured fields + reported concerns + notes → `intakeSchema` + `IntakeForm` (Tasks 2, 6) ✓
- Inspection: photos/video to private Storage + notes (no diagram) → `InspectionMedia` (Task 9) ✓
- HV battery state, charge %, odometer at intake → intake fields ✓
- Estimate = priced line items sharing `service_order_lines`, totals via money core → `lineMath` + `LineItemsEditor` (Tasks 3, 8) ✓
- Approval recorded (who/when) → `approveOrder` (Task 4, 7) ✓
- Attaches to existing customer+vehicle → picker reuses CRM hooks (Task 6) ✓
- Cross-module follow-ups (i18n errors, toast) → Task 1 toast + onError wiring ✓

**Deferred (correctly out of this plan):** generating an invoice record + payments + payment status (Invoicing plan); the dashboard board (Dashboard plan); software-update-due tracking (Phase 2); next_service_due capture at handover (light — can add in Invoicing/handover).

**Placeholder scan:** Tasks 5–9 describe component structure with key code and exact integration points; the engineer has complete schemas/api/hooks to build against. Where a component's full JSX isn't inlined, the data contracts (hook names, payload types, i18n keys, money helpers) are fully specified. (During execution, follow the established CRM component patterns exactly.)

**Type consistency:** `OrderStatus`/`LineType`/`DiscountType` (types.ts) align with the DB enums; `IntakePayload`/`LinePayload` (schema) used by api + forms; `lineTotalForPayload` feeds `line_total`; query keys consistent between hooks and invalidations; routes (`/orders`, `/orders/new`, `/orders/:id`) match links.

---

## Next Plans
- `2026-06-21-vw-ev-phase1-invoicing.md` (invoice from lines + payments + payment status; handover sets next_service_due)
- `2026-06-21-vw-ev-phase1-dashboard.md` (KPIs + status board)
