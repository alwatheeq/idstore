# Customer Portal — Design (Phase 2, sub-project 1)

**Date:** 2026-06-21
**Status:** Approved (design); pending implementation plan
**Scope:** A read-only customer portal where a customer logs in with their phone number + PIN and sees only their own vehicles, service history, parts/line items, invoices, and inspection photos. Part of Phase 2 (customer-facing & engagement). Notifications and software-update tracking are separate Phase 2 sub-projects (not in this spec).

---

## 1. Background

Phase 1 (operational core: CRM, Service Orders + intake/inspection, Invoicing, Dashboard) is complete, merged to `main`, on GitHub (alwatheeq/idstore). All Phase 1 tables currently use an RLS policy of *"authenticated → full access"*, which is safe only while the sole logins are trusted admins. The portal introduces customer logins, so the security model must change: a customer must read **only their own** rows. That security rework — not the screens — is the core of this sub-project.

---

## 2. Decisions (locked)

| Area | Decision |
|------|----------|
| **Login** | Phone number + 6-digit **PIN**. No SMS, no real email. |
| **Mechanism** | `phoneToEmail(phone)` → deterministic synthetic email (e.g. `962790000000@portal.idstore`); `signInWithPassword({ email, password: pin })`. |
| **Provisioning** | **Client-side** `signUp` (no server/edge function), called on a throwaway Supabase client (`persistSession:false`) so the admin's session isn't clobbered; admin then links `customers.auth_user_id`. |
| **Email confirmation** | OFF in Supabase Auth settings (already done) — synthetic emails can't confirm. |
| **Portal scope** | **Read-only.** View vehicles, service-order history + status, line items/parts, invoices + payments/balance, inspection photos. No customer actions. |
| **App structure** | Same app/codebase/Supabase project; portal under `/portal/*` with its own customer layout; role-based routing. |
| **Roles** | `admin_users` table + `is_admin()`; `customers.auth_user_id` + `current_customer_id()`. |

---

## 3. Architecture

