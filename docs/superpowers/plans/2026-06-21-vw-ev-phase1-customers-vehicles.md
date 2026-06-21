# VW EV Service Center — Phase 1 Customers & Vehicles (CRM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CRM module on the Phase 1 foundation — manage customers and their vehicles (list, search, create, edit, delete) against the existing Supabase schema, bilingual (EN/AR + RTL), so later modules (Service Orders) can attach to a real `vehicle_id`/`customer_id`.

**Architecture:** Feature-folder for logic (`src/features/customers/` holds types, zod schemas, the Supabase data layer, and TanStack Query hooks); thin route pages live in `src/pages/`; a couple of tiny reusable form primitives go in `src/components/ui/`. Forms use react-hook-form + zod (the zod schema is the single source of truth for what gets written to Supabase — mirroring the project's known gotcha that columns missing from the input schema silently fail to persist). Data fetching/mutation is TanStack Query with cache invalidation. Vehicles are managed inline on the customer detail page.

**Tech Stack (added this plan):** react-hook-form, zod, @hookform/resolvers (on top of the foundation's React/TS/Supabase/Tailwind/i18n/Query/Router).

---

## File Structure (created/modified by this plan)

```
src/
├─ lib/
│  └─ branch.ts                         # NEW: getDefaultBranchId() — single-branch helper
├─ components/ui/
│  ├─ TextField.tsx                     # NEW: labelled input (RTL-safe, generous spacing)
│  └─ Button.tsx                        # NEW: small button primitive
├─ features/customers/
│  ├─ types.ts                          # NEW: Customer, Vehicle row types (match DB)
│  ├─ schema.ts                         # NEW: zod customerSchema / vehicleSchema (+ inferred input types)
│  ├─ schema.test.ts                    # NEW: schema validation tests
│  ├─ api.ts                            # NEW: Supabase CRUD for customers + vehicles
│  ├─ hooks.ts                          # NEW: TanStack Query hooks
│  ├─ CustomerForm.tsx                  # NEW: create/edit customer form
│  ├─ CustomerForm.test.tsx             # NEW: form validation render test
│  └─ VehicleForm.tsx                   # NEW: inline create/edit vehicle form
├─ pages/
│  ├─ CustomersPage.tsx                 # MODIFY: list + search + add (replaces placeholder)
│  ├─ CustomersPage.test.tsx            # NEW: list render test (hooks mocked)
│  ├─ CustomerFormPage.tsx             # NEW: route wrapper for new/edit customer
│  └─ CustomerDetailPage.tsx            # NEW: customer info + vehicles management
├─ App.tsx                              # MODIFY: nested /customers routes
└─ i18n/{en,ar}.json                    # MODIFY: customers/vehicles/action strings
```

---

## Task 1: Install form deps + add i18n strings

**Files:**
- Modify: `package.json` (deps), `src/i18n/en.json`, `src/i18n/ar.json`

- [ ] **Step 1: Install**

```bash
npm install react-hook-form zod @hookform/resolvers
```

- [ ] **Step 2: Add a `customers` block + `actions`/`common` additions to `src/i18n/en.json`.** Merge these keys into the existing JSON (keep existing keys):

```json
"actions": {
  "add": "Add", "edit": "Edit", "delete": "Delete", "save": "Save",
  "cancel": "Cancel", "search": "Search", "back": "Back", "confirmDelete": "Are you sure you want to delete this?"
},
"customers": {
  "title": "Customers", "addCustomer": "Add customer", "newCustomer": "New customer",
  "editCustomer": "Edit customer", "name": "Name", "phone": "Phone", "email": "Email",
  "notes": "Notes", "empty": "No customers yet", "searchPlaceholder": "Search by name…",
  "details": "Customer details"
},
"vehicles": {
  "title": "Vehicles", "addVehicle": "Add vehicle", "editVehicle": "Edit vehicle",
  "plate": "Plate number", "vin": "VIN", "model": "Model", "year": "Year", "color": "Color",
  "odometer": "Odometer (km)", "battery": "HV battery state", "software": "Software version",
  "notes": "Notes", "empty": "No vehicles for this customer yet"
}
```

- [ ] **Step 3: Add the SAME keys (translated) to `src/i18n/ar.json`:**

```json
"actions": {
  "add": "إضافة", "edit": "تعديل", "delete": "حذف", "save": "حفظ",
  "cancel": "إلغاء", "search": "بحث", "back": "رجوع", "confirmDelete": "هل أنت متأكد من الحذف؟"
},
"customers": {
  "title": "العملاء", "addCustomer": "إضافة عميل", "newCustomer": "عميل جديد",
  "editCustomer": "تعديل العميل", "name": "الاسم", "phone": "الهاتف", "email": "البريد الإلكتروني",
  "notes": "ملاحظات", "empty": "لا يوجد عملاء بعد", "searchPlaceholder": "ابحث بالاسم…",
  "details": "بيانات العميل"
},
"vehicles": {
  "title": "المركبات", "addVehicle": "إضافة مركبة", "editVehicle": "تعديل المركبة",
  "plate": "رقم اللوحة", "vin": "رقم الهيكل", "model": "الطراز", "year": "السنة", "color": "اللون",
  "odometer": "العداد (كم)", "battery": "حالة بطارية الجهد العالي", "software": "إصدار البرمجيات",
  "notes": "ملاحظات", "empty": "لا توجد مركبات لهذا العميل بعد"
}
```

- [ ] **Step 4: Verify parity + build**

Run: `npm test` (the existing i18n key-parity test must still pass) and `npm run build`.
Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/i18n
git commit -m "feat(crm): add form deps and customer/vehicle i18n strings"
```

---

## Task 2: Domain types + Zod schemas (TDD)

**Files:**
- Create: `src/features/customers/types.ts`, `src/features/customers/schema.ts`, `src/features/customers/schema.test.ts`

- [ ] **Step 1: Write failing tests — `src/features/customers/schema.test.ts`:**

```ts
import { describe, it, expect } from "vitest";
import { customerSchema, vehicleSchema } from "@/features/customers/schema";

describe("customerSchema", () => {
  it("accepts a valid customer and trims/normalizes empties to null", () => {
    const parsed = customerSchema.parse({ name: "Ahmad", phone: "", email: "", notes: "" });
    expect(parsed.name).toBe("Ahmad");
    expect(parsed.phone).toBeNull();
    expect(parsed.email).toBeNull();
  });
  it("rejects a missing name", () => {
    expect(() => customerSchema.parse({ name: "" })).toThrow();
  });
  it("rejects an invalid email", () => {
    expect(() => customerSchema.parse({ name: "A", email: "not-an-email" })).toThrow();
  });
});

describe("vehicleSchema", () => {
  it("coerces year/odometer from strings and nulls empties", () => {
    const parsed = vehicleSchema.parse({ plate_number: "12-3456", model_year: "2022", current_odometer: "15000", vin: "" });
    expect(parsed.model_year).toBe(2022);
    expect(parsed.current_odometer).toBe(15000);
    expect(parsed.vin).toBeNull();
  });
  it("leaves numeric fields null when blank", () => {
    const parsed = vehicleSchema.parse({ model_year: "", current_odometer: "" });
    expect(parsed.model_year).toBeNull();
    expect(parsed.current_odometer).toBeNull();
  });
  it("rejects a non-numeric year", () => {
    expect(() => vehicleSchema.parse({ model_year: "abc" })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests, confirm they FAIL** (`npm test` — module not found).

- [ ] **Step 3: Create `src/features/customers/types.ts`** (rows as returned by Supabase, snake_case):

```ts
export interface Customer {
  id: string;
  branch_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  branch_id: string;
  customer_id: string;
  vin: string | null;
  plate_number: string | null;
  model: string | null;
  model_year: number | null;
  color: string | null;
  current_odometer: number | null;
  hv_battery_state: string | null;
  software_version: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Create `src/features/customers/schema.ts`.** The zod schema is the source of truth for what is written to Supabase — every persisted column must appear here:

```ts
import { z } from "zod";

// "" or whitespace → null; otherwise the trimmed string.
const optionalText = z
  .string()
  .optional()
  .transform((v) => {
    const t = (v ?? "").trim();
    return t.length ? t : null;
  });

// "" → null; numeric string → number; anything else → error.
const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a whole number" });
      return z.NEVER;
    }
    return n;
  });

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: optionalText,
  email: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email")
    .transform((v) => (v.length ? v : null)),
  notes: optionalText,
});

export const vehicleSchema = z.object({
  plate_number: optionalText,
  vin: optionalText,
  model: optionalText,
  model_year: optionalInt,
  color: optionalText,
  current_odometer: optionalInt,
  hv_battery_state: optionalText,
  software_version: optionalText,
  notes: optionalText,
});

// Form input (raw, before transform) vs payload (after transform, what we send to Supabase)
export type CustomerFormValues = z.input<typeof customerSchema>;
export type CustomerPayload = z.output<typeof customerSchema>;
export type VehicleFormValues = z.input<typeof vehicleSchema>;
export type VehiclePayload = z.output<typeof vehicleSchema>;
```

- [ ] **Step 5: Run tests, confirm PASS** (`npm test`).

- [ ] **Step 6: Commit**

```bash
git add src/features/customers/types.ts src/features/customers/schema.ts src/features/customers/schema.test.ts
git commit -m "feat(crm): customer/vehicle types and zod schemas"
```

---

## Task 3: Branch helper + Supabase data layer

**Files:**
- Create: `src/lib/branch.ts`, `src/features/customers/api.ts`

- [ ] **Step 1: Create `src/lib/branch.ts`** (single-branch id resolver, cached):

```ts
import { supabase } from "@/lib/supabase";

let cached: string | null = null;

/** Returns the (single, Phase 1) branch id, fetching+caching it once. */
export async function getDefaultBranchId(): Promise<string> {
  if (cached) return cached;
  const { data, error } = await supabase.from("branches").select("id").limit(1).single();
  if (error) throw error;
  cached = data.id as string;
  return cached;
}
```

- [ ] **Step 2: Create `src/features/customers/api.ts`:**

```ts
import { supabase } from "@/lib/supabase";
import { getDefaultBranchId } from "@/lib/branch";
import type { Customer, Vehicle } from "./types";
import type { CustomerPayload, VehiclePayload } from "./schema";

export async function listCustomers(search = ""): Promise<Customer[]> {
  let q = supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data as Customer[];
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Customer;
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const branch_id = await getDefaultBranchId();
  const { data, error } = await supabase.from("customers").insert({ ...payload, branch_id }).select().single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(id: string, payload: CustomerPayload): Promise<Customer> {
  const { data, error } = await supabase.from("customers").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

export async function listVehicles(customerId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles").select("*").eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Vehicle[];
}

export async function createVehicle(customerId: string, payload: VehiclePayload): Promise<Vehicle> {
  const branch_id = await getDefaultBranchId();
  const { data, error } = await supabase
    .from("vehicles").insert({ ...payload, customer_id: customerId, branch_id }).select().single();
  if (error) throw error;
  return data as Vehicle;
}

export async function updateVehicle(id: string, payload: VehiclePayload): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 3: Type-check + tests still green**

Run: `npm run build` and `npm test`. Expected: clean / PASS. (This layer is thin; it's covered indirectly by hook/component tests in later tasks where the `api` module is mocked, and verified manually once a live Supabase project exists.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/branch.ts src/features/customers/api.ts
git commit -m "feat(crm): branch helper and Supabase customer/vehicle data layer"
```

---

## Task 4: TanStack Query hooks

**Files:**
- Create: `src/features/customers/hooks.ts`

- [ ] **Step 1: Create `src/features/customers/hooks.ts`:**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { CustomerPayload, VehiclePayload } from "./schema";

export function useCustomers(search = "") {
  return useQuery({ queryKey: ["customers", search], queryFn: () => api.listCustomers(search) });
}

export function useCustomer(id: string | undefined) {
  return useQuery({ queryKey: ["customer", id], queryFn: () => api.getCustomer(id!), enabled: !!id });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerPayload) => api.createCustomer(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerPayload) => api.updateCustomer(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useVehicles(customerId: string | undefined) {
  return useQuery({
    queryKey: ["vehicles", customerId],
    queryFn: () => api.listVehicles(customerId!),
    enabled: !!customerId,
  });
}

export function useCreateVehicle(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: VehiclePayload) => api.createVehicle(customerId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", customerId] }),
  });
}

export function useUpdateVehicle(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: VehiclePayload }) => api.updateVehicle(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", customerId] }),
  });
}

export function useDeleteVehicle(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteVehicle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", customerId] }),
  });
}
```

- [ ] **Step 2: Build + tests green** (`npm run build`, `npm test`).

- [ ] **Step 3: Commit**

```bash
git add src/features/customers/hooks.ts
git commit -m "feat(crm): TanStack Query hooks for customers and vehicles"
```

---

## Task 5: Reusable form primitives

**Files:**
- Create: `src/components/ui/TextField.tsx`, `src/components/ui/Button.tsx`

- [ ] **Step 1: Create `src/components/ui/TextField.tsx`** (block label + input; generous spacing per project preference; RTL-safe via logical default):

```tsx
import { forwardRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, id, ...rest }, ref
) {
  const fieldId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium">{label}</label>
      <input
        id={fieldId}
        ref={ref}
        className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
```

- [ ] **Step 2: Create `src/components/ui/Button.tsx`:**

```tsx
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" };

const styles: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  ghost: "border hover:bg-gray-50",
  danger: "text-red-600 hover:bg-red-50",
};

export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
```

- [ ] **Step 3: Build green** (`npm run build`). Commit:

```bash
git add src/components/ui
git commit -m "feat(ui): TextField and Button primitives"
```

---

## Task 6: Customer list page (search + table)

**Files:**
- Modify: `src/pages/CustomersPage.tsx`
- Create: `src/pages/CustomersPage.test.tsx`

- [ ] **Step 1: Replace `src/pages/CustomersPage.tsx`:**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCustomers } from "@/features/customers/hooks";
import { Button } from "@/components/ui/Button";

export function CustomersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = useCustomers(search);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{t("customers.title")}</h2>
        <Link to="/customers/new"><Button>{t("customers.addCustomer")}</Button></Link>
      </div>

      <input
        className="w-full max-w-sm border rounded-lg px-3 py-2"
        placeholder={t("customers.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={t("actions.search")}
      />

      {isLoading ? (
        <p className="opacity-70">{t("common.loading")}</p>
      ) : !customers || customers.length === 0 ? (
        <p className="opacity-70">{t("customers.empty")}</p>
      ) : (
        <ul className="divide-y border rounded-lg">
          {customers.map((c) => (
            <li key={c.id}>
              <Link to={`/customers/${c.id}`} className="flex justify-between px-4 py-3 hover:bg-gray-50">
                <span className="font-medium">{c.name}</span>
                <span className="opacity-60 text-sm">{c.phone ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/CustomersPage.test.tsx`** (mock the hooks module; assert rows + empty state):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/customers/hooks", () => ({ useCustomers: vi.fn() }));
import { useCustomers } from "@/features/customers/hooks";
import { CustomersPage } from "@/pages/CustomersPage";

const wrap = (ui: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}><MemoryRouter>{ui}</MemoryRouter></I18nextProvider>);

describe("CustomersPage", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("renders customer rows", () => {
    (useCustomers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ id: "1", name: "Ahmad", phone: "0790000000" }], isLoading: false,
    });
    wrap(<CustomersPage />);
    expect(screen.getByText("Ahmad")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    (useCustomers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    wrap(<CustomersPage />);
    expect(screen.getByText("No customers yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests + build.** Expected: PASS / clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/CustomersPage.tsx src/pages/CustomersPage.test.tsx
git commit -m "feat(crm): customer list page with search"
```

---

## Task 7: Customer create/edit form

**Files:**
- Create: `src/features/customers/CustomerForm.tsx`, `src/features/customers/CustomerForm.test.tsx`, `src/pages/CustomerFormPage.tsx`

- [ ] **Step 1: Create `src/features/customers/CustomerForm.tsx`:**

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { customerSchema, type CustomerFormValues, type CustomerPayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { Customer } from "./types";

type Props = {
  defaultValues?: Customer;
  submitting?: boolean;
  onSubmit: (payload: CustomerPayload) => void;
  onCancel: () => void;
};

export function CustomerForm({ defaultValues, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v as CustomerPayload))} className="space-y-5 max-w-md">
      <TextField label={t("customers.name")} {...register("name")} error={errors.name?.message} />
      <TextField label={t("customers.phone")} {...register("phone")} error={errors.phone?.message} />
      <TextField label={t("customers.email")} type="email" {...register("email")} error={errors.email?.message} />
      <TextField label={t("customers.notes")} {...register("notes")} error={errors.notes?.message} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={submitting}>{t("actions.save")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
```

Note: `handleSubmit` returns the schema-transformed values (zodResolver applies the transform), so `v` is already the `CustomerPayload` shape (empties → null). The `as CustomerPayload` cast bridges react-hook-form's input-typed generic.

- [ ] **Step 2: Create `src/pages/CustomerFormPage.tsx`** (handles both new and edit by route):

```tsx
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CustomerForm } from "@/features/customers/CustomerForm";
import { useCustomer, useCreateCustomer, useUpdateCustomer } from "@/features/customers/hooks";

export function CustomerFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: existing } = useCustomer(id);
  const create = useCreateCustomer();
  const update = useUpdateCustomer(id ?? "");
  const mutation = isEdit ? update : create;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{isEdit ? t("customers.editCustomer") : t("customers.newCustomer")}</h2>
      <CustomerForm
        defaultValues={existing}
        submitting={mutation.isPending}
        onCancel={() => navigate(isEdit ? `/customers/${id}` : "/customers")}
        onSubmit={(payload) =>
          mutation.mutate(payload, {
            onSuccess: (saved) => navigate(`/customers/${isEdit ? id : saved.id}`),
          })
        }
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `src/features/customers/CustomerForm.test.tsx`** (validation + submit):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { CustomerForm } from "@/features/customers/CustomerForm";

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("CustomerForm", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("blocks submit and shows an error when name is empty", async () => {
    const onSubmit = vi.fn();
    wrap(<CustomerForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a normalized payload (empties → null)", async () => {
    const onSubmit = vi.fn();
    wrap(<CustomerForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Sara");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sara", phone: null, email: null, notes: null })
    ));
  });
});
```

- [ ] **Step 4: Run tests + build.** Expected PASS / clean. If `@testing-library/user-event` is missing, install it: `npm install -D @testing-library/user-event`.

- [ ] **Step 5: Commit**

```bash
git add src/features/customers/CustomerForm.tsx src/features/customers/CustomerForm.test.tsx src/pages/CustomerFormPage.tsx package.json package-lock.json
git commit -m "feat(crm): customer create/edit form"
```

---

## Task 8: Customer detail page + inline vehicle management

**Files:**
- Create: `src/features/customers/VehicleForm.tsx`, `src/pages/CustomerDetailPage.tsx`

- [ ] **Step 1: Create `src/features/customers/VehicleForm.tsx`:**

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { vehicleSchema, type VehicleFormValues, type VehiclePayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { Vehicle } from "./types";

type Props = {
  defaultValues?: Vehicle;
  submitting?: boolean;
  onSubmit: (payload: VehiclePayload) => void;
  onCancel: () => void;
};

export function VehicleForm({ defaultValues, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate_number: defaultValues?.plate_number ?? "",
      vin: defaultValues?.vin ?? "",
      model: defaultValues?.model ?? "",
      model_year: defaultValues?.model_year ?? "",
      color: defaultValues?.color ?? "",
      current_odometer: defaultValues?.current_odometer ?? "",
      hv_battery_state: defaultValues?.hv_battery_state ?? "",
      software_version: defaultValues?.software_version ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v as VehiclePayload))} className="space-y-4 border rounded-xl p-5 bg-gray-50/50">
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField label={t("vehicles.plate")} {...register("plate_number")} error={errors.plate_number?.message} />
        <TextField label={t("vehicles.vin")} {...register("vin")} error={errors.vin?.message} />
        <TextField label={t("vehicles.model")} {...register("model")} error={errors.model?.message} />
        <TextField label={t("vehicles.year")} inputMode="numeric" {...register("model_year")} error={errors.model_year?.message} />
        <TextField label={t("vehicles.color")} {...register("color")} error={errors.color?.message} />
        <TextField label={t("vehicles.odometer")} inputMode="numeric" {...register("current_odometer")} error={errors.current_odometer?.message} />
        <TextField label={t("vehicles.battery")} {...register("hv_battery_state")} error={errors.hv_battery_state?.message} />
        <TextField label={t("vehicles.software")} {...register("software_version")} error={errors.software_version?.message} />
      </div>
      <TextField label={t("vehicles.notes")} {...register("notes")} error={errors.notes?.message} />
      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>{t("actions.save")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/pages/CustomerDetailPage.tsx`:**

```tsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { VehicleForm } from "@/features/customers/VehicleForm";
import type { Vehicle } from "@/features/customers/types";
import {
  useCustomer, useDeleteCustomer,
  useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle,
} from "@/features/customers/hooks";

export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useCustomer(id);
  const deleteCustomer = useDeleteCustomer();
  const { data: vehicles } = useVehicles(id);
  const createVehicle = useCreateVehicle(id);
  const updateVehicle = useUpdateVehicle(id);
  const deleteVehicle = useDeleteVehicle(id);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <p className="opacity-70">{t("common.loading")}</p>;
  if (!customer) return <p className="opacity-70">{t("customers.empty")}</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link to="/customers" className="text-sm opacity-60 hover:opacity-100">← {t("actions.back")}</Link>
          <h2 className="text-2xl font-bold">{customer.name}</h2>
          <p className="opacity-70 text-sm">{customer.phone ?? ""} {customer.email ? `· ${customer.email}` : ""}</p>
          {customer.notes && <p className="opacity-80 text-sm pt-1">{customer.notes}</p>}
        </div>
        <div className="flex gap-2">
          <Link to={`/customers/${id}/edit`}><Button variant="ghost">{t("actions.edit")}</Button></Link>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t("actions.confirmDelete")))
                deleteCustomer.mutate(id, { onSuccess: () => navigate("/customers") });
            }}
          >
            {t("actions.delete")}
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("vehicles.title")}</h3>
          {!adding && <Button onClick={() => { setAdding(true); setEditingId(null); }}>{t("vehicles.addVehicle")}</Button>}
        </div>

        {adding && (
          <VehicleForm
            submitting={createVehicle.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(payload) => createVehicle.mutate(payload, { onSuccess: () => setAdding(false) })}
          />
        )}

        {!vehicles || vehicles.length === 0 ? (
          !adding && <p className="opacity-70">{t("vehicles.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {vehicles.map((v: Vehicle) => (
              <li key={v.id} className="border rounded-xl p-4">
                {editingId === v.id ? (
                  <VehicleForm
                    defaultValues={v}
                    submitting={updateVehicle.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(payload) =>
                      updateVehicle.mutate({ id: v.id, payload }, { onSuccess: () => setEditingId(null) })}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="font-medium">{v.model ?? "—"} {v.model_year ? `(${v.model_year})` : ""}</p>
                      <p className="text-sm opacity-70">
                        {v.plate_number ?? ""}{v.vin ? ` · ${v.vin}` : ""}
                        {v.current_odometer != null ? ` · ${v.current_odometer} km` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => { setEditingId(v.id); setAdding(false); }}>{t("actions.edit")}</Button>
                      <Button
                        variant="danger"
                        onClick={() => { if (confirm(t("actions.confirmDelete"))) deleteVehicle.mutate(v.id); }}
                      >
                        {t("actions.delete")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Build green** (`npm run build`, `npm test`). Commit:

```bash
git add src/features/customers/VehicleForm.tsx src/pages/CustomerDetailPage.tsx
git commit -m "feat(crm): customer detail page with inline vehicle management"
```

---

## Task 9: Wire routes + integration test

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/Customers.integration.test.tsx`

- [ ] **Step 1: Update `src/App.tsx`** to add the nested customer routes (replace the single `/customers` route with these four, keeping everything else):

```tsx
import { CustomerFormPage } from "@/pages/CustomerFormPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
// ...inside the AppLayout <Route> group, replace the customers line with:
<Route path="/customers" element={<CustomersPage />} />
<Route path="/customers/new" element={<CustomerFormPage />} />
<Route path="/customers/:id" element={<CustomerDetailPage />} />
<Route path="/customers/:id/edit" element={<CustomerFormPage />} />
```

(Keep `CustomersPage` import; add the two new imports. The catch-all `*` route stays last.)

- [ ] **Step 2: Create `src/pages/Customers.integration.test.tsx`** — render the customer routes with the `api` module mocked, navigate list → detail:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/customers/api", () => ({
  listCustomers: vi.fn(async () => [{ id: "c1", branch_id: "b", name: "Ahmad", phone: "079", email: null, notes: null, created_at: "", updated_at: "" }]),
  getCustomer: vi.fn(async () => ({ id: "c1", branch_id: "b", name: "Ahmad", phone: "079", email: null, notes: null, created_at: "", updated_at: "" })),
  listVehicles: vi.fn(async () => []),
}));

import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/customers"]}>
          <Routes>
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

describe("Customers flow", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("lists customers and navigates to detail", async () => {
    renderApp();
    const link = await screen.findByText("Ahmad");
    await userEvent.click(link);
    // Detail page heading shows the customer name + the Vehicles section
    expect(await screen.findByRole("heading", { name: "Ahmad" })).toBeInTheDocument();
    expect(screen.getByText("Vehicles")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the full suite + build.** Expected: all green.

Run: `npm test` then `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/Customers.integration.test.tsx
git commit -m "feat(crm): wire customer routes and add integration test"
```

---

## Self-Review (against the spec)

**Spec coverage (CRM portion of Phase 1):**
- CRM = customers + their vehicles, full service history hook → customers/vehicles CRUD delivered (Tasks 2–8); service history will attach in the Service Orders plan via `vehicle_id`/`customer_id`. ✓
- Customer has many vehicles → `listVehicles(customerId)`, vehicles carry `customer_id`. ✓
- Vehicle fields (VIN, plate, model, year, color, odometer, HV battery state, software version) → `vehicleSchema` + `VehicleForm`. ✓
- `branch_id` on inserts (multi-ready) → `getDefaultBranchId()` (Task 3). ✓
- Zod schema as persistence source-of-truth (project gotcha) → Task 2 note + schemas. ✓
- Bilingual EN/AR, RTL-safe, generous spacing → i18n keys (Task 1), logical/space-y classes, `space-y`/`grid gap` forms. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; commands list expected outcomes.

**Type consistency:** `Customer`/`Vehicle` (types.ts) ↔ DB columns (migration 0001); `CustomerPayload`/`VehiclePayload` (schema.ts) used by `api.ts`, `hooks.ts`, and the forms; hook names (`useCustomers`, `useCustomer`, `useCreateCustomer`, `useUpdateCustomer`, `useDeleteCustomer`, `useVehicles`, `useCreateVehicle`, `useUpdateVehicle`, `useDeleteVehicle`) match their call sites in pages; route paths (`/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`) match `Link`/`navigate` targets.

**Deferred (correctly out of this plan):** service history list on the vehicle (needs Service Orders), pagination (low volume), optimistic updates (invalidation is sufficient at this scale).

---

## Next Plans
- `2026-06-21-vw-ev-phase1-service-orders.md` (job card + intake/inspection; attaches to a vehicle)
- `2026-06-21-vw-ev-phase1-invoicing.md`
- `2026-06-21-vw-ev-phase1-dashboard.md`
```
