# Customer Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A read-only customer portal — customer logs in with phone + 6-digit PIN and sees only their own vehicles, service history, line items, invoices, and inspection photos — built on a rewritten per-customer RLS security model, in the same app under `/portal/*`.

**Architecture:** Phone+PIN maps to a deterministic synthetic email; `signInWithPassword` does auth. A role resolver (`useRole`) decides admin vs customer from `customers.auth_user_id`; route groups are gated by a `RequireRole` guard (admin → `/login`/admin app, customer → `/portal/login`/portal). RLS is rewritten so customers read only their own rows; the existing data-layer queries return scoped data automatically under a customer session. Admin provisions customer logins client-side via a throwaway Supabase client (`signUp` without clobbering the admin session) + linking `auth_user_id`.

**Tech Stack:** existing (React/TS/Supabase/Tailwind/i18n/Query/Router/react-hook-form/zod/Vitest). No new deps.

## Global Constraints
- **Login:** phone + 6-digit PIN only (no SMS, no real email). Synthetic email domain: `@portal.idstore`.
- **Portal is READ-ONLY** — no customer writes; all writes remain admin-only via RLS.
- **RLS:** every table SELECT = `is_admin() OR owned-by current_customer_id()`; writes = `is_admin()` only.
- **Bilingual EN/AR with RTL**, parity test must stay green; money = JOD `toFixed(3)`; logical Tailwind classes (no hardcoded left/right).
- **Strict TS** (`verbatimModuleSyntax`), zod v4 (`ctx.addIssue("msg")` string shorthand is fine).
- **Deploy ordering:** the app's role query reads `customers.auth_user_id`; migration `0003` MUST be applied to the DB before the portal code runs against it (tests are mocked, so they pass without it).

---

## File Structure
```
supabase/migrations/
└─ 0003_customer_portal_rls.sql        # NEW: auth link, admin_users, helpers, RLS rewrite
src/
├─ lib/
│  └─ phone.ts                          # NEW: phoneToEmail (pure, tested)
│  └─ phone.test.ts
├─ features/customers/types.ts          # MODIFY: add auth_user_id to Customer
├─ auth/
│  ├─ useRole.ts                        # NEW: resolve admin|customer + customerId
│  ├─ RequireRole.tsx                   # NEW: role-gated route guard
│  └─ RequireRole.test.tsx
├─ features/portal/
│  ├─ api.ts                            # NEW: provisionPortalLogin, changePin
│  ├─ hooks.ts                          # NEW: useProvisionPortalLogin
│  ├─ PortalAccessPanel.tsx             # NEW: admin "Portal access" panel
│  ├─ PortalLayout.tsx                  # NEW: customer shell
│  └─ PortalLoginPage.tsx               # NEW: phone + PIN
├─ pages/portal/
│  ├─ PortalHomePage.tsx                # NEW: my vehicles
│  ├─ PortalVehiclePage.tsx             # NEW: vehicle + service history
│  ├─ PortalOrderPage.tsx               # NEW: read-only job card
│  ├─ PortalInvoicesPage.tsx            # NEW: my invoices
│  └─ PortalInvoicePage.tsx             # NEW: read-only invoice
├─ pages/CustomerDetailPage.tsx         # MODIFY: mount PortalAccessPanel
├─ App.tsx                              # MODIFY: role-gated route groups + portal routes
└─ i18n/{en,ar}.json                    # MODIFY: portal.* strings
```

---

## Task 1: Migration `0003` — auth link, admin roles, RLS rewrite

**Files:** Create `supabase/migrations/0003_customer_portal_rls.sql`.

This is SQL the USER applies (authorize prod write, like `0001`/`0002`); the engineer only writes the file. After applying, the user inserts their admin id into `admin_users`.

