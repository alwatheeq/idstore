# Software-Update Tracking — Implementation Plan

**Date:** 2026-06-22
**Spec:** `docs/superpowers/specs/2026-06-22-software-update-tracking-design.md`
**Branch:** `feat/software-update-tracking`

Build order is bottom-up (data → logic → api/hooks → components → pages → wiring), TDD for pure logic, suite green throughout.

## Step 1 — Migration (committed, not auto-applied)
- `supabase/migrations/0004_software_updates.sql`:
  - `alter table vehicles add column target_software_version text;`
  - `create table vehicle_software_updates (…)` per spec §3.
  - `enable row level security` + two policies (select: admin or owner via vehicle→customer; all: `is_admin()`).
  - Inline comment: apply to prod with explicit authorization (like 0002/0003).

## Step 2 — Vehicle field plumbing
- `customers/types.ts`: add `target_software_version: string | null` to `Vehicle`.
- `customers/schema.ts`: add `target_software_version: optionalText` to `vehicleSchema`.
- `customers/VehicleForm.tsx`: add the field next to `software_version`.

## Step 3 — Feature core (`src/features/software/`)
- `types.ts` — `SoftwareUpdate`, `DueVehicle`.
- `due.ts` + `due.test.ts` (TDD first): `isUpdateDue`, `filterDueVehicles`.
- `schema.ts` + `schema.test.ts`: `softwareUpdateSchema`.
- `api.ts` — `listVehicleUpdates`, `createSoftwareUpdate(payload,{setCurrent})`, `deleteSoftwareUpdate`, `listDueVehicles`.
- `hooks.ts` — `useVehicleUpdates`, `useCreateSoftwareUpdate`, `useDeleteSoftwareUpdate`, `useDueVehicles`.

## Step 4 — Components
- `SoftwareDueBadge.tsx` (+ test) — volt/amber "Update due" pill; nothing when up to date.
- `SoftwareHistory.tsx` (+ test) — read-only list (from→to, date, notes, order link); `canDelete` prop for admin.
- `SoftwareUpdateForm.tsx` (+ test) — to/from version, date, notes, optional order select, "also set current version" checkbox.

## Step 5 — Admin vehicle page
- `src/pages/VehicleDetailPage.tsx` (+ test) at `/vehicles/:id`: header + Software card (current→target, log toggle, form, history). Needs `useVehicle(id)` (add to customers/hooks if absent).
- `CustomerDetailPage.tsx`: add "Software ›" link on each vehicle card → `/vehicles/:id`.

## Step 6 — Software worklist page
- `src/pages/SoftwarePage.tsx` (+ test) at `/software`: `useDueVehicles()` list; empty state.
- `Sidebar.tsx`: add "Software" nav item + SVG icon; i18n `nav.software`.

## Step 7 — Dashboard KPI
- `DashboardPage.tsx`: add "Updates due" `KpiCard` (count from `useDueVehicles`), linked to `/software`. Do not touch `computeDashboard`.

## Step 8 — Portal
- `pages/portal/PortalVehiclePage.tsx`: current version + "update available" indicator + read-only `SoftwareHistory` (no delete, no form).

## Step 9 — Routing & i18n
- `App.tsx` (or router): add `/vehicles/:id` and `/software` under the admin layout (RequireRole admin).
- Add all new keys to BOTH `src/i18n/en.json` and `ar.json` (parity test enforces it); Arabic natural, not literal.

## Step 10 — Verify
- `npm test` (green, +~20–30), `npm run build` clean, lint clean.
- Preview: restart dev server (tailwind/config + new routes), check EN + AR, no console errors; screenshot Software page + vehicle page.
- `git status` for untracked source (subagent gotcha).

## Step 11 — Wrap
- Update CLAUDE.md phase status + memory. Commit per-step; push branch; await merge instruction.
