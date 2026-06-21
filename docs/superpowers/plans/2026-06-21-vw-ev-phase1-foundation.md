# VW EV Service Center — Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project skeleton — a runnable, authenticated, bilingual (EN/AR + RTL) Vite/React/Supabase app with the full Phase 1 database schema and the money-calculation core — ready for the CRM/Orders/Invoicing/Dashboard module plans to build on.

**Architecture:** Vite + React + TypeScript SPA. Supabase provides Postgres, Auth (single Admin role), and Storage. UI is Tailwind + Radix (via shadcn/ui) with a `DirectionProvider` that flips LTR↔RTL on the language toggle. Data access uses TanStack Query + the Supabase client. Pure money logic lives in a framework-free module with full unit-test coverage (the one part that must be numerically correct). This plan ends with a logged-in user seeing an empty app shell with five navigable (placeholder) module routes, against a fully-migrated database.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, Radix UI / shadcn-style components, react-i18next, react-router-dom v6, @tanstack/react-query, @supabase/supabase-js, react-hook-form + zod, Vitest + @testing-library/react.

---

## File Structure (created by this plan)

```
vw-service-center/
├─ .env.example                      # Supabase env var template
├─ index.html
├─ package.json
├─ vite.config.ts                    # Vite + Vitest config, @ alias
├─ tailwind.config.ts
├─ postcss.config.js
├─ tsconfig.json / tsconfig.node.json
├─ supabase/
│  └─ migrations/
│     └─ 0001_phase1_schema.sql      # all Phase 1 tables, enums, RLS, storage bucket
└─ src/
   ├─ main.tsx                       # app entry: providers (Query, Direction, Router, i18n)
   ├─ App.tsx                        # route table
   ├─ index.css                      # Tailwind layers
   ├─ lib/
   │  ├─ supabase.ts                 # Supabase client singleton
   │  └─ money.ts                    # pure money logic (tested)
   │  └─ money.test.ts
   ├─ i18n/
   │  ├─ index.ts                    # i18next init
   │  ├─ en.json                     # English strings
   │  └─ ar.json                     # Arabic strings
   ├─ providers/
   │  └─ DirectionProvider.tsx       # syncs <html dir/lang> + Radix DirectionProvider to language
   ├─ auth/
   │  ├─ AuthProvider.tsx            # Supabase session context
   │  ├─ useAuth.ts
   │  ├─ LoginPage.tsx
   │  └─ RequireAuth.tsx             # route guard
   ├─ components/
   │  ├─ AppLayout.tsx               # sidebar + outlet
   │  ├─ Sidebar.tsx                 # 5 nav links
   │  └─ LanguageToggle.tsx
   └─ pages/
      ├─ DashboardPage.tsx           # placeholder
      ├─ ServiceOrdersPage.tsx       # placeholder
      ├─ CustomersPage.tsx           # placeholder
      ├─ InvoicesPage.tsx            # placeholder
      └─ SettingsPage.tsx            # placeholder
```

---

## Task 1: Scaffold the Vite + React + TS project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx` (via scaffolder)

- [ ] **Step 1: Scaffold into the existing project folder**

Run from `C:\Users\moatasea\vw-service-center`:
```bash
npm create vite@latest . -- --template react-ts
```
When prompted that the directory is not empty, choose **"Ignore files and continue"** (our `docs/`, `.gitignore`, `supabase/` stay intact).

- [ ] **Step 2: Install base dependencies**

```bash
npm install
```

- [ ] **Step 3: Verify it runs**

Run: `npm run dev`
Expected: Vite serves on a local port and the default React page loads. Stop the server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS project"
```

---

## Task 2: Install and configure Tailwind CSS

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`
- Modify: `src/index.css`

- [ ] **Step 1: Install Tailwind toolchain**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure content globs** — replace `tailwind.config.js` contents (rename to `.ts` if you prefer; keep `.js` if init created it):

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 3: Replace `src/index.css`** with Tailwind layers:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light dark; }
body { margin: 0; }
```

- [ ] **Step 4: Smoke-test a utility class** — set `src/App.tsx` body to:

```tsx
function App() {
  return <h1 className="text-2xl font-bold p-6">Watheeq EV</h1>;
}
export default App;
```

Run `npm run dev`; confirm the heading is large/bold. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add and configure Tailwind CSS"
```

---

## Task 3: Configure the `@` path alias and Vitest

