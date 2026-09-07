-- Permit a first price list on existing active maintenance orders, never over an existing invoice.
-- Allow pricing routine maintenance immediately after intake; preserve permissions, versioning and approvals.
create or replace function public.create_estimate_from_repair_order(p_repair_order_id uuid)
returns public.estimate_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_currency char(3);
  v_estimate public.estimate_versions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_order from public.repair_orders where id = p_repair_order_id for update;
  if not found then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'estimate.manage') then
    raise exception 'Not authorized to manage estimates for this branch' using errcode = '42501';
  end if;
  if v_order.status not in ('checked_in', 'diagnosis', 'approved', 'on_hold')
     and not (v_order.status in ('in_progress', 'qc', 'ready')
       and not exists (select 1 from public.estimate_versions e where e.repair_order_id = v_order.id)
       and not exists (select 1 from public.invoices i where i.repair_order_id = v_order.id)) then
    raise exception 'This order is not open for pricing' using errcode = '23514';
  end if;
  if exists (select 1 from public.estimate_versions e where e.repair_order_id = v_order.id and e.status in ('draft', 'sent', 'partially_approved')) then
    raise exception 'An active estimate already exists for this repair order' using errcode = '23505';
  end if;
  select b.currency into strict v_currency from public.branches b
  where b.id = v_order.branch_id and b.organization_id = v_order.organization_id;
  insert into public.estimate_versions (
    organization_id, branch_id, repair_order_id, version_no, status, currency, created_by
  ) select v_order.organization_id, v_order.branch_id, v_order.id,
    coalesce(max(e.version_no), 0) + 1, 'draft', v_currency, auth.uid()
  from public.estimate_versions e where e.repair_order_id = v_order.id
  returning * into v_estimate;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_order.organization_id, auth.uid(), 'estimate.created', 'estimate', v_estimate.id, jsonb_build_object('repair_order_id', v_order.id, 'version_no', v_estimate.version_no));
  return v_estimate;
end;
$$;


revoke all on function public.create_estimate_from_repair_order(uuid) from public, anon;
grant execute on function public.create_estimate_from_repair_order(uuid) to authenticated;