- [ ] **Step 1: Create `supabase/migrations/0003_customer_portal_rls.sql`:**
```sql
-- ===== Customer Portal: auth link, admin roles, per-customer RLS =====

-- 1) Customer <-> auth user link
alter table customers add column auth_user_id uuid unique references auth.users(id) on delete set null;
create index idx_customers_auth_user_id on customers(auth_user_id);

-- 2) Admin allowlist
create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;
create policy "admin_users readable by admins" on admin_users for select to authenticated
  using (exists (select 1 from admin_users a where a.user_id = auth.uid()));

-- 3) Helper functions (security definer; bypass RLS for the role checks)
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
create or replace function public.current_customer_id() returns uuid
  language sql stable security definer set search_path = '' as $$
  select id from public.customers where auth_user_id = auth.uid();
$$;

-- 4) Drop the Phase-1 blanket policies
drop policy "authenticated full access" on branches;
drop policy "authenticated full access" on customers;
drop policy "authenticated full access" on vehicles;
drop policy "authenticated full access" on service_orders;
drop policy "authenticated full access" on inspection_media;
drop policy "authenticated full access" on service_order_lines;
drop policy "authenticated full access" on invoices;
drop policy "authenticated full access" on payments;

-- 5) New policies.
-- Pattern per table: a SELECT policy (admin OR owner) + an ALL policy (admin-only).
-- Because permissive policies OR together, SELECT = (admin OR owner) and writes = admin-only.

-- branches: any authenticated can read (names); admin writes
create policy "branches select" on branches for select to authenticated using (true);
create policy "branches admin" on branches for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- customers
create policy "customers select" on customers for select to authenticated
  using (public.is_admin() or id = public.current_customer_id());
create policy "customers admin" on customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- vehicles
create policy "vehicles select" on vehicles for select to authenticated
  using (public.is_admin() or customer_id = public.current_customer_id());
create policy "vehicles admin" on vehicles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- service_orders
create policy "service_orders select" on service_orders for select to authenticated
  using (public.is_admin() or customer_id = public.current_customer_id());
create policy "service_orders admin" on service_orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- service_order_lines (via the order)
create policy "service_order_lines select" on service_order_lines for select to authenticated
  using (public.is_admin() or exists (
    select 1 from service_orders o where o.id = service_order_id and o.customer_id = public.current_customer_id()));
create policy "service_order_lines admin" on service_order_lines for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- inspection_media (via the order)
create policy "inspection_media select" on inspection_media for select to authenticated
  using (public.is_admin() or exists (
    select 1 from service_orders o where o.id = service_order_id and o.customer_id = public.current_customer_id()));
create policy "inspection_media admin" on inspection_media for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- invoices (via the order)
create policy "invoices select" on invoices for select to authenticated
  using (public.is_admin() or exists (
    select 1 from service_orders o where o.id = service_order_id and o.customer_id = public.current_customer_id()));
create policy "invoices admin" on invoices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payments (via invoice -> order)
create policy "payments select" on payments for select to authenticated
  using (public.is_admin() or exists (
    select 1 from invoices inv join service_orders o on o.id = inv.service_order_id
    where inv.id = invoice_id and o.customer_id = public.current_customer_id()));
create policy "payments admin" on payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2:** Eyeball the SQL (balanced parens, every `drop policy` name matches the `0001` name `"authenticated full access"`, helper functions `security definer`+`search_path=''`). Cannot run it here.

- [ ] **Step 3: Commit** (file only; application is user-side):
```bash
git add supabase/migrations/0003_customer_portal_rls.sql
git commit -m "feat(portal): migration for auth link, admin roles, per-customer RLS"
```

> **APPLY NOTE (user, after merge or when ready):** apply `0003`, then `insert into admin_users (user_id) values ('<your-admin-auth-uid>');` — without seeding the admin, the new policies lock the admin out.

---

## Task 2: `phoneToEmail` util (TDD) + Customer type

**Files:** Create `src/lib/phone.ts`, `src/lib/phone.test.ts`; Modify `src/features/customers/types.ts`.

**Interfaces:**
- Produces: `phoneToEmail(phone: string): string` — deterministic synthetic email; `normalizePhone(phone: string): string` — canonical digits.

- [ ] **Step 1: Write `src/lib/phone.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { normalizePhone, phoneToEmail } from "@/lib/phone";

describe("normalizePhone", () => {
  it("strips spaces, dashes, parens and leading +", () => {
    expect(normalizePhone("+962 79-000 0000")).toBe("962790000000");
    expect(normalizePhone("(0790) 000-000")).toBe("0790000000");
  });
});

describe("phoneToEmail", () => {
  it("maps the same number to the same synthetic email regardless of formatting", () => {
    const a = phoneToEmail("+962 790000000");
    const b = phoneToEmail("962790000000");
    expect(a).toBe(b);
    expect(a).toBe("962790000000@portal.idstore");
  });
  it("throws on a number with no digits", () => {
    expect(() => phoneToEmail("   ")).toThrow();
  });
});
```

- [ ] **Step 2:** `npm test` → FAIL.

- [ ] **Step 3: Create `src/lib/phone.ts`:**
```ts
/** Canonical digits-only form of a phone number (drops spaces, dashes, parens, leading +). */
export function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/[^\d]/g, "");
}