**Files:**
- Modify: `vite.config.ts`, `tsconfig.json`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Install test + alias tooling**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 2: Replace `vite.config.ts`:**

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 3: Create `src/test/setup.ts`:**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 4: Add the alias to `tsconfig.json`** under `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

- [ ] **Step 5: Add a test script to `package.json`** `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure @ alias and Vitest"
```

---

## Task 4: Money logic core (TDD)

This is the one numerically-critical module. JOD uses **3 decimal places**. Tests are written first and pin the behavior.

> 💡 **Learning contribution opportunity:** Step 1 (the tests) defines exactly how money must behave. During execution, the implementer may write Step 3 (`money.ts`) themselves against these tests before looking at the reference implementation — this is the highest-value 10 lines in the codebase.

**Files:**
- Test: `src/lib/money.test.ts`
- Create: `src/lib/money.ts`

- [ ] **Step 1: Write the failing tests** — `src/lib/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeLineTotal, computeInvoiceTotals, derivePaymentStatus } from "@/lib/money";

describe("computeLineTotal", () => {
  it("multiplies quantity by unit price with no discount", () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 12.5, discountType: "none", discountValue: 0 })).toBe(25);
  });
  it("subtracts a fixed amount discount", () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 100, discountType: "amount", discountValue: 15 })).toBe(85);
  });
  it("subtracts a percent discount", () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 200, discountType: "percent", discountValue: 10 })).toBe(180);
  });
  it("rounds to 3 decimals (JOD)", () => {
    expect(computeLineTotal({ quantity: 3, unitPrice: 0.3333, discountType: "none", discountValue: 0 })).toBe(1);
  });
  it("never returns a negative line total", () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 10, discountType: "amount", discountValue: 999 })).toBe(0);
  });
});

describe("computeInvoiceTotals", () => {
  it("sums gross, discounts, and net across lines", () => {
    const lines = [
      { quantity: 1, unitPrice: 100, discountType: "amount" as const, discountValue: 10 },
      { quantity: 2, unitPrice: 50, discountType: "percent" as const, discountValue: 10 },
    ];
    expect(computeInvoiceTotals(lines)).toEqual({ subtotal: 200, discountTotal: 20, total: 180 });
  });
});

