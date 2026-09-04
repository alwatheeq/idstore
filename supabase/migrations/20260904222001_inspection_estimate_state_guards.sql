-- Keep inspection, estimate and repair-order state transitions synchronized.

create or replace function public.complete_inspection(p_inspection_id uuid)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_order public.repair_orders%rowtype;
begin
  select * into v_inspection from public.inspections where id = p_inspection_id for update;
  if not found then raise exception 'Inspection not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_inspection.organization_id, v_inspection.branch_id, 'inspection.perform') then
    raise exception 'Not authorized to complete this inspection' using errcode = '42501';
  end if;
  if v_inspection.status <> 'in_progress' then raise exception 'Only an active inspection can be completed' using errcode = '23514'; end if;
  if not exists (select 1 from public.inspection_items i where i.inspection_id = v_inspection.id) then
    raise exception 'Add at least one completed check before finishing the inspection' using errcode = '23514';
  end if;

  update public.inspections set status = 'completed', completed_at = now()
  where id = v_inspection.id returning * into v_inspection;

  select * into strict v_order from public.repair_orders where id = v_inspection.repair_order_id for update;
  if v_order.status = 'checked_in' then
    update public.repair_orders set status = 'diagnosis' where id = v_order.id;
    insert into public.repair_order_events (
      organization_id, branch_id, repair_order_id, from_status, to_status, reason, actor_id
    ) values (
      v_order.organization_id, v_order.branch_id, v_order.id, 'checked_in', 'diagnosis', 'Vehicle inspection completed', auth.uid()
    );
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_inspection.organization_id, auth.uid(), 'inspection.completed', 'inspection', v_inspection.id, jsonb_build_object('repair_order_id', v_inspection.repair_order_id));
  return v_inspection;
end;
$$;

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
  select * into v_order from public.repair_orders where id = p_repair_order_id for update;
  if not found then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'estimate.manage') then
    raise exception 'Not authorized to manage estimates for this branch' using errcode = '42501';
  end if;
  if v_order.status not in ('diagnosis', 'approved', 'on_hold') then
    raise exception 'Move the repair order to diagnosis or hold before creating an estimate' using errcode = '23514';
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

create or replace function public.send_estimate(p_estimate_id uuid, p_valid_days integer)
returns public.estimate_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estimate public.estimate_versions%rowtype;
  v_order public.repair_orders%rowtype;
begin
  select * into v_estimate from public.estimate_versions where id = p_estimate_id for update;
  if not found then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_estimate.organization_id, v_estimate.branch_id, 'estimate.manage') then
    raise exception 'Not authorized to send this estimate' using errcode = '42501';
  end if;
  if v_estimate.status <> 'draft' or p_valid_days is null or p_valid_days < 1 or p_valid_days > 90 then
    raise exception 'Estimate state or validity period is invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from public.estimate_lines l where l.estimate_version_id = v_estimate.id) then
    raise exception 'Add at least one line before sending the estimate' using errcode = '23514';
  end if;
  v_estimate := app_private.recalculate_estimate(v_estimate.id);
  update public.estimate_versions e
  set status = 'sent', sent_at = now(), expires_at = now() + make_interval(days => p_valid_days),
      document_hash = encode(extensions.digest(concat_ws('|', e.id::text, e.version_no::text, e.currency, e.subtotal::text, e.discount_total::text, e.tax_total::text, e.grand_total::text,
        (select string_agg(concat_ws(':', l.line_no::text, l.description_snapshot, l.quantity::text, l.unit_price::text, l.discount_amount::text, l.tax_rate::text, l.line_total::text), '|' order by l.line_no) from public.estimate_lines l where l.estimate_version_id = e.id)), 'sha256'), 'hex')
  where e.id = v_estimate.id returning * into v_estimate;

  select * into strict v_order from public.repair_orders where id = v_estimate.repair_order_id for update;
  if v_order.status in ('diagnosis', 'approved', 'on_hold') then
    update public.repair_orders set status = 'awaiting_approval' where id = v_order.id;
    insert into public.repair_order_events (
      organization_id, branch_id, repair_order_id, from_status, to_status, reason, actor_id
    ) values (
      v_order.organization_id, v_order.branch_id, v_order.id, v_order.status, 'awaiting_approval', 'Estimate sent', auth.uid()
    );
  else
    raise exception 'Repair order is not ready for customer approval' using errcode = '23514';
  end if;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_estimate.organization_id, auth.uid(), 'estimate.sent', 'estimate', v_estimate.id, jsonb_build_object('valid_days', p_valid_days, 'document_hash', v_estimate.document_hash));
  return v_estimate;
end;
$$;

revoke all on function public.complete_inspection(uuid) from public, anon, authenticated;
revoke all on function public.create_estimate_from_repair_order(uuid) from public, anon, authenticated;
revoke all on function public.send_estimate(uuid, integer) from public, anon, authenticated;
grant execute on function public.complete_inspection(uuid) to authenticated;
grant execute on function public.create_estimate_from_repair_order(uuid) to authenticated;
grant execute on function public.send_estimate(uuid, integer) to authenticated;
