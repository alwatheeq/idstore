-- Read-only verification queries for the IDstore schema.

-- Expected application table count and names.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- This query must return zero rows: every public application table must use RLS.
select tablename
from pg_tables
where schemaname = 'public'
  and not rowsecurity;

-- Expected private schemas.
select schema_name
from information_schema.schemata
where schema_name in ('app_private', 'audit', 'integration')
order by schema_name;

-- Confirm the only internal application roles.
select enumlabel
from pg_enum e
join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typname = 'app_role'
order by e.enumsortorder;

-- Confirm storage buckets are private.
select id, public, file_size_limit
from storage.buckets
where id in (
  'vehicle-media',
  'diagnostics',
  'documents',
  'qualification-evidence',
  'integration-payloads'
)
order by id;

-- Confirm permission catalog.
select code, description
from public.permissions
order by code;

-- Confirm no direct grants were accidentally given to anon on public tables.
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by table_name, privilege_type;

-- Command RPCs must be callable only by authenticated users.
select routine_schema, routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in (
    'create_repair_order',
    'transition_repair_order',
    'post_stock_movement',
    'post_invoice',
    'receive_invoice_payment'
  )
order by routine_name, grantee;

-- These queries must return zero rows: every branch-scoped row must reference a
-- branch in the same organization, and document numbers must not collide.
select 'repair_orders' as relation, r.id
from public.repair_orders r
join public.branches b on b.id = r.branch_id
where b.organization_id <> r.organization_id
union all
select 'invoices', i.id
from public.invoices i
join public.branches b on b.id = i.branch_id
where b.organization_id <> i.organization_id
union all
select 'stock_movements', m.id
from public.stock_movements m
join public.branches b on b.id = m.branch_id
where b.organization_id <> m.organization_id;

-- Confirm immutable-ledger and tenant-consistency triggers exist.
select event_object_schema, event_object_table, trigger_name
from information_schema.triggers
where trigger_name in ('stock_movements_immutable', 'protect_posted_invoice', 'assert_branch_organization')
order by event_object_schema, event_object_table, trigger_name;