describe("derivePaymentStatus", () => {
  it("is unpaid at zero", () => { expect(derivePaymentStatus(100, 0)).toBe("unpaid"); });
  it("is partial below total", () => { expect(derivePaymentStatus(100, 40)).toBe("partial"); });
  it("is paid at or above total", () => { expect(derivePaymentStatus(100, 100)).toBe("paid"); });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `money.ts` not found / exports undefined.

- [ ] **Step 3: Implement `src/lib/money.ts`:**

```ts
export type DiscountType = "none" | "amount" | "percent";
export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface LineInput {
  quantity: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
}

/** Round to 3 decimal places (JOD) avoiding binary float drift. */
const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

const lineGross = (l: LineInput): number => l.quantity * l.unitPrice;

const lineDiscount = (l: LineInput): number => {
  if (l.discountType === "amount") return l.discountValue;
  if (l.discountType === "percent") return lineGross(l) * (l.discountValue / 100);
  return 0;
};

export function computeLineTotal(line: LineInput): number {
  const net = lineGross(line) - lineDiscount(line);
  return round3(Math.max(0, net));
}

export function computeInvoiceTotals(lines: LineInput[]): {
  subtotal: number; discountTotal: number; total: number;
} {
  const subtotal = round3(lines.reduce((s, l) => s + lineGross(l), 0));
  const discountTotal = round3(lines.reduce((s, l) => s + lineDiscount(l), 0));
  const total = round3(Math.max(0, subtotal - discountTotal));
  return { subtotal, discountTotal, total };
}

export function derivePaymentStatus(total: number, paidSum: number): PaymentStatus {
  if (paidSum <= 0) return "unpaid";
  if (paidSum >= total) return "paid";
  return "partial";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all money tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat: money calculation core with tests"
```

---

## Task 5: Database schema migration

The complete Phase 1 schema. The user applies this SQL to their Supabase project (via the Supabase SQL editor or MCP `apply_migration`). Note: per project convention, frontend code must not select a new column until the migration confirming it has been applied.

**Files:**
- Create: `supabase/migrations/0001_phase1_schema.sql`

- [ ] **Step 1: Create `supabase/migrations/0001_phase1_schema.sql`:**

```sql
-- ===== Enums =====
create type order_status as enum (
  'appointment','intake','diagnosis','estimate','awaiting_approval',
  'in_progress','qc','ready','closed','cancelled'
);
create type line_type as enum ('service','part','fee');
create type discount_type as enum ('none','amount','percent');
create type payment_status as enum ('unpaid','partial','paid');
create type payment_method as enum ('cash','card','transfer');
create type media_type as enum ('photo','video');

-- ===== Branches (multi-ready; one row seeded) =====
create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
insert into branches (name) values ('Main Branch');

-- ===== Customers =====
create table customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Vehicles =====
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  customer_id uuid not null references customers(id) on delete cascade,
  vin text,
  plate_number text,
  model text,
  model_year int,
  color text,
  current_odometer int,
  hv_battery_state text,
  software_version text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Service orders (job cards) =====
create table service_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  vehicle_id uuid not null references vehicles(id),
  customer_id uuid not null references customers(id),
  order_number bigint generated always as identity,
  status order_status not null default 'intake',
  odometer_at_intake int,
  charge_percent int,
  hv_battery_state text,
  reported_concerns text,
  intake_notes text,
  approved_at timestamptz,
  approved_by text,
  closed_at timestamptz,
  next_service_due_date date,
  next_service_due_odometer int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Inspection media =====
create table inspection_media (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders(id) on delete cascade,
  media_type media_type not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- ===== Service order line items (shared by estimate + invoice) =====
create table service_order_lines (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders(id) on delete cascade,
  line_type line_type not null default 'service',
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount_type discount_type not null default 'none',
  discount_value numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ===== Invoices =====
create table invoices (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders(id),
  invoice_number bigint generated always as identity,
  currency text not null default 'JOD',
  subtotal numeric not null default 0,
  discount_total numeric not null default 0,
  total numeric not null default 0,
  payment_status payment_status not null default 'unpaid',
  issued_at timestamptz not null default now()
);

-- ===== Payments =====
create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null,
  method payment_method not null default 'cash',
  note text,
  paid_at timestamptz not null default now()
);

-- ===== updated_at trigger =====
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_customers_updated before update on customers
  for each row execute function set_updated_at();
create trigger trg_vehicles_updated before update on vehicles
  for each row execute function set_updated_at();
create trigger trg_orders_updated before update on service_orders
  for each row execute function set_updated_at();

-- ===== Row Level Security (Phase 1: any authenticated user has full access) =====
alter table branches enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table service_orders enable row level security;
alter table inspection_media enable row level security;
alter table service_order_lines enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'branches','customers','vehicles','service_orders','inspection_media',
    'service_order_lines','invoices','payments'
  ] loop
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true);', t
    );
  end loop;
end $$;

-- ===== Storage bucket for inspection media (private) =====
insert into storage.buckets (id, name, public) values ('inspection-media','inspection-media', false)
  on conflict (id) do nothing;

create policy "authenticated read media" on storage.objects for select to authenticated
  using (bucket_id = 'inspection-media');
create policy "authenticated write media" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-media');
```

- [ ] **Step 2: Apply the migration**

Apply the SQL via the Supabase dashboard SQL editor (or `apply_migration`). Verify in the Table Editor that all eight tables and the `inspection-media` bucket exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_phase1_schema.sql
git commit -m "feat: Phase 1 database schema migration"
```

---

## Task 6: Supabase client + environment

**Files:**
- Create: `.env.example`, `src/lib/supabase.ts`
- Create (local, untracked): `.env`

- [ ] **Step 1: Install the client**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create `.env.example`:**

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Create local `.env`** (not committed — gitignored) with the real values from Supabase → Project Settings → API.

- [ ] **Step 4: Create `src/lib/supabase.ts`:**

```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 5: Commit** (the `.env.example` only; `.env` is ignored)

```bash
git add .env.example src/lib/supabase.ts package.json package-lock.json
git commit -m "feat: Supabase client and env template"
```

---

## Task 7: i18n (EN/AR) with RTL direction

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/en.json`, `src/i18n/ar.json`, `src/providers/DirectionProvider.tsx`, `src/components/LanguageToggle.tsx`

- [ ] **Step 1: Install i18n + Radix direction**

```bash
npm install react-i18next i18next @radix-ui/react-direction
```

- [ ] **Step 2: Create `src/i18n/en.json`:**

```json
{
  "app": { "name": "Watheeq EV", "subtitle": "Service Center" },
  "nav": {
    "dashboard": "Dashboard",
    "orders": "Service Orders",
    "customers": "Customers & Vehicles",
    "invoices": "Invoices",
    "settings": "Settings"
  },
  "auth": { "login": "Log in", "email": "Email", "password": "Password", "signOut": "Sign out" },
  "common": { "language": "العربية" }
}
```

- [ ] **Step 3: Create `src/i18n/ar.json`:**

```json
{
  "app": { "name": "الوثيق للكهربائية", "subtitle": "مركز الخدمة" },
  "nav": {
    "dashboard": "لوحة التحكم",
    "orders": "أوامر الصيانة",
    "customers": "العملاء والمركبات",
    "invoices": "الفواتير",
    "settings": "الإعدادات"
  },
  "auth": { "login": "تسجيل الدخول", "email": "البريد الإلكتروني", "password": "كلمة المرور", "signOut": "تسجيل الخروج" },
  "common": { "language": "English" }
}
```

- [ ] **Step 4: Create `src/i18n/index.ts`:**

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ar from "./ar.json";

const saved = localStorage.getItem("lang") ?? "en";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: saved,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 5: Create `src/providers/DirectionProvider.tsx`** — keeps `<html>` dir/lang and Radix direction in sync with the active language:

```tsx
import { DirectionProvider as RadixDirection } from "@radix-ui/react-direction";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const dir = i18n.language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = dir;
  }, [i18n.language, dir]);

  return <RadixDirection dir={dir}>{children}</RadixDirection>;
}
```

- [ ] **Step 6: Create `src/components/LanguageToggle.tsx`:**

```tsx
import { useTranslation } from "react-i18next";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const toggle = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };
  return (
    <button onClick={toggle} className="text-xs border rounded-full px-3 py-1 opacity-80 hover:opacity-100">
      {t("common.language")}
    </button>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/i18n src/providers/DirectionProvider.tsx src/components/LanguageToggle.tsx package.json package-lock.json
git commit -m "feat: i18n (EN/AR) with RTL direction provider"
```

---

## Task 8: Auth provider, login page, and route guard

**Files:**
- Create: `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/auth/RequireAuth.tsx`, `src/auth/LoginPage.tsx`

- [ ] **Step 1: Create `src/auth/AuthProvider.tsx`:**

```tsx
import { createContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const AuthContext = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 2: Create `src/auth/useAuth.ts`:**

```ts
import { useContext } from "react";
import { AuthContext } from "./AuthProvider";

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 3: Create `src/auth/RequireAuth.tsx`:**

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-6">…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

- [ ] **Step 4: Create `src/auth/LoginPage.tsx`:**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { LanguageToggle } from "@/components/LanguageToggle";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border rounded-2xl p-8">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{t("app.name")}</h1>
          <LanguageToggle />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">{t("auth.email")}</label>
          <input className="w-full border rounded-lg px-3 py-2" type="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">{t("auth.password")}</label>
          <input className="w-full border rounded-lg px-3 py-2" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-lg bg-blue-600 text-white py-2" type="submit">
          {t("auth.login")}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create the admin user**

In the Supabase dashboard → Authentication → Users → Add user, create the Admin account (email + password). This is the single Phase 1 login.

- [ ] **Step 6: Commit**

```bash
git add src/auth
git commit -m "feat: Supabase auth provider, login page, route guard"
```

---

## Task 9: App layout shell + placeholder pages

**Files:**
- Create: `src/components/AppLayout.tsx`, `src/components/Sidebar.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/ServiceOrdersPage.tsx`, `src/pages/CustomersPage.tsx`, `src/pages/InvoicesPage.tsx`, `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create `src/components/Sidebar.tsx`:**

```tsx
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const items = [
  { to: "/", key: "dashboard", icon: "📊", end: true },
  { to: "/orders", key: "orders", icon: "🔧", end: false },
  { to: "/customers", key: "customers", icon: "👥", end: false },
  { to: "/invoices", key: "invoices", icon: "🧾", end: false },
  { to: "/settings", key: "settings", icon: "⚙️", end: false },
] as const;

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-col gap-1 p-3 w-52 border-e min-h-screen">
      <div className="px-2 py-3">
        <div className="font-extrabold">⚡ {t("app.name")}</div>
        <div className="text-xs opacity-60">{t("app.subtitle")}</div>
      </div>
      {items.map((it) => (
        <NavLink key={it.key} to={it.to} end={it.end}
          className={({ isActive }) =>
            `px-3 py-2 rounded-lg text-sm ${isActive ? "bg-blue-100 text-blue-700 font-semibold" : "opacity-80 hover:opacity-100"}`}>
          {it.icon} {t(`nav.${it.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create `src/components/AppLayout.tsx`:**

```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { LanguageToggle } from "./LanguageToggle";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";

export function AppLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="flex justify-end items-center gap-3 p-3 border-b">
          <LanguageToggle />
          <button className="text-xs opacity-70 hover:opacity-100" onClick={() => supabase.auth.signOut()}>
            {t("auth.signOut")}
          </button>
        </header>
        <main className="p-6"><Outlet /></main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the five placeholder pages** — each file follows this shape (substitute Name/title):

`src/pages/DashboardPage.tsx`:
```tsx
import { useTranslation } from "react-i18next";
export function DashboardPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.dashboard")}</h2>;
}
```

`src/pages/ServiceOrdersPage.tsx`:
```tsx
import { useTranslation } from "react-i18next";
export function ServiceOrdersPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.orders")}</h2>;
}
```

`src/pages/CustomersPage.tsx`:
```tsx
import { useTranslation } from "react-i18next";
export function CustomersPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.customers")}</h2>;
}
```

`src/pages/InvoicesPage.tsx`:
```tsx
import { useTranslation } from "react-i18next";
export function InvoicesPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.invoices")}</h2>;
}
```

`src/pages/SettingsPage.tsx`:
```tsx
import { useTranslation } from "react-i18next";
export function SettingsPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.settings")}</h2>;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components src/pages
git commit -m "feat: app layout shell and placeholder module pages"
```

---

## Task 10: Wire providers, routes, and entry point

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Install router + query**

```bash
npm install react-router-dom @tanstack/react-query
```

- [ ] **Step 2: Replace `src/App.tsx`** with the route table:

```tsx
import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "@/auth/RequireAuth";
import { LoginPage } from "@/auth/LoginPage";
import { AppLayout } from "@/components/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { ServiceOrdersPage } from "@/pages/ServiceOrdersPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<ServiceOrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 3: Replace `src/main.tsx`** to mount all providers:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { DirectionProvider } from "@/providers/DirectionProvider";
import { AuthProvider } from "@/auth/AuthProvider";
import App from "@/App";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <DirectionProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </DirectionProvider>
    </I18nextProvider>
  </React.StrictMode>
);
```

- [ ] **Step 4: Run the app end-to-end**

Run: `npm run dev`
Expected: visiting `/` redirects to `/login`; logging in with the admin user shows the app shell with the five-item sidebar; clicking each nav item swaps the page title; the language toggle flips the whole layout between English (LTR) and Arabic (RTL). Stop the server.

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: PASS — money tests still green.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/main.tsx package.json package-lock.json
git commit -m "feat: wire providers, routes, and app entry"
```

