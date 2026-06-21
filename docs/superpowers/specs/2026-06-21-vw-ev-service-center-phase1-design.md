# Watheeq EV Service Center — Phase 1 Design

**Date:** 2026-06-21
**Status:** Approved (design); pending implementation plan
**Scope:** Phase 1 (Operational core) of a management platform for a car service center
specialized in Volkswagen electric vehicles.

---

## 1. Background & Goal

A workshop that services VW electric cars — software updates, repairs, and (later) parts
sales — needs a management system. The full vision spans ~8 subsystems (CRM, service
orders, intake/inspection, inventory, invoicing, full accounting, software-update
tracking, customer portal, WhatsApp notifications). That is too large for one build, so it
is decomposed into phases. **This document specifies Phase 1 only.**

### Phase roadmap (agreed)
- **Phase 1 — Operational core (this spec):** Customers & Vehicles (CRM) → Service Orders /
  Job Cards → Intake & Inspection → line-item Invoicing & payments. A usable workshop
  system on its own.
- **Phase 2 — Customer-facing & engagement:** Customer portal login, WhatsApp / in-app
  reminders (next-service due, software-update available), software-version-per-VIN
  tracking.
- **Phase 3 — Financial & inventory depth:** Full accounting (chart of accounts, ledger,
  reports, tax), real inventory (stock counts, suppliers, purchase orders), counter
  parts-sales POS.

---

## 2. Foundational Decisions

| Area | Decision |
|------|----------|
| **Stack** | Vite + React + TypeScript SPA; Supabase (Postgres, Auth, Storage); Tailwind + Radix |
| **Language** | Bilingual. **English default (LTR)**, Arabic toggle (RTL via Radix `DirectionProvider`) |
| **Branches** | Single branch now; `branch_id` on core tables for future multi-branch (multi-ready) |
| **Roles** | Single **Admin / Manager** role in Phase 1; role-based permissions deferred |
| **Currency** | Jordanian Dinar (JOD), 3 decimal places |
| **Tax** | None — no tax line on invoices |
| **Pricing** | Free **line-item** invoicing; price entered per line; **per-line discount** (amount or %) |
| **Inventory** | **Deferred.** "Parts used" are line items on the job/invoice — no stock tracking |
| **Damage capture** | **Photos/video + free-text notes** (no car diagram); structured intake fields kept |

---

## 3. Service Order Lifecycle (the spine)

The job card moves through these stages; `status` is the most-queried field in the system
(drives the dashboard board and the Service Orders filter). VW-EV-specific steps marked 🟢.

1. **Appointment / Walk-in** — booking or unannounced arrival; captures customer + vehicle + reason
2. **Vehicle Intake & Inspection** — odometer, charge %, reported concerns, walk-around photos/video, condition notes; 🟢 HV battery state recorded
3. **Diagnosis** — determine mechanical / parts / software work; 🟢 ODIS-style diagnostic session & fault codes
4. **Estimate / Quotation** — build quote from line items (parts + labor + fees)
5. **Customer Approval** — approve/decline; records who & when (WhatsApp delivery in Phase 2)
6. **Work in Progress** — log labor & parts-used lines; 🟢 software update / flashing as a service type
7. **Quality Check** — final inspection / test; 🟢 HV safety sign-off
8. **Invoice & Payment** — generate invoice from lines, record payment, mark paid/partial/unpaid
9. **Handover & Close** — deliver car, capture signature, close order, set next-service reminder

> Implementation note: `status` is a Postgres enum mirroring these stages. Status
> transitions are guarded (e.g., cannot move to Invoice with zero lines).

---

## 4. Data Model (core tables)

All core tables include `id` (uuid), `branch_id`, `created_at`, `updated_at`.

### customers
`name`, `phone`, `email` (nullable), `notes`.

### vehicles
`customer_id` (FK), `vin`, `plate_number`, `model`, `model_year`, `color`,
`current_odometer`, `hv_battery_state` (text/note), `software_version`, `notes`.
*A customer has many vehicles.*

### service_orders (the job card)
`vehicle_id` (FK), `customer_id` (FK, denormalized for fast listing), `order_number`
(human-friendly, sequential per branch), `status` (enum, see §3),
intake fields: `odometer_at_intake`, `charge_percent`, `hv_battery_state`,
`reported_concerns`, `intake_notes`,
workflow stamps: `approved_at`, `approved_by`, `closed_at`,
`next_service_due` (date and/or odometer target — set at handover).