/** Deterministic synthetic email used as the Supabase auth identifier for a phone login. */
export function phoneToEmail(phone: string): string {
  const digits = normalizePhone(phone);
  if (!digits) throw new Error("Phone number has no digits");
  return `${digits}@portal.idstore`;
}
```
> NOTE: normalization is digits-only; it does NOT add/remove a country code. The admin must store phone numbers consistently (a customer saved as `0790…` and logging in as `+96279…` would mismatch). Document this; a country-code-canonicalizing version is a follow-up.

- [ ] **Step 4:** `npm test` → PASS.

- [ ] **Step 5: Modify `src/features/customers/types.ts`** — add to the `Customer` interface: `auth_user_id: string | null;` (after `notes`). It's a real column post-`0003`; existing admin code ignores it.

- [ ] **Step 6:** `npm run build` clean. Commit:
```bash
git add src/lib/phone.ts src/lib/phone.test.ts src/features/customers/types.ts
git commit -m "feat(portal): phoneToEmail util and Customer.auth_user_id"
```

---

## Task 3: Role resolver + RequireRole guard

**Files:** Create `src/auth/useRole.ts`, `src/auth/RequireRole.tsx`, `src/auth/RequireRole.test.tsx`.

**Interfaces:**
- Consumes: `useAuth()` → `{ session, loading }`; `supabase`.
- Produces: `useRole(): { loading: boolean; role: "admin" | "customer" | undefined; customerId: string | null }`; `RequireRole({ role, loginPath }: { role: "admin"|"customer"; loginPath: string })` route element.

- [ ] **Step 1: Create `src/auth/useRole.ts`:**
```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export function useRole(): { loading: boolean; role: "admin" | "customer" | undefined; customerId: string | null } {
  const { session, loading } = useAuth();
  const uid = session?.user?.id;
  const q = useQuery({
    queryKey: ["role", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id").eq("auth_user_id", uid!).maybeSingle();
      if (error) throw error;
      return data ? { role: "customer" as const, customerId: data.id as string } : { role: "admin" as const, customerId: null };
    },
  });
  return {
    loading: loading || (!!uid && q.isLoading),
    role: q.data?.role,
    customerId: q.data?.customerId ?? null,
  };
}
```

- [ ] **Step 2: Write `src/auth/RequireRole.test.tsx`** (mock `useAuth` + `useRole`):
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/auth/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/auth/useRole", () => ({ useRole: vi.fn() }));
import { useAuth } from "@/auth/useAuth";
import { useRole } from "@/auth/useRole";
import { RequireRole } from "@/auth/RequireRole";

const setup = (initial: string) =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route element={<RequireRole role="customer" loginPath="/portal/login" />}>
          <Route path="/portal" element={<div>PORTAL HOME</div>} />
        </Route>
        <Route path="/portal/login" element={<div>PORTAL LOGIN</div>} />
        <Route path="/" element={<div>ADMIN HOME</div>} />
      </Routes>
    </MemoryRouter>
  );

const mockAuth = (v: unknown) => (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v);
const mockRole = (v: unknown) => (useRole as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v);

describe("RequireRole", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("redirects to the login path when unauthenticated", () => {
    mockAuth({ session: null, loading: false });
    mockRole({ loading: false, role: undefined, customerId: null });
    setup("/portal");
    expect(screen.getByText("PORTAL LOGIN")).toBeInTheDocument();
  });

  it("renders the outlet for a matching role", () => {
    mockAuth({ session: { user: { id: "u" } }, loading: false });
    mockRole({ loading: false, role: "customer", customerId: "c1" });
    setup("/portal");
    expect(screen.getByText("PORTAL HOME")).toBeInTheDocument();
  });

  it("redirects a mismatched role to its own home (admin → /)", () => {
    mockAuth({ session: { user: { id: "u" } }, loading: false });
    mockRole({ loading: false, role: "admin", customerId: null });
    setup("/portal");
    expect(screen.getByText("ADMIN HOME")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3:** `npm test` → FAIL.

- [ ] **Step 4: Create `src/auth/RequireRole.tsx`:**
```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./useAuth";
import { useRole } from "./useRole";