### Auth & role routing
- `phoneToEmail(phone)`: pure, deterministic normalization (strip spaces/dashes/`+`, force canonical digits incl. country code) → `<digits>@portal.idstore`. Same input → same output, always (a mismatch would split one person across two accounts).
- Login: `signInWithPassword({ email: phoneToEmail(phone), password: pin })`.
- After login, resolve role: if a `customers` row has `auth_user_id = auth.uid()` → **customer** (→ `/portal`); else if `is_admin()` → **admin** (→ `/`). A small role resolver + a `RequireRole` guard wrap the two route groups.
- Wrong phone/PIN → generic "invalid phone or PIN" (don't reveal which). Rely on Supabase auth rate-limiting; account lockout is a follow-up.

### Provisioning (admin, client-side)
- On a customer's admin detail page, a "Portal access" panel:
  - **Create login**: generate/enter a 6-digit PIN → `signUp({ email: phoneToEmail(customer.phone), password: pin })` on a **throwaway client** (`createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false }})`) → read `data.user.id` → on the main (admin) client, `update customers set auth_user_id = <id>`. Show the PIN once for the admin to relay.
  - **Status**: show whether a portal login is linked.
  - **Change PIN**: supported only while the customer is logged in (`updateUser({ password })` in the portal). **Admin reset of a forgotten PIN is NOT supported** in this sub-project (needs a server function — deferred).
- Requires the customer to have a phone number on file (guard the action if missing).

### Security model (RLS) — migration `0003`
- `alter table customers add column auth_user_id uuid unique references auth.users(id);`
- `create table admin_users (user_id uuid primary key references auth.users(id) on delete cascade);`
- Helpers (`security definer`, `stable`, `set search_path = ''`):
  - `is_admin()` → `exists (select 1 from public.admin_users where user_id = auth.uid())`
  - `current_customer_id()` → `(select id from public.customers where auth_user_id = auth.uid())`
- Drop each table's `"authenticated full access"` policy; replace with:
  - **SELECT** `to authenticated using ( public.is_admin() OR <row belongs to current_customer_id()> )`
  - **INSERT/UPDATE/DELETE** `to authenticated using ( public.is_admin() ) with check ( public.is_admin() )`
  - Ownership predicates: `customers.id = current_customer_id()`; `vehicles.customer_id = current_customer_id()`; `service_orders.customer_id = current_customer_id()`; `service_order_lines` / `inspection_media` via their `service_order_id`'s order; `invoices` via its order; `payments` via its invoice's order.
  - `branches`: SELECT to all authenticated (names only); writes admin-only.
- **Apply sequence:** apply `0003`, then immediately `insert into admin_users (user_id) values ('<admin-auth-uid>')` — otherwise the rewritten policies lock the admin out. (User-run prod SQL, authorized like `0001`/`0002`.)

### Known limitations (accepted for this sub-project)
- **Open signup**: anyone could `signUp` a `@portal.idstore` account, but with no admin-set `auth_user_id` link it's an orphan that reads nothing (RLS). Risk = junk auth rows only.
- **Forgotten-PIN reset**: not possible client-side; deferred to a future server function.
- **Storage media**: the `inspection-media` bucket policy stays "authenticated read"; objects are protected by unguessable UUID paths, not per-customer RLS. Per-customer storage tightening is a follow-up.

---

## 4. Data model changes
- New column `customers.auth_user_id`.
- New table `admin_users`.
- New SQL helpers `is_admin()`, `current_customer_id()`.
- Rewritten RLS policies on all Phase-1 tables.
- No changes to existing app data shapes; existing `Customer`/`Vehicle`/order/invoice types unchanged (add `auth_user_id` to `Customer`).

---

## 5. Screens (read-only, bilingual EN/AR + RTL, portal layout)
- `/portal/login` — phone + PIN form.
- `/portal` — **my vehicles** (cards: model, plate, quick link).
- `/portal/vehicles/:id` — vehicle details + **service history** (its orders with status badges).
- `/portal/orders/:id` — read-only job card: status, intake summary (odometer, charge %, concerns, notes), line items/parts (description, qty, total), inspection photos (signed-URL gallery), link to invoice if any.
- `/portal/invoices` — my invoices (number, order, total, status badge).
- `/portal/invoices/:id` — read-only invoice: totals, payments, balance due.
- **Reuse:** `OrderStatusBadge`, `InvoiceStatusBadge`, money formatting (`toFixed(3)` JOD), i18n. **Data layer reused:** under a customer session, the existing `listVehicles`/`listOrders`/`listLines`/`listMedia`/`listInvoices`/`listPayments` return only that customer's rows via RLS — the portal adds read-only *pages*, not new scoped queries (a couple of thin portal hooks may wrap existing api for clarity).

### Admin side addition
- "Portal access" panel on `CustomerDetailPage` (create login / linked status / change-PIN note).

---

## 6. Data flow
1. Customer opens `/portal/login`, enters phone + PIN → `phoneToEmail` → `signInWithPassword` → role resolves to customer → `/portal`.
2. Portal pages query via existing api; RLS scopes to the customer automatically.
3. Admin provisions logins from the customer detail page (throwaway-client signUp + link).

---

## 7. Error handling
- Login: generic invalid-credentials message; disable submit while pending.
- Provisioning: guard when phone missing; surface signUp errors (e.g., already-registered) via toast; if `signUp` succeeds but the link `update` fails, surface it (the auth user exists but is unlinked → admin can retry the link).
- Portal data: standard loading/empty/not-found states; a customer hitting another customer's `/portal/orders/:id` gets "not found" (RLS returns no row).

---

## 8. Testing
- **Unit (TDD):** `phoneToEmail` normalization (spaces/dashes/`+`/leading-zero/country-code variants → one canonical email); role-resolution logic.
- **Component:** portal pages with mocked data; login form; the admin "Portal access" panel.
- **i18n parity** for new `portal.*` keys.
- **RLS:** verified against the live DB with a real provisioned customer session (read checks confirm scoping) — not unit-testable in vitest; documented manual/integration verification.

---

## 9. Out of scope (this sub-project)
Customer actions (estimate approval, appointment requests, messaging); forgotten-PIN/admin reset (needs server); per-customer Storage RLS; notifications/WhatsApp (separate Phase 2 sub-project); software-update tracking (separate Phase 2 sub-project); multi-branch portal scoping.

---

## 10. Setup steps (user-performed)
1. ✅ "Confirm email" already OFF in Supabase Auth.
2. Apply migration `0003` (authorize prod SQL).
3. Insert the admin user's id into `admin_users`.
4. (Per customer) Admin creates a portal login from the customer detail page.
