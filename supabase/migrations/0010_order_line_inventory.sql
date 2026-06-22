-- ===== Order ↔ inventory: link service-order part lines to catalog items =====
-- A part line may reference an inventory item; saving it issues stock from the
-- order's branch (recorded in the inventory ledger). issued_qty tracks how much
-- has been issued for the line so edits/deletes can reconcile stock.

alter table service_order_lines add column inventory_item_id uuid references inventory_items(id) on delete set null;
alter table service_order_lines add column issued_qty numeric(12, 3) not null default 0;

-- ===== Apply to prod with explicit authorization (like 0002–0009). =====