export function RequireRole({ role, loginPath }: { role: "admin" | "customer"; loginPath: string }) {
  const { t } = useTranslation();
  const { session, loading: authLoading } = useAuth();
  const { role: actual, loading: roleLoading } = useRole();

  if (authLoading) return <div className="p-6 text-sm opacity-70">{t("common.loading")}</div>;
  if (!session) return <Navigate to={loginPath} replace />;
  if (roleLoading) return <div className="p-6 text-sm opacity-70">{t("common.loading")}</div>;
  if (actual && actual !== role) return <Navigate to={actual === "admin" ? "/" : "/portal"} replace />;
  if (!actual) return <div className="p-6 text-sm opacity-70">{t("common.loading")}</div>;
  return <Outlet />;
}
```

- [ ] **Step 5:** `npm test` → PASS. `npm run build` clean. Commit:
```bash
git add src/auth/useRole.ts src/auth/RequireRole.tsx src/auth/RequireRole.test.tsx
git commit -m "feat(portal): role resolver and RequireRole guard"
```

---

## Task 4: Portal i18n + login provisioning helper (no UI yet)

**Files:** Modify `src/i18n/{en,ar}.json`; Create `src/features/portal/api.ts`.

- [ ] **Step 1: Add `portal` block to `en.json`** (merge, keep existing):
```json
"portal": {
  "title": "My Portal", "login": "Sign in", "phone": "Phone number", "pin": "PIN",
  "invalidLogin": "Invalid phone number or PIN", "signOut": "Sign out",
  "myVehicles": "My vehicles", "noVehicles": "No vehicles on file", "serviceHistory": "Service history",
  "noOrders": "No service orders yet", "order": "Order", "invoice": "Invoice", "invoices": "Invoices",
  "noInvoices": "No invoices yet", "intake": "Intake", "items": "Items", "photos": "Photos",
  "access": "Portal access", "createLogin": "Create portal login", "linked": "Portal login active",
  "notLinked": "No portal login yet", "setPin": "Set a 6-digit PIN", "pinShown": "Share this PIN with the customer:",
  "needPhone": "Add a phone number to this customer first"
}
```
- [ ] **Step 2: Add the SAME keys (Arabic) to `ar.json`:**
```json
"portal": {
  "title": "بوابتي", "login": "تسجيل الدخول", "phone": "رقم الهاتف", "pin": "الرمز السري",
  "invalidLogin": "رقم الهاتف أو الرمز السري غير صحيح", "signOut": "تسجيل الخروج",
  "myVehicles": "مركباتي", "noVehicles": "لا توجد مركبات", "serviceHistory": "سجل الصيانة",
  "noOrders": "لا توجد أوامر صيانة بعد", "order": "الأمر", "invoice": "الفاتورة", "invoices": "الفواتير",
  "noInvoices": "لا توجد فواتير بعد", "intake": "الاستلام", "items": "البنود", "photos": "الصور",
  "access": "الدخول إلى البوابة", "createLogin": "إنشاء دخول للبوابة", "linked": "دخول البوابة مُفعّل",
  "notLinked": "لا يوجد دخول للبوابة بعد", "setPin": "اختر رمزًا من 6 أرقام", "pinShown": "شارك هذا الرمز مع العميل:",
  "needPhone": "أضِف رقم هاتف لهذا العميل أولًا"
}
```

- [ ] **Step 3: Create `src/features/portal/api.ts`:**
```ts
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { phoneToEmail } from "@/lib/phone";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Create a portal auth account for a customer and link it. Uses a throwaway client
 * (persistSession:false) so the admin's session is NOT replaced by the new signUp.
 * Requires "Confirm email" OFF in Supabase Auth. Returns nothing; throws on failure.
 */
export async function provisionPortalLogin(customerId: string, phone: string, pin: string): Promise<void> {
  const email = phoneToEmail(phone);
  const tmp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await tmp.auth.signUp({ email, password: pin });
  if (error) throw error;
  const newUserId = data.user?.id;
  if (!newUserId) throw new Error("Sign-up did not return a user");
  const { error: linkError } = await supabase.from("customers").update({ auth_user_id: newUserId }).eq("id", customerId);
  if (linkError) throw linkError;
}

