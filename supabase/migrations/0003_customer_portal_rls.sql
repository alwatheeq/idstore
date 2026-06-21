-- ===== Customer Portal: auth link, admin roles, per-customer RLS =====

-- 1) Customer <-> auth user link
alter table customers add column auth_user_id uuid unique references auth.users(id) on delete set null;
create index idx_customers_auth_user_id on customers(auth_user_id);

-- 2) Admin allowlist
create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;

-- 3) Helper functions (security definer; bypass RLS for the role checks)
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
create or replace function public.current_customer_id() returns uuid
  language sql stable security definer set search_path = '' as $$
  select id from public.customers where auth_user_id = auth.uid();
$$;

-- admin_users self-select must use is_admin() (security definer, bypasses RLS).
-- Inlining "select 1 from admin_users" in admin_users's own policy causes
-- "infinite recursion detected in policy for relation admin_users".
-- Defined after is_admin() so the function exists when the policy is created.
create policy "admin_users readable by admins" on admin_users for select to authenticated
  using (public.is_admin());

-- 4) Drop the Phase-1 blanket policies
drop policy "authenticated full access" on branches;
drop policy "authenticated full access" on customers;
drop policy "authenticated full access" on vehicles;
drop policy "authenticated full access" on service_orders;
drop policy "authenticated full access" on inspection_media;
drop policy "authenticated full access" on service_order_lines;
drop policy "authenticated full access" on invoices;
drop policy "authenticated full access" on payments;

-- 5) New policies. Per table: a SELECT policy (admin OR owner) + an ALL policy (admin-only).
-- Permissive policies OR together → SELECT = (admin OR owner), writes = admin-only.

create policy "branches select" on branches for select to authenticated using (true);
create policy "branches admin" on branches for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "customers select" on customers for select to authenticated
  using (public.is_admin() or id = public.current_customer_id());
create policy "customers admin" on customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "vehicles select" on vehicles for select to authenticated
  using (public.is_admin() or customer_id = public.current_customer_id());
create policy "vehicles admin" on vehicles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "service_orders select" on service_orders for select to authenticated
  using (public.is_admin() or customer_id = public.current_customer_id());
create policy "service_orders admin" on service_orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "service_order_lines select" on service_order_lines for select to authenticated
  using (public.is_admin() or exists (
    select 1 from service_orders o where o.id = service_order_id and o.customer_id = public.current_customer_id()));
create policy "service_order_lines admin" on service_order_lines for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "inspection_media select" on inspection_media for select to authenticated
  using (public.is_admin() or exists (
    select 1 from service_orders o where o.id = service_order_id and o.customer_id = public.current_customer_id()));
create policy "inspection_media admin" on inspection_media for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "invoices select" on invoices for select to authenticated
  using (public.is_admin() or exists (
    select 1 from service_orders o where o.id = service_order_id and o.customer_id = public.current_customer_id()));
create policy "invoices admin" on invoices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "payments select" on payments for select to authenticated
  using (public.is_admin() or exists (
    select 1 from invoices inv join service_orders o on o.id = inv.service_order_id
    where inv.id = invoice_id and o.customer_id = public.current_customer_id()));
create policy "payments admin" on payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== REQUIRED after applying this migration =====
-- Seed the admin allowlist or the new policies lock every admin out:
--   insert into admin_users (user_id) values ('<your-admin-auth-user-id>');
-- Find the id in Supabase -> Authentication -> Users (your admin login).
