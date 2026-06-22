-- ===== Inventory: shared catalog + per-branch stock & movement ledger =====
-- Catalog (items, suppliers) is shared across branches; stock levels and the
-- movement ledger are per-branch and isolated via can_access_branch() (0007).

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text,
  unit text not null default 'pcs',
  cost numeric(12, 3) not null default 0,
  sale_price numeric(12, 3) not null default 0,
  reorder_level numeric(12, 3) not null default 0,
  supplier_id uuid references suppliers(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-branch on-hand quantity (maintained by the movement trigger below).
create table inventory_stock (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  branch_id uuid not null references branches(id),
  quantity numeric(12, 3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (item_id, branch_id)
);
create index idx_inventory_stock_branch on inventory_stock(branch_id);

-- Append-only ledger. A transfer is two rows (transfer_out + transfer_in).
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  item_id uuid not null references inventory_items(id) on delete cascade,
  type text not null check (type in ('receive','issue','adjust','transfer_in','transfer_out','count')),
  quantity_delta numeric(12, 3) not null,
  unit_cost numeric(12, 3),
  reference text,
  service_order_id uuid references service_orders(id) on delete set null,
  to_branch_id uuid references branches(id),
  created_at timestamptz not null default now()
);
create index idx_inventory_movements_item_branch on inventory_movements(item_id, branch_id);

-- Keep inventory_stock accurate from every movement (security definer so the
-- trigger can upsert stock regardless of the caller's RLS).
create or replace function public.apply_inventory_movement() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.inventory_stock (item_id, branch_id, quantity)
  values (new.item_id, new.branch_id, new.quantity_delta)
  on conflict (item_id, branch_id)
  do update set quantity = public.inventory_stock.quantity + new.quantity_delta,
                updated_at = now();
  return new;
end;
$$;
create trigger trg_apply_inventory_movement
  after insert on inventory_movements
  for each row execute function public.apply_inventory_movement();

-- ===== RLS =====
alter table suppliers enable row level security;
alter table inventory_items enable row level security;
alter table inventory_stock enable row level security;
alter table inventory_movements enable row level security;

-- Shared catalog: any admin reads & manages.
create policy "suppliers admin" on suppliers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "inventory_items admin" on inventory_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Per-branch stock & movements: scoped to the admin's accessible branch.
create policy "inventory_stock access" on inventory_stock for all to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));
create policy "inventory_movements access" on inventory_movements for all to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));

-- ===== Apply to prod with explicit authorization (like 0002–0007). =====
