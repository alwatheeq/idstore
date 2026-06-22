-- ===== Multi-branch: branch metadata, per-admin access, branch-scoped RLS =====

-- 1) Branch metadata
alter table branches add column code text;
alter table branches add column phone text;
alter table branches add column address text;
alter table branches add column is_active boolean not null default true;

-- 2) Per-admin branch access. Existing admin(s) become super (owner), homed at
--    the first branch — bundled here so nobody is locked out.
alter table admin_users add column home_branch_id uuid references branches(id);
alter table admin_users add column can_access_all_branches boolean not null default false;
update admin_users
  set can_access_all_branches = true,
      home_branch_id = coalesce(home_branch_id, (select id from branches order by created_at limit 1));

-- 3) Denormalize branch onto invoices (was only reachable via the order) so
--    financial queries + RLS scope by branch directly.
alter table invoices add column branch_id uuid references branches(id);
update invoices i set branch_id = o.branch_id
  from service_orders o where o.id = i.service_order_id;

-- 4) Access helpers (security definer; bypass RLS for the role checks).
create or replace function public.is_super_admin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users
    where user_id = auth.uid() and can_access_all_branches);
$$;
create or replace function public.admin_home_branch() returns uuid
  language sql stable security definer set search_path = '' as $$
  select home_branch_id from public.admin_users where user_id = auth.uid();
$$;
-- True only for admins: super admins → any branch; regular admins → home branch.
-- (A customer has no admin_users row, so this is false for them.)
create or replace function public.can_access_branch(b uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or (b is not null and b = public.admin_home_branch());
$$;

-- 5) Rewrite policies: admin access to a branch-scoped row now requires
--    can_access_branch(...). Customer-portal ownership clauses are unchanged.

-- branches: any admin may read the list (names aren't sensitive); only super writes.
drop policy "branches select" on branches;
drop policy "branches admin" on branches;
create policy "branches select" on branches for select to authenticated using (true);
create policy "branches admin" on branches for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- customers (direct branch_id)
drop policy "customers select" on customers;
drop policy "customers admin" on customers;
create policy "customers select" on customers for select to authenticated
  using (id = public.current_customer_id() or public.can_access_branch(branch_id));
create policy "customers admin" on customers for all to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));

-- vehicles (direct branch_id)
drop policy "vehicles select" on vehicles;
drop policy "vehicles admin" on vehicles;
create policy "vehicles select" on vehicles for select to authenticated
  using (customer_id = public.current_customer_id() or public.can_access_branch(branch_id));
create policy "vehicles admin" on vehicles for all to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));

-- service_orders (direct branch_id)
drop policy "service_orders select" on service_orders;
drop policy "service_orders admin" on service_orders;
create policy "service_orders select" on service_orders for select to authenticated
  using (customer_id = public.current_customer_id() or public.can_access_branch(branch_id));
create policy "service_orders admin" on service_orders for all to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));

-- service_order_lines (branch via parent order)
drop policy "service_order_lines select" on service_order_lines;
drop policy "service_order_lines admin" on service_order_lines;
create policy "service_order_lines select" on service_order_lines for select to authenticated
  using (exists (select 1 from service_orders o where o.id = service_order_id
    and (o.customer_id = public.current_customer_id() or public.can_access_branch(o.branch_id))));
create policy "service_order_lines admin" on service_order_lines for all to authenticated
  using (exists (select 1 from service_orders o where o.id = service_order_id and public.can_access_branch(o.branch_id)))
  with check (exists (select 1 from service_orders o where o.id = service_order_id and public.can_access_branch(o.branch_id)));

-- inspection_media (branch via parent order)
drop policy "inspection_media select" on inspection_media;
drop policy "inspection_media admin" on inspection_media;
create policy "inspection_media select" on inspection_media for select to authenticated
  using (exists (select 1 from service_orders o where o.id = service_order_id
    and (o.customer_id = public.current_customer_id() or public.can_access_branch(o.branch_id))));
create policy "inspection_media admin" on inspection_media for all to authenticated
  using (exists (select 1 from service_orders o where o.id = service_order_id and public.can_access_branch(o.branch_id)))
  with check (exists (select 1 from service_orders o where o.id = service_order_id and public.can_access_branch(o.branch_id)));

-- invoices (now direct branch_id)
drop policy "invoices select" on invoices;
drop policy "invoices admin" on invoices;
create policy "invoices select" on invoices for select to authenticated
  using (public.can_access_branch(branch_id) or exists (
    select 1 from service_orders o where o.id = service_order_id and o.customer_id = public.current_customer_id()));
create policy "invoices admin" on invoices for all to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));

-- payments (branch via invoice)
drop policy "payments select" on payments;
drop policy "payments admin" on payments;
create policy "payments select" on payments for select to authenticated
  using (exists (select 1 from invoices inv where inv.id = invoice_id
    and (public.can_access_branch(inv.branch_id) or exists (
      select 1 from service_orders o where o.id = inv.service_order_id and o.customer_id = public.current_customer_id()))));
create policy "payments admin" on payments for all to authenticated
  using (exists (select 1 from invoices inv where inv.id = invoice_id and public.can_access_branch(inv.branch_id)))
  with check (exists (select 1 from invoices inv where inv.id = invoice_id and public.can_access_branch(inv.branch_id)));

-- vehicle_software_updates (branch via vehicle)
drop policy "vehicle_software_updates select" on vehicle_software_updates;
drop policy "vehicle_software_updates admin" on vehicle_software_updates;
create policy "vehicle_software_updates select" on vehicle_software_updates for select to authenticated
  using (exists (select 1 from vehicles v where v.id = vehicle_id
    and (v.customer_id = public.current_customer_id() or public.can_access_branch(v.branch_id))));
create policy "vehicle_software_updates admin" on vehicle_software_updates for all to authenticated
  using (exists (select 1 from vehicles v where v.id = vehicle_id and public.can_access_branch(v.branch_id)))
  with check (exists (select 1 from vehicles v where v.id = vehicle_id and public.can_access_branch(v.branch_id)));

-- ===== Apply to prod with explicit authorization (like 0002–0006). =====
