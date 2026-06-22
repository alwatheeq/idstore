-- ===== Purchase Orders =====
-- Per-branch POs against suppliers. Receiving a PO posts receive-movements
-- (via the inventory ledger/trigger from 0008) into the PO's branch stock.

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  supplier_id uuid references suppliers(id) on delete set null,
  po_number bigint generated always as identity,
  status text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  ordered_at timestamptz,
  received_at timestamptz
);

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  item_id uuid not null references inventory_items(id),
  quantity numeric(12, 3) not null,
  unit_cost numeric(12, 3) not null default 0,
  received_qty numeric(12, 3) not null default 0
);
create index idx_po_lines_po on purchase_order_lines(po_id);

alter table purchase_orders enable row level security;
alter table purchase_order_lines enable row level security;

create policy "purchase_orders access" on purchase_orders for all to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));
create policy "purchase_order_lines access" on purchase_order_lines for all to authenticated
  using (exists (select 1 from purchase_orders p where p.id = po_id and public.can_access_branch(p.branch_id)))
  with check (exists (select 1 from purchase_orders p where p.id = po_id and public.can_access_branch(p.branch_id)));

-- ===== Apply to prod with explicit authorization (like 0002–0008). =====