### inspection_media
`service_order_id` (FK), `media_type` (photo | video), `storage_path` (Supabase Storage),
`caption` (nullable).

### service_order_lines
`service_order_id` (FK), `line_type` (service | part | fee), `description`, `quantity`,
`unit_price`, `discount_type` (amount | percent | none), `discount_value`,
`line_total` (computed/persisted). **Shared by estimate and invoice** — no separate quote table.

### invoices
`service_order_id` (FK), `invoice_number`, `currency` (= 'JOD'), `subtotal`,
`discount_total`, `total`, `payment_status` (unpaid | partial | paid), `issued_at`.
*Snapshot of totals at invoice time; lines remain on the order.*

### payments
`invoice_id` (FK), `amount`, `method` (cash | card | transfer), `paid_at`, `note`.

### Key modeling notes
- **Estimate = invoice-not-yet-paid:** while an order is in Estimate/Awaiting-approval, its
  `service_order_lines` *are* the quote. Invoicing snapshots totals into `invoices`; payments
  attach to the invoice. One source of line data.
- **`next_service_due` lives on the order**, not the vehicle, because it is decided at
  handover based on work performed. Phase 2 reminders query orders by this field.

---

## 5. Modules / Screens

- **Dashboard** — 4 KPIs (Cars in workshop · Awaiting approval · Ready for handover ·
  Invoiced today) + a live "workshop by stage" board (cards grouped by `status`).
- **Service Orders** — list filterable by stage → job-card detail: intake panel, line
  items, media gallery, status-advance actions, approval, generate invoice.
- **Customers & Vehicles** — customer record → their vehicles → per-vehicle service history.
- **Invoices** — list + detail; record payment; payment status.
- **Settings** — workshop profile (name AR/EN, logo, address, phone), currency, default
  language, optional quick-pick list of common services with default prices.

---

## 6. Data Flow & Key Logic

1. **New order:** select/create customer → select/create vehicle → fill intake fields →
   upload photos/video → order created at status **Intake**, appears on dashboard board.
2. **Through the pipeline:** manager advances `status`; adds line items during Estimate;
   line totals and order subtotal recompute live.
3. **Approval:** stamps `approved_by` / `approved_at`.
4. **Handover:** generate `invoices` row from current lines, record `payments`, set
   `next_service_due`, set status **Closed**.

### Money logic (the part that must be correct)
- `line_total` = `quantity × unit_price`, minus discount (`amount` subtracts directly;
  `percent` subtracts `value%` of the gross).
- invoice `subtotal` = Σ gross line amounts; `discount_total` = Σ discounts;
  `total` = `subtotal − discount_total`.
- `payment_status` derived from Σ payments vs. `total` (0 → unpaid, ≥ total → paid,
  else partial).

---

## 7. Error Handling & Validation

- **Zod** schema on every form. **Known project gotcha:** when a new column is added to a
  table, it must also be added to the corresponding Zod/input schema, or it silently fails
  to persist. Treat the Zod schema as part of the table definition.
- Friendly toast notifications on failures; media uploads retry on transient errors.
- **Guarded status transitions:** cannot invoice an order with zero lines; cannot close an
  unpaid order without explicit confirmation.

---

## 8. Internationalization (RTL)

- English default, LTR. Arabic toggle switches `dir` via Radix `DirectionProvider` (no
  per-component dir hacks).
- UI strings from a translation dictionary; user data (names, VIN, plate, part numbers)
  is language-agnostic. JOD currency and number formatting respects locale.

---

## 9. Security

- Supabase Auth, single Admin role. Row Level Security enabled on all tables; Phase 1
  policy = authenticated user has full access within their `branch_id`.
- Inspection media in a **private** Storage bucket, accessed via short-lived signed URLs.

---

## 10. Testing

Proportional to risk:
- **Unit tests** for money logic (line totals, per-line discount, invoice subtotal/total,
  payment-status derivation).
- **One smoke path:** create order → add line → generate invoice → record payment.
- No blanket coverage target.

---

## 11. Out of Scope (Phase 1)

Inventory/stock, suppliers/POs, counter parts-sales POS, full accounting/ledger/tax,
customer portal, WhatsApp/notifications, software-update-due tracking, multiple roles &
granular permissions, multiple branches (schema is ready, UI is not), car-diagram damage
marking. All map to Phase 2 / Phase 3.