---

## Self-Review (against the spec)

**Spec coverage (Phase 1 foundation portions):**
- Stack (Vite/React/TS/Supabase/Tailwind/Radix) → Tasks 1–3, 6, 7, 10 ✓
- English-default + Arabic RTL toggle via DirectionProvider → Task 7 ✓
- `branch_id` multi-ready + single seeded branch → Task 5 ✓
- Single Admin auth role, RLS → Tasks 5, 8 ✓
- JOD 3-decimal money logic, per-line discount, payment-status derivation → Task 4 ✓
- Full data model (8 tables, enums, shared lines, invoices/payments, media) → Task 5 ✓
- Private Storage bucket for inspection media → Task 5 ✓
- Five modules as navigable shell → Tasks 9, 10 ✓
- Testing: unit tests for money logic → Task 4 ✓ (module smoke paths come with their feature plans)

**Deferred to later module plans (correctly out of this plan):** CRM forms (Plan 2), order/intake/media-upload UI (Plan 3), invoice generation UI + payment recording (Plan 4), dashboard KPIs/board (Plan 5). The schema and money core they all depend on are delivered here.

**Placeholder scan:** No TBD/TODO; every code step contains complete code; every command step states expected output.

**Type consistency:** `LineInput`/`DiscountType`/`PaymentStatus` (Task 4) match the enum names in the migration (Task 5: `discount_type`, `payment_status`). Route paths in `Sidebar` (Task 9) match the route table in `App.tsx` (Task 10). Translation keys in `en.json`/`ar.json` (Task 7) match `t("nav.*")`/`t("auth.*")` usages (Tasks 8–10).

---

## Next Plans
- `2026-06-21-vw-ev-phase1-customers-vehicles.md`
- `2026-06-21-vw-ev-phase1-service-orders.md`
- `2026-06-21-vw-ev-phase1-invoicing.md`
- `2026-06-21-vw-ev-phase1-dashboard.md`
