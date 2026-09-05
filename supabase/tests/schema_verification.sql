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
    'create_qualification_type',
    'grant_technician_qualification',
    'create_hv_work_permit',
    'record_hv_permit_check',
    'transition_hv_work_permit',
    'start_diagnostic_session',
    'record_diagnostic_trouble_code',
    'set_diagnostic_trouble_code_outcome',
    'complete_diagnostic_session',
    'record_battery_health_report',
    'register_attachment',
    'queue_customer_message',
    'create_stock_transfer',
    'receive_stock_transfer_line',
    'create_stock_count',
    'post_stock_count',
    'post_credit_note',
    'record_payment_refund',
    'open_cash_session',
    'close_cash_session',
    'record_quality_check',
    'create_service_campaign',
    'match_vehicle_campaign',
    'portal_dashboard',
    'portal_record_estimate_decision',
    'add_customer_contact',
    'record_customer_consent',
    'integration_overview',
    'audit_recent',
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

-- These integrity checks must also return zero rows.
select 'refund_over_payment' as invariant, r.payment_id as id
from (select payment_id,sum(amount) amount from public.payment_refunds where status='recorded' group by payment_id) r
join public.payments p on p.id=r.payment_id where r.amount>p.amount
union all
select 'credit_over_line',cl.invoice_line_id
from (select invoice_line_id,sum(quantity) quantity from public.credit_note_lines group by invoice_line_id) cl
join public.invoice_lines il on il.id=cl.invoice_line_id where cl.quantity>il.quantity
union all
select 'confirmed_unverified_campaign',m.id
from public.campaign_vehicle_matches m join public.service_campaigns c on c.id=m.campaign_id
where m.status in ('confirmed','completed') and c.status='draft';

-- Confirm immutable-ledger and tenant-consistency triggers exist.
select event_object_schema, event_object_table, trigger_name
from information_schema.triggers
where trigger_name in ('stock_movements_immutable', 'protect_posted_invoice', 'assert_branch_organization')
order by event_object_schema, event_object_table, trigger_name;
