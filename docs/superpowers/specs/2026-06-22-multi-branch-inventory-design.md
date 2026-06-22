# Multi-Branch + Inventory — Design (Phase 3)

**Date:** 2026-06-22
**Status:** Phase A (multi-branch) built + applied; Phases B–D pending.

## Decisions (locked via brainstorming)
- **Branch access:** hybrid — admins have a `home_branch_id` + a `can_access_all_branches` (super) flag. Super sees all branches + an "All branches" consolidated view; regular admins are pinned to home. **RLS-enforced.** The existing owner is seeded super.
- **Isolation:** invoices/financials AND inventory scoped per branch. Catalog (part definitions) is **shared**; stock/movements/POs/valuation are **per-branch**.
- **Inventory depth:** full ops + suppliers + purchase orders (defer serial/batch/bins/FIFO).
- **Order integration:** service-order "part" lines can pick a catalog item → issuing decrements that branch's stock.

## Phase A — Multi-branch (DONE, migration 0007)
- `branches` + `code/phone/address/is_active`; `admin_users` + `home_branch_id/can_access_all_branches` (owner seeded super, bundled — no lock-out); `invoices.branch_id` denormalized + backfilled.
- Helpers `is_super_admin()`, `admin_home_branch()`, `can_access_branch(b)`; admin RLS on every branch-scoped table = `can_access_branch(branch_id)` (child tables via parent); portal clauses preserved.
- App: `src/features/branches/` — `ActiveBranchContext`/`useActiveBranch()`, `BranchSwitcher` (top bar), `BranchManager`/`BranchForm` (Settings, super only). All list hooks filter by active branch; inserts use active/parent branch. Create disabled under "All branches".

## Phase B — Inventory core (migration 0008)
- `inventory_items` (shared catalog: sku, name, category, unit, cost, sale_price, reorder_level, supplier_id, is_active).
- `inventory_stock` (item_id, branch_id, quantity) unique(item,branch) — per-branch on-hand.
- `inventory_movements` (item_id, branch_id, type: receive/issue/adjust/transfer_in/transfer_out/count, qty_delta, unit_cost, reference, service_order_id, to_branch_id, created_at). **Trigger** updates `inventory_stock` on movement insert.
- `suppliers` (shared).
- RLS: catalog/suppliers readable by any admin; stock/movements branch-scoped via `can_access_branch(branch_id)`.
- UI: Inventory nav page — items list w/ active-branch stock + low-stock badges; item detail w/ movement history + receive/issue/adjust/transfer/count actions; suppliers CRUD; valuation + low-stock summary.

## Phase C — Purchase Orders (migration 0009)
- `purchase_orders` (branch_id, supplier_id, status, created_at) + `purchase_order_lines` (po_id, item_id, quantity, unit_cost, received_qty). Receiving creates receive-movements + updates received_qty.

## Phase D — Order ↔ inventory
- LineItemsEditor: a "part" line can reference an `inventory_item` (auto-fills sale price); on save/issue, create an issue movement decrementing the order branch's stock; deleting reverses it.

## Testing / rollout
- Each phase: spec → build → tsc+vitest green → migration applied (authorized) → preview verify → commit/merge.
