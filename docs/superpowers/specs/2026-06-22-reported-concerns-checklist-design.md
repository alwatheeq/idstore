# Reported Concerns Checklist — Design

**Date:** 2026-06-22
**Status:** Approved (design); implementing
**Scope:** Replace the single free-text "reported concerns" intake field with a preset multi-select checklist of common EV concerns, stored structured so each concern can be validated/checked off later on the order. Keep a free-text box for anything not listed.

## Decisions (locked)
- **Model:** structured checklist with a per-item `checked` flag (not plain text).
- **Catalog:** fixed key list (`src/features/orders/concerns.ts`), labels via i18n `concerns.*` (bilingual-correct — keys stored, labels rendered).
- **Storage:** `service_orders.concerns jsonb not null default '[]'` — array of `{ key: string, checked: boolean }`. Migration `0006`. Existing `reported_concerns` text retained as the free-text "other / details".
- **Intake:** preset checkboxes (multi-line) → each selected concern stored `checked:false`; plus the free-text box.
- **Order detail:** list each concern with a checkbox staff toggle to validate; "X of Y checked" progress; persists via `updateOrderConcerns`.

## Catalog keys
`wont_charge, slow_charging, reduced_range, warning_light, no_power, software, braking, noise, ac_heating, suspension, tires, body`

## Architecture
- `concerns.ts`: `CONCERN_KEYS: string[]`, `Concern = { key, checked }`, `checkedCount(concerns)`.
- `types.ts`: add `concerns: Concern[]` to `ServiceOrder`.
- `schema.ts`: `concerns: z.array(z.object({ key: z.string(), checked: z.boolean() })).default([])` on `intakeSchema`.
- `api.ts`: `createOrder` inserts `concerns`; new `updateOrderConcerns(id, concerns)`.
- `hooks.ts`: `useUpdateConcerns(id)` → invalidate `["order", id]`.
- Components: `ConcernsField` (intake multi-select, RHF `setValue`) and `OrderConcerns` (detail check-off + progress).
- UI: IntakeForm gains the checklist; `reported_concerns` relabeled "Other concerns / details". OrderDetailPage gains a Concerns section.

## i18n
`concerns.<key>` (12), `orders.reportedConcerns`, `orders.otherConcerns`, `orders.concernsChecked` (with count), in EN + AR.

## Testing
- `concerns.ts`: `checkedCount` pure tests.
- `schema`: concerns default `[]`.
- IntakeForm: selecting concerns includes them (checked:false) in payload.
- OrderConcerns: renders labels, toggling calls update, progress count.

## Out of scope
- Custom (free-text) concerns as individually-checkable items — free text stays as notes.
- Per-concern resolution notes / timestamps.
