-- ===== Software-update tracking: per-vehicle target + applied-update history =====

-- 1) Target version the shop wants this vehicle on.
-- (Current installed version is the existing vehicles.software_version.)
-- "Due" is derived in the app (target set AND target <> current) — no stored flag.
alter table vehicles add column target_software_version text;

-- 2) Flat per-vehicle applied-update log.
create table vehicle_software_updates (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  service_order_id uuid references service_orders(id) on delete set null,
  from_version text,
  to_version text not null,
  applied_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_vsu_vehicle_id on vehicle_software_updates(vehicle_id);

alter table vehicle_software_updates enable row level security;

-- 3) RLS — mirror the per-customer model from 0003.
-- select: admin, OR the owner of the vehicle (read-only customer portal).
create policy "vehicle_software_updates select" on vehicle_software_updates for select to authenticated
  using (public.is_admin() or exists (
    select 1 from vehicles v
    where v.id = vehicle_id and v.customer_id = public.current_customer_id()));
-- writes: admin only.
create policy "vehicle_software_updates admin" on vehicle_software_updates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== Apply to prod with explicit authorization (like 0002 / 0003). =====
