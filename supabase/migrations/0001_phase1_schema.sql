-- ===== Enums =====
create type order_status as enum (
  'appointment','intake','diagnosis','estimate','awaiting_approval',
  'in_progress','qc','ready','closed','cancelled'
);
create type line_type as enum ('service','part','fee');
create type discount_type as enum ('none','amount','percent');
create type payment_status as enum ('unpaid','partial','paid');
create type payment_method as enum ('cash','card','transfer');
create type media_type as enum ('photo','video');

-- ===== Branches (multi-ready; one row seeded) =====
create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
insert into branches (name) values ('Main Branch');

-- ===== Customers =====
create table customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Vehicles =====
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  customer_id uuid not null references customers(id) on delete cascade,
  vin text,
  plate_number text,
  model text,
  model_year int,
  color text,
  current_odometer int,
  hv_battery_state text,
  software_version text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Service orders (job cards) =====
create table service_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  vehicle_id uuid not null references vehicles(id),
  customer_id uuid not null references customers(id),
  order_number bigint generated always as identity,
  status order_status not null default 'intake',
  odometer_at_intake int,
  charge_percent int,
  hv_battery_state text,
  reported_concerns text,
  intake_notes text,
  approved_at timestamptz,
  approved_by text,
  closed_at timestamptz,
  next_service_due_date date,
  next_service_due_odometer int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Inspection media =====
create table inspection_media (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders(id) on delete cascade,
  media_type media_type not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- ===== Service order line items (shared by estimate + invoice) =====
create table service_order_lines (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders(id) on delete cascade,
  line_type line_type not null default 'service',
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount_type discount_type not null default 'none',
  discount_value numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ===== Invoices =====
create table invoices (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders(id),
  invoice_number bigint generated always as identity,
  currency text not null default 'JOD',
  subtotal numeric not null default 0,
  discount_total numeric not null default 0,
  total numeric not null default 0,
  payment_status payment_status not null default 'unpaid',
  issued_at timestamptz not null default now()
);

-- ===== Payments =====
create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null,
  method payment_method not null default 'cash',
  note text,
  paid_at timestamptz not null default now()
);

-- ===== updated_at trigger =====
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_customers_updated before update on customers
  for each row execute function set_updated_at();
create trigger trg_vehicles_updated before update on vehicles
  for each row execute function set_updated_at();
create trigger trg_orders_updated before update on service_orders
  for each row execute function set_updated_at();

-- ===== Row Level Security (Phase 1: any authenticated user has full access) =====
alter table branches enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table service_orders enable row level security;
alter table inspection_media enable row level security;
alter table service_order_lines enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'branches','customers','vehicles','service_orders','inspection_media',
    'service_order_lines','invoices','payments'
  ] loop
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true);', t
    );
  end loop;
end $$;

-- ===== Storage bucket for inspection media (private) =====
insert into storage.buckets (id, name, public) values ('inspection-media','inspection-media', false)
  on conflict (id) do nothing;

create policy "authenticated read media" on storage.objects for select to authenticated
  using (bucket_id = 'inspection-media');
create policy "authenticated write media" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-media');