/** Change the CURRENT (logged-in customer's) PIN. */
export async function changePin(newPin: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPin });
  if (error) throw error;
}
```

- [ ] **Step 4:** `npm test` (parity green) + `npm run build` clean. Commit:
```bash
git add src/i18n/en.json src/i18n/ar.json src/features/portal/api.ts
git commit -m "feat(portal): i18n strings and login provisioning api"
```

---

## Task 5: Admin "Portal access" panel

**Files:** Create `src/features/portal/hooks.ts`, `src/features/portal/PortalAccessPanel.tsx`, `src/features/portal/PortalAccessPanel.test.tsx`; Modify `src/pages/CustomerDetailPage.tsx`.

**Interfaces:**
- Consumes: `provisionPortalLogin(customerId, phone, pin)`; `Customer` (now has `auth_user_id`, `phone`).
- Produces: `<PortalAccessPanel customer={Customer} />`.

- [ ] **Step 1: Create `src/features/portal/hooks.ts`:**
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { provisionPortalLogin } from "./api";

export function useProvisionPortalLogin(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, pin }: { phone: string; pin: string }) => provisionPortalLogin(customerId, phone, pin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer", customerId] }),
  });
}
```

- [ ] **Step 2: Create `src/features/portal/PortalAccessPanel.tsx`** — shows linked status; if not linked and the customer has a phone, a "Create portal login" flow: a 6-digit PIN `TextField` (default to a generated 6-digit string) + a Create `Button` calling `useProvisionPortalLogin`; on success show the PIN via `pinShown` and a toast; if the customer has no phone, show the `needPhone` notice instead. Use `useToast` on error. Full code:
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Customer } from "@/features/customers/types";
import { useProvisionPortalLogin } from "./hooks";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function genPin(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

export function PortalAccessPanel({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const toast = useToast();
  const provision = useProvisionPortalLogin(customer.id);
  const [pin, setPin] = useState(genPin());
  const [created, setCreated] = useState(false);

  if (customer.auth_user_id) {
    return (
      <section className="border rounded-xl p-4 space-y-1">
        <h3 className="font-semibold">{t("portal.access")}</h3>
        <p className="text-sm text-green-700">{t("portal.linked")}</p>
      </section>
    );
  }
  if (!customer.phone) {
    return (
      <section className="border rounded-xl p-4 space-y-1">
        <h3 className="font-semibold">{t("portal.access")}</h3>
        <p className="text-sm opacity-70">{t("portal.needPhone")}</p>
      </section>
    );
  }
  return (
    <section className="border rounded-xl p-4 space-y-3 max-w-md">
      <h3 className="font-semibold">{t("portal.access")}</h3>
      <p className="text-sm opacity-70">{t("portal.notLinked")}</p>
      {created ? (
        <p className="text-sm">{t("portal.pinShown")} <strong className="text-lg tracking-widest">{pin}</strong></p>
      ) : (
        <>
          <TextField label={t("portal.setPin")} inputMode="numeric" value={pin}
            onChange={(e) => setPin(e.target.value)} />
          <Button
            disabled={provision.isPending || pin.length !== 6}
            onClick={() =>
              provision.mutate({ phone: customer.phone!, pin }, {
                onSuccess: () => setCreated(true),
                onError: () => toast.show(t("errors.saveFailed")),
              })
            }
          >
            {t("portal.createLogin")}
          </Button>
        </>
      )}
    </section>
  );
}
```
> NOTE: `Math.random` is fine in app runtime (only workflow scripts forbid it).

- [ ] **Step 3: Mount it** in `src/pages/CustomerDetailPage.tsx` — import `PortalAccessPanel` and render `<PortalAccessPanel customer={customer} />` after the vehicles section (only when `customer` is loaded).

- [ ] **Step 4: Create `src/features/portal/PortalAccessPanel.test.tsx`** — mock `@/features/portal/hooks` (`useProvisionPortalLogin` → `{ mutate: vi.fn(), isPending:false }`) and `@/components/ui/Toast`. Three tests: (a) linked customer (`auth_user_id` set) → shows `portal.linked`; (b) no phone → shows `portal.needPhone`; (c) unlinked w/ phone → shows the PIN field + Create button. Wrap in I18nextProvider; reset i18n "en".

- [ ] **Step 5:** `npm test` + `npm run build`. Commit:
```bash
git add src/features/portal/hooks.ts src/features/portal/PortalAccessPanel.tsx src/features/portal/PortalAccessPanel.test.tsx src/pages/CustomerDetailPage.tsx
git commit -m "feat(portal): admin portal-access panel"
```

---

## Task 6: Portal login page + portal layout

**Files:** Create `src/features/portal/PortalLoginPage.tsx`, `src/features/portal/PortalLayout.tsx`, `src/features/portal/PortalLoginPage.test.tsx`.

**Interfaces:** Produces `<PortalLoginPage/>`, `<PortalLayout/>` (renders header + `<Outlet/>`).

- [ ] **Step 1: Create `src/features/portal/PortalLoginPage.tsx`** — phone + PIN form; on submit `signInWithPassword({ email: phoneToEmail(phone), password: pin })`; on error show `portal.invalidLogin`; on success `navigate("/portal", { replace:true })`. Reuse `TextField`, `Button`, `LanguageToggle`. Full code:
```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { phoneToEmail } from "@/lib/phone";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { LanguageToggle } from "@/components/LanguageToggle";

export function PortalLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    let email: string;
    try { email = phoneToEmail(phone); }
    catch { setSubmitting(false); setError(t("portal.invalidLogin")); return; }
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pin });
    setSubmitting(false);
    if (authErr) setError(t("portal.invalidLogin"));
    else void navigate("/portal", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border rounded-2xl p-8">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{t("portal.title")}</h1>
          <LanguageToggle />
        </div>
        <TextField label={t("portal.phone")} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextField label={t("portal.pin")} inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting} className="w-full">{t("portal.login")}</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/features/portal/PortalLayout.tsx`:**
```tsx
import { Outlet, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/auth/useAuth";

export function PortalLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-3 p-4 border-b">
        <Link to="/portal" className="font-extrabold">⚡ {t("portal.title")}</Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <button type="button" className="text-xs opacity-70 hover:opacity-100" onClick={() => void signOut()}>
            {t("portal.signOut")}
          </button>
        </div>
      </header>
      <main className="p-4 sm:p-6 max-w-3xl mx-auto"><Outlet /></main>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/features/portal/PortalLoginPage.test.tsx`** — mock `@/lib/supabase` (`supabase.auth.signInWithPassword`); render in MemoryRouter + I18nextProvider; assert the phone + PIN fields + sign-in button render (English labels); a failed sign-in (mock returns `{ error: {...} }`) shows `Invalid phone number or PIN`. Use userEvent + findByText.

- [ ] **Step 4:** `npm test` + `npm run build`. Commit:
```bash
git add src/features/portal/PortalLoginPage.tsx src/features/portal/PortalLayout.tsx src/features/portal/PortalLoginPage.test.tsx
git commit -m "feat(portal): portal login page and layout"
```

---

## Task 7: Portal read-only pages (reuse existing data layer)

**Files:** Create `src/pages/portal/PortalHomePage.tsx`, `PortalVehiclePage.tsx`, `PortalOrderPage.tsx`, `PortalInvoicesPage.tsx`, `PortalInvoicePage.tsx`, and `src/pages/portal/PortalHomePage.test.tsx`.

**Interfaces / reuse:** Under a customer session, RLS scopes rows, so reuse existing api/hooks:
- vehicles: `useCustomer`/`listVehicles` — but the customer needs THEIR vehicles. Use a new thin hook `useMyVehicles()` calling `supabase.from("vehicles").select("*").order("created_at",{ascending:false})` (RLS → only mine). Put it in `src/pages/portal/portalData.ts` (or reuse `@/features/customers` `listVehicles` is per-customerId; here we want "all visible = mine", so a dedicated `listMyVehicles` is clearest). 
- orders for a vehicle: `supabase.from("service_orders").select("*").eq("vehicle_id", vehicleId)` (RLS-safe).
- order detail / lines / media: reuse `@/features/orders/api` `getOrder`, `listLines`, `listMedia`, `signedMediaUrl` (all RLS-scoped).
- invoices / payments: reuse `@/features/invoices/api` `listInvoices`, `getInvoice`, `listPayments`.

- [ ] **Step 1: Create `src/pages/portal/portalData.ts`** (thin RLS-scoped reads + hooks):
```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/features/customers/types";
import type { ServiceOrder } from "@/features/orders/types";

export function useMyVehicles() {
  return useQuery({
    queryKey: ["my-vehicles"],
    queryFn: async (): Promise<Vehicle[]> => {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vehicle[];
    },
  });
}
export function useVehicleOrders(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ["my-vehicle-orders", vehicleId],
    enabled: !!vehicleId,
    queryFn: async (): Promise<ServiceOrder[]> => {
      const { data, error } = await supabase.from("service_orders").select("*")
        .eq("vehicle_id", vehicleId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceOrder[];
    },
  });
}
```

- [ ] **Step 2: Create the 5 pages.** They mirror existing read-only pages closely — reuse `OrderStatusBadge`, `InvoiceStatusBadge`, `statusLabel`, `sumPayments`, `computeOrderTotals`, `signedMediaUrl`, money `toFixed(3)`, i18n. Build them as read-only (no mutations, no edit/delete):
  - **PortalHomePage**: `useMyVehicles()` → cards linking to `/portal/vehicles/:id` (model + plate); empty `portal.noVehicles`.
  - **PortalVehiclePage** (`/portal/vehicles/:id`): vehicle header (model/plate/VIN); `useVehicleOrders(id)` list → each links to `/portal/orders/:id` with `OrderStatusBadge`; empty `portal.noOrders`.
  - **PortalOrderPage** (`/portal/orders/:id`): reuse `getOrder` via a `useOrder(id)`-style query (import `useOrder` from `@/features/orders/hooks`), show status badge, intake summary (odometer/charge/concerns/notes), line items (description/qty/total via `computeOrderTotals` for the summary), and the inspection media gallery (reuse the `InspectionMedia` READ parts — but that component has upload/delete; instead render a read-only gallery here using `useMedia` + `signedMediaUrl`). Read-only: NO advance/approve/edit controls. Link to the invoice if one exists (`useInvoiceByOrder`).
  - **PortalInvoicesPage** (`/portal/invoices`): reuse `useInvoices()` (RLS → mine) → rows link to `/portal/invoices/:id`, show total + `InvoiceStatusBadge`; empty `portal.noInvoices`.
  - **PortalInvoicePage** (`/portal/invoices/:id`): reuse `useInvoice(id)` + `usePayments(id)`; show totals, payments, balance (`total − sumPayments`), status badge. Read-only (NO record/delete payment).

  Each: loading/empty/not-found states; bilingual; RTL-safe; generous spacing. (Follow `OrderDetailPage`/`InvoiceDetailPage` for structure, stripping all mutation controls.)

- [ ] **Step 3: Create `src/pages/portal/PortalHomePage.test.tsx`** — mock `@/pages/portal/portalData` `useMyVehicles` → two vehicles + empty; assert vehicle cards render and link to `/portal/vehicles/:id`, and the empty state. Wrap in I18nextProvider + MemoryRouter.

- [ ] **Step 4:** `npm test` + `npm run build` clean. Commit:
```bash
git add src/pages/portal/
git commit -m "feat(portal): read-only portal pages (vehicles, history, order, invoices)"
```

---

## Task 8: Routing — role-gated groups + portal routes + integration

**Files:** Modify `src/App.tsx`, `src/App.test.tsx`; Create `src/pages/portal/Portal.integration.test.tsx`.

- [ ] **Step 1: Rewrite `src/App.tsx`** so the admin group is gated by `RequireRole role="admin"` and a portal group is added:
```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { RequireRole } from "@/auth/RequireRole";
import { LoginPage } from "@/auth/LoginPage";
import { AppLayout } from "@/components/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { ServiceOrdersPage } from "@/pages/ServiceOrdersPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NewOrderPage } from "@/pages/NewOrderPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { CustomerFormPage } from "@/pages/CustomerFormPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage";
import { PortalLoginPage } from "@/features/portal/PortalLoginPage";
import { PortalLayout } from "@/features/portal/PortalLayout";
import { PortalHomePage } from "@/pages/portal/PortalHomePage";
import { PortalVehiclePage } from "@/pages/portal/PortalVehiclePage";
import { PortalOrderPage } from "@/pages/portal/PortalOrderPage";
import { PortalInvoicesPage } from "@/pages/portal/PortalInvoicesPage";
import { PortalInvoicePage } from "@/pages/portal/PortalInvoicePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />

      {/* Admin app */}
      <Route element={<RequireRole role="admin" loginPath="/login" />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<ServiceOrdersPage />} />
          <Route path="/orders/new" element={<NewOrderPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Customer portal */}
      <Route element={<RequireRole role="customer" loginPath="/portal/login" />}>
        <Route element={<PortalLayout />}>
          <Route path="/portal" element={<PortalHomePage />} />
          <Route path="/portal/vehicles/:id" element={<PortalVehiclePage />} />
          <Route path="/portal/orders/:id" element={<PortalOrderPage />} />
          <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
          <Route path="/portal/invoices/:id" element={<PortalInvoicePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```
(Verify the admin imports match the current `App.tsx` — copy the exact existing import list; only the guard wrapper changes from `RequireAuth` to `RequireRole role="admin"`, plus the portal additions. `RequireAuth` may become unused — remove its import if so.)

- [ ] **Step 2: Update `src/App.test.tsx`** — it currently mocks `@/auth/useAuth`. Now also mock `@/auth/useRole`. For the authenticated case set `useRole → { loading:false, role:"admin", customerId:null }`; the unauth case `useAuth → { session:null }` still redirects to `/login`. Keep both assertions meaningful. Add a case: authenticated `role:"customer"` at `/` → redirected (asserts it does NOT show the admin dashboard heading).

- [ ] **Step 3: Create `src/pages/portal/Portal.integration.test.tsx`** — mock `@/auth/useAuth` (session present) + `@/auth/useRole` (`role:"customer"`) and `@/pages/portal/portalData` (`useMyVehicles` → one vehicle); render `<App/>` (or just the portal group) at `/portal` in a QueryClient + I18nextProvider + MemoryRouter; assert the portal home renders the vehicle and that an admin route (`/`) redirects a customer to `/portal`. Mock other data hooks as needed.

- [ ] **Step 4:** `npm test` (all pass) + `npm run build` clean. Commit:
```bash
git add src/App.tsx src/App.test.tsx src/pages/portal/Portal.integration.test.tsx
git commit -m "feat(portal): role-gated routing and portal route group"
```

---

## Task 9: Final review + finish
- [ ] **Step 1:** Final whole-module review (cross-cutting: RLS migration correctness, role routing, no admin regression, reuse correctness, i18n parity, RTL, tests). `npm test` + `npm run build`.
- [ ] **Step 2:** finishing-a-development-branch → merge to `main` + push. Then the USER applies `0003` + seeds `admin_users`, and provisions a test customer login to verify end-to-end against the live DB.

---

## Self-Review (against the spec)
- Phone+PIN via synthetic email → Task 2 (`phoneToEmail`) + Task 6 (login) ✓
- Client-side provisioning via throwaway client + link → Task 4 (`provisionPortalLogin`) + Task 5 (panel) ✓
- RLS rewrite (admin_users, helpers, per-customer policies) → Task 1 (`0003`) ✓
- Role routing (admin vs customer; separate logins) → Task 3 (`useRole`/`RequireRole`) + Task 8 ✓
- Read-only portal pages reusing the scoped data layer → Task 7 ✓
- Admin "Portal access" panel → Task 5 ✓
- Bilingual EN/AR + RTL, JOD 3dp → Tasks 4–7 ✓
- Known limitations (forgotten-PIN reset deferred, open-signup orphan, storage UUID paths) → documented; no tasks needed ✓
- Setup (email-confirm OFF done; apply 0003 + seed admin) → Task 1 apply-note + Task 9 ✓

**Placeholder scan:** Logic/infra tasks (migration, phone, useRole, RequireRole, provisioning api, panel, login) have complete code; Task 7's five read-only pages give exact data sources + reuse instructions + per-page content (they mirror existing reviewed pages, stripped of mutations) — the engineer has the data contracts and component patterns to build them without invention.

**Type consistency:** `phoneToEmail`/`normalizePhone`, `useRole` return shape, `RequireRole` props, `provisionPortalLogin(customerId, phone, pin)`, `Customer.auth_user_id`, the `["role", uid]`/`["my-vehicles"]`/`["my-vehicle-orders", id]` query keys, and the route paths are all consistent across tasks and with existing hooks (`useOrder`, `useInvoice`, `usePayments`, `useInvoiceByOrder`, `useMedia`).

---

## Next Phase-2 sub-projects (separate spec→plan)
- Notifications (WhatsApp/in-app reminders) · Software-update-due tracking.
```
