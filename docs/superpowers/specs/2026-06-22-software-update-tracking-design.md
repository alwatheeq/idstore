# Software-Update Tracking — Design (Phase 2, sub-project 2)

**Date:** 2026-06-22
**Status:** Approved (design); pending implementation plan
**Scope:** Track, per electric vehicle, the **current** installed software version vs a shop-set **target** version, flag vehicles whose software is out of date ("update due"), and keep a flat **history log** of applied updates. Surfaces on a new admin vehicle page, a dedicated "Software" worklist, a dashboard KPI, and (read-only) the customer portal. Part of Phase 2 (customer-facing & engagement). WhatsApp notifications are a separate, later Phase 2 sub-project that will consume the "due" list this module produces.

---

## 1. Background

Phase 1 (operational core) and Phase 2 sub-project 1 (Customer Portal, per-customer RLS via migration `0003`) are complete and on `main` (alwatheeq/idstore). The `vehicles` table already carries `software_version` (current installed) and `hv_battery_state`. VW EVs receive routine ID.Software releases (applied in-workshop via ODIS or OTA) as well as safety recalls/campaigns. The shop needs to know, proactively, **which cars are behind** so they can be brought in / notified — and to keep an auditable record of what was applied when.

---

## 2. Decisions (locked)

| Area | Decision |
|------|----------|
| **Due mechanism** | Per-vehicle **target** version, admin-set. "Due" is a *derived computation*, not a stored flag: `target` is non-empty **AND** `target !== current`. Null/blank current with a target set ⇒ due. |
| **Setting target** | Just a vehicle attribute — added to the existing `VehicleForm` next to `software_version`. No separate "set target" action. |
| **History** | A flat per-vehicle log table `vehicle_software_updates`. Fields: `from_version` (opt), `to_version` (req), `applied_at` (date, default today), `notes` (opt), optional `service_order_id` link. **No** category/mandatory flag (classification lives in notes). |
| **Order link** | Vehicle-centric. Each history entry *may* reference a service order (nullable), but doesn't require one (covers ad-hoc / OTA logging). |
| **Apply convenience** | Logging an update defaults (checkbox, on) to also setting `vehicles.software_version = to_version`, so reaching target naturally clears "due". |
| **Admin surfacing** | New `/vehicles/:id` admin page (home for software) **+** new `/software` due worklist **+** dashboard "Updates due" KPI. |
| **Portal** | Read-only: current version, "update available" indicator when due, and applied-update history on `/portal/vehicle/:id`. |

---

## 3. Architecture

### Data model
- `vehicles.target_software_version text null` (new column). Added to `Vehicle` type **and** `vehicleSchema` (zod is the persistence source of truth — a column missing from the schema silently won't save).
- New table `vehicle_software_updates`:
  | column | type | notes |
  |---|---|---|
  | `id` | uuid pk default gen_random_uuid() | |
  | `branch_id` | uuid not null references branches | consistency with other tables |
  | `vehicle_id` | uuid not null references vehicles on delete cascade | |
  | `service_order_id` | uuid null references service_orders on delete set null | optional link |
  | `from_version` | text null | |
  | `to_version` | text not null | |
  | `applied_at` | date not null default current_date | |
  | `notes` | text null | |
  | `created_at` | timestamptz not null default now() | |

### "Due" logic (pure, tested)
`src/features/software/due.ts`:
- `isUpdateDue(v: Pick<Vehicle,'software_version'|'target_software_version'>): boolean` — target non-empty AND target !== current (trim-compared).
- `filterDueVehicles(vehicles): Vehicle[]` — for the worklist / KPI.

### Feature folder `src/features/software/`
- `types.ts` — `SoftwareUpdate`, and a `DueVehicle` (vehicle + joined customer name) for the worklist.
- `schema.ts` — `softwareUpdateSchema`: `to_version` min 1; `from_version`/`notes` optional text; `applied_at` date (default today); `service_order_id` optional. Reuses the `optionalText` pattern.
- `due.ts` — as above.
- `api.ts` — `listVehicleUpdates(vehicleId)`, `createSoftwareUpdate(payload, { setCurrent })`, `deleteSoftwareUpdate(id)`, `listDueVehicles()`.
- `hooks.ts` — TanStack Query wrappers; mutations invalidate the vehicle's update list + vehicle + due-vehicles keys and surface errors via `useToast`.
- Components — `SoftwareUpdateForm`, `SoftwareHistory`, `SoftwareDueBadge`.

### Security (migration `0004_software_updates.sql`)
RLS mirrors the per-customer pattern from `0003`:
- `vehicle_software_updates` **select**: `is_admin() OR exists(vehicle owned by current_customer_id())`.
- **all/writes**: `is_admin()` only. Portal stays read-only at the RLS layer.
- Committed but **applied to prod later with explicit authorization** (like 0002/0003); branch_id/`current_customer_id()` helpers already exist.

---

## 4. UI surfaces

1. **`/vehicles/:id` (admin, new)** — header (model · plate · VIN in mono + `SoftwareDueBadge`); Software card: current → target, "Log update" reveals `SoftwareUpdateForm`; `SoftwareHistory` below. Reached from a "Software ›" link on each vehicle card in `CustomerDetailPage`.
2. **`/software` (admin, new nav item)** — due worklist: each due vehicle as a row (current → target, customer, plate) → links to `/vehicles/:id`. Empty = "All vehicles up to date."
3. **Dashboard KPI** — "Updates due" count via `useDueVehicles`, links to `/software`. Wired in `DashboardPage` via hook (NOT `computeDashboard`, so existing dashboard tests are untouched).
4. **Portal `/portal/vehicle/:id`** — current version, "update available" indicator when due, read-only `SoftwareHistory`.

---

## 5. Testing
- `due.ts`: pure unit tests (TDD) — target unset, equal, differ, null current, whitespace.
- `schema.ts`: required `to_version`, optional transforms, date default.
- Components (mocked hooks): form submit (with/without "set current"), history render, due badge states, due worklist, portal read-only (no log form).
- Keep the full suite green; ~20–30 new tests.

---

## 6. Out of scope (YAGNI / later)
- Software release **catalog** per model + auto-due-by-model (considered; deferred).
- Category / mandatory-recall flag.
- WhatsApp reminders (separate sub-project; will consume `listDueVehicles()`).
- Version semantics/sorting beyond string compare.
