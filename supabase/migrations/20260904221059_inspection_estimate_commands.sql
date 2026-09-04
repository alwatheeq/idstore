-- Transactional inspection and customer-estimate workflow.

create or replace function app_private.recalculate_estimate(p_estimate_id uuid)
returns public.estimate_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estimate public.estimate_versions%rowtype;
begin
  update public.estimate_versions e
  set subtotal = totals.subtotal,
      discount_total = totals.discount_total,
      tax_total = totals.tax_total,
      grand_total = totals.grand_total
  from (
    select coalesce(round(sum(l.quantity * l.unit_price), 3), 0) subtotal,
           coalesce(round(sum(l.discount_amount), 3), 0) discount_total,
           coalesce(round(sum(l.tax_amount), 3), 0) tax_total,
           coalesce(round(sum(l.line_total), 3), 0) grand_total
    from public.estimate_lines l where l.estimate_version_id = p_estimate_id
  ) totals
  where e.id = p_estimate_id
  returning e.* into v_estimate;
  if not found then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  return v_estimate;
end;
$$;

create or replace function public.create_inspection(p_repair_order_id uuid)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_technician_id uuid;
  v_inspection public.inspections%rowtype;
begin
  select * into v_order from public.repair_orders where id = p_repair_order_id for update;
  if not found then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'inspection.perform') then
    raise exception 'Not authorized to inspect vehicles for this branch' using errcode = '42501';
  end if;
  if v_order.status in ('delivered', 'closed', 'cancelled') then
    raise exception 'This repair order can no longer be inspected' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.inspections i
    where i.repair_order_id = v_order.id and i.status in ('draft', 'in_progress')
  ) then raise exception 'An active inspection already exists for this repair order' using errcode = '23505'; end if;

  select t.id into v_technician_id
  from public.technician_profiles t
  where t.organization_id = v_order.organization_id and t.user_id = auth.uid() and t.active
  limit 1;

  insert into public.inspections (
    organization_id, branch_id, repair_order_id, technician_id, status, started_at
  ) values (
    v_order.organization_id, v_order.branch_id, v_order.id, v_technician_id, 'in_progress', now()
  ) returning * into v_inspection;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_order.organization_id, auth.uid(), 'inspection.started', 'inspection', v_inspection.id, jsonb_build_object('repair_order_id', v_order.id));
  return v_inspection;
end;
$$;

create or replace function public.add_inspection_item(
  p_inspection_id uuid,
  p_check_label text,
  p_result text,
  p_finding_text text,
  p_customer_text text,
  p_severity text,
  p_measurement text
)
returns public.inspection_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_item public.inspection_items%rowtype;
  v_severity text;
  v_order_id uuid;
begin
  select * into v_inspection from public.inspections where id = p_inspection_id for update;
  if not found then raise exception 'Inspection not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_inspection.organization_id, v_inspection.branch_id, 'inspection.perform') then
    raise exception 'Not authorized to update this inspection' using errcode = '42501';
  end if;
  if v_inspection.status <> 'in_progress' then raise exception 'Only an active inspection can be changed' using errcode = '23514'; end if;
  if nullif(trim(p_check_label), '') is null or p_result not in ('pass', 'warn', 'fail', 'not_applicable') then
    raise exception 'Inspection check and result are required' using errcode = '22023';
  end if;
  if p_result in ('warn', 'fail') and nullif(trim(p_finding_text), '') is null then
    raise exception 'A finding is required for warning and failed checks' using errcode = '22023';
  end if;

  v_severity := case
    when p_result = 'warn' then coalesce(nullif(p_severity, ''), 'amber')
    when p_result = 'fail' then coalesce(nullif(p_severity, ''), 'red')
    else null
  end;
  if v_severity is not null and v_severity not in ('amber', 'red', 'safety_stop') then
    raise exception 'Finding severity is invalid' using errcode = '22023';
  end if;

  insert into public.inspection_items (
    organization_id, branch_id, inspection_id, sequence, result, measurement_json, finding_text, customer_text
  ) select
    v_inspection.organization_id, v_inspection.branch_id, v_inspection.id,
    coalesce(max(i.sequence), 0) + 1, p_result,
    jsonb_strip_nulls(jsonb_build_object('check', trim(p_check_label), 'measurement', nullif(trim(p_measurement), ''))),
    nullif(trim(p_finding_text), ''), nullif(trim(p_customer_text), '')
  from public.inspection_items i where i.inspection_id = v_inspection.id
  returning * into v_item;

  if v_severity is not null then
    insert into public.findings (organization_id, branch_id, inspection_item_id, severity, status)
    values (v_inspection.organization_id, v_inspection.branch_id, v_item.id, v_severity, 'open');

    select i.repair_order_id into strict v_order_id from public.inspections i where i.id = v_inspection.id;
    update public.repair_orders r
    set risk_state = case
      when v_severity = 'safety_stop' then 'quarantine'
      when v_severity = 'red' and r.risk_state = 'normal' then 'restricted'
      else r.risk_state
    end
    where r.id = v_order_id;
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_inspection.organization_id, auth.uid(), 'inspection.item_added', 'inspection', v_inspection.id, jsonb_build_object('item_id', v_item.id, 'result', p_result, 'severity', v_severity));
  return v_item;
end;
$$;

create or replace function public.remove_inspection_item(p_inspection_item_id uuid)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inspection_items%rowtype;
  v_inspection public.inspections%rowtype;
begin
  select * into v_item from public.inspection_items where id = p_inspection_item_id;
  if not found then raise exception 'Inspection item not found' using errcode = 'P0002'; end if;
  select * into strict v_inspection from public.inspections where id = v_item.inspection_id for update;
  if not app_private.has_permission(v_inspection.organization_id, v_inspection.branch_id, 'inspection.perform') then
    raise exception 'Not authorized to update this inspection' using errcode = '42501';
  end if;
  if v_inspection.status <> 'in_progress' then raise exception 'Completed inspections are immutable' using errcode = '23514'; end if;
  delete from public.inspection_items where id = v_item.id;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_inspection.organization_id, auth.uid(), 'inspection.item_removed', 'inspection', v_inspection.id, jsonb_build_object('item_id', v_item.id));
  return v_inspection;
end;
$$;

create or replace function public.complete_inspection(p_inspection_id uuid)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
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
  update public.inspections set status = 'completed', completed_at = now() where id = v_inspection.id returning * into v_inspection;
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
  if v_order.status in ('delivered', 'closed', 'cancelled') then raise exception 'This repair order cannot be estimated' using errcode = '23514'; end if;
  if exists (select 1 from public.estimate_versions e where e.repair_order_id = v_order.id and e.status in ('draft', 'sent', 'partially_approved')) then
    raise exception 'An active estimate already exists for this repair order' using errcode = '23505';
  end if;
  select b.currency into strict v_currency from public.branches b where b.id = v_order.branch_id and b.organization_id = v_order.organization_id;
  insert into public.estimate_versions (organization_id, branch_id, repair_order_id, version_no, status, currency, created_by)
  select v_order.organization_id, v_order.branch_id, v_order.id, coalesce(max(e.version_no), 0) + 1, 'draft', v_currency, auth.uid()
  from public.estimate_versions e where e.repair_order_id = v_order.id
  returning * into v_estimate;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_order.organization_id, auth.uid(), 'estimate.created', 'estimate', v_estimate.id, jsonb_build_object('repair_order_id', v_order.id, 'version_no', v_estimate.version_no));
  return v_estimate;
end;
$$;

create or replace function public.add_estimate_line(
  p_estimate_id uuid,
  p_line_type text,
  p_description text,
  p_quantity numeric,
  p_unit_price numeric,
  p_discount_amount numeric,
  p_tax_rate numeric,
  p_approval_group text,
  p_finding_id uuid
)
returns public.estimate_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estimate public.estimate_versions%rowtype;
  v_line public.estimate_lines%rowtype;
  v_base numeric(18,3);
  v_discount numeric(18,3);
  v_tax numeric(18,3);
begin
  select * into v_estimate from public.estimate_versions where id = p_estimate_id for update;
  if not found then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_estimate.organization_id, v_estimate.branch_id, 'estimate.manage') then
    raise exception 'Not authorized to update this estimate' using errcode = '42501';
  end if;
  if v_estimate.status <> 'draft' then raise exception 'Only draft estimates can be changed' using errcode = '23514'; end if;
  if p_line_type not in ('labor', 'part', 'fee', 'discount', 'warranty', 'goodwill', 'text')
     or nullif(trim(p_description), '') is null or p_quantity is null or p_quantity <= 0
     or p_unit_price is null or p_unit_price < 0 or p_discount_amount is null or p_discount_amount < 0
     or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Estimate line values are invalid' using errcode = '22023';
  end if;
  if p_finding_id is not null and not exists (
    select 1 from public.findings f
    join public.inspection_items ii on ii.id = f.inspection_item_id
    join public.inspections i on i.id = ii.inspection_id
    where f.id = p_finding_id and i.repair_order_id = v_estimate.repair_order_id
      and f.organization_id = v_estimate.organization_id and f.status in ('open', 'estimated')
  ) then raise exception 'Finding does not belong to this repair order' using errcode = '23514'; end if;
  if p_finding_id is not null and exists (select 1 from public.estimate_lines l where l.estimate_version_id = v_estimate.id and l.source_id = p_finding_id) then
    raise exception 'This finding is already included in the estimate' using errcode = '23505';
  end if;

  v_base := round(p_quantity * p_unit_price, 3);
  v_discount := round(p_discount_amount, 3);
  if v_discount > v_base then raise exception 'Line discount exceeds its gross value' using errcode = '22023'; end if;
  v_tax := round((v_base - v_discount) * p_tax_rate / 100, 3);
  insert into public.estimate_lines (
    organization_id, branch_id, estimate_version_id, line_no, line_type, source_id,
    description_snapshot, quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total, approval_group
  ) select v_estimate.organization_id, v_estimate.branch_id, v_estimate.id,
    coalesce(max(l.line_no), 0) + 1, p_line_type, p_finding_id, trim(p_description),
    p_quantity, p_unit_price, v_discount, p_tax_rate, v_tax, v_base - v_discount + v_tax,
    coalesce(nullif(trim(p_approval_group), ''), 'General')
  from public.estimate_lines l where l.estimate_version_id = v_estimate.id
  returning * into v_line;
  if p_finding_id is not null then update public.findings set status = 'estimated' where id = p_finding_id; end if;
  perform app_private.recalculate_estimate(v_estimate.id);
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_estimate.organization_id, auth.uid(), 'estimate.line_added', 'estimate', v_estimate.id, jsonb_build_object('line_id', v_line.id, 'finding_id', p_finding_id));
  return v_line;
end;
$$;

create or replace function public.remove_estimate_line(p_estimate_line_id uuid)
returns public.estimate_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.estimate_lines%rowtype;
  v_estimate public.estimate_versions%rowtype;
begin
  select * into v_line from public.estimate_lines where id = p_estimate_line_id;
  if not found then raise exception 'Estimate line not found' using errcode = 'P0002'; end if;
  select * into strict v_estimate from public.estimate_versions where id = v_line.estimate_version_id for update;
  if not app_private.has_permission(v_estimate.organization_id, v_estimate.branch_id, 'estimate.manage') then
    raise exception 'Not authorized to update this estimate' using errcode = '42501';
  end if;
  if v_estimate.status <> 'draft' then raise exception 'Sent estimates are immutable' using errcode = '23514'; end if;
  delete from public.estimate_lines where id = v_line.id;
  if v_line.source_id is not null and not exists (select 1 from public.estimate_lines l where l.source_id = v_line.source_id) then
    update public.findings set status = 'open' where id = v_line.source_id and status = 'estimated';
  end if;
  v_estimate := app_private.recalculate_estimate(v_estimate.id);
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_estimate.organization_id, auth.uid(), 'estimate.line_removed', 'estimate', v_estimate.id, jsonb_build_object('line_id', v_line.id));
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
  if v_order.status = 'diagnosis' then
    update public.repair_orders set status = 'awaiting_approval' where id = v_order.id;
    insert into public.repair_order_events (organization_id, branch_id, repair_order_id, from_status, to_status, reason, actor_id)
    values (v_order.organization_id, v_order.branch_id, v_order.id, 'diagnosis', 'awaiting_approval', 'Estimate sent', auth.uid());
  end if;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_estimate.organization_id, auth.uid(), 'estimate.sent', 'estimate', v_estimate.id, jsonb_build_object('valid_days', p_valid_days, 'document_hash', v_estimate.document_hash));
  return v_estimate;
end;
$$;

create or replace function public.record_estimate_decision(
  p_estimate_id uuid,
  p_decision text,
  p_actor_name text,
  p_channel text,
  p_evidence_note text
)
returns public.estimate_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estimate public.estimate_versions%rowtype;
  v_order public.repair_orders%rowtype;
  v_to_order_status text;
begin
  select * into v_estimate from public.estimate_versions where id = p_estimate_id for update;
  if not found then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_estimate.organization_id, v_estimate.branch_id, 'estimate.manage') then
    raise exception 'Not authorized to record this estimate decision' using errcode = '42501';
  end if;
  if v_estimate.status <> 'sent' or p_decision not in ('approved', 'declined')
     or nullif(trim(p_actor_name), '') is null or p_channel not in ('phone', 'whatsapp', 'email', 'in_person', 'portal') then
    raise exception 'Decision evidence is incomplete or the estimate is not awaiting a decision' using errcode = '22023';
  end if;

  insert into public.estimate_approvals (
    organization_id, branch_id, estimate_version_id, decision, actor_name, channel, evidence_json
  ) values (
    v_estimate.organization_id, v_estimate.branch_id, v_estimate.id, p_decision, trim(p_actor_name), p_channel,
    jsonb_strip_nulls(jsonb_build_object('note', nullif(trim(p_evidence_note), ''), 'recorded_by', auth.uid()))
  );
  update public.estimate_versions set status = p_decision where id = v_estimate.id returning * into v_estimate;
  update public.findings f set status = p_decision
  where f.id in (select l.source_id from public.estimate_lines l where l.estimate_version_id = v_estimate.id and l.source_id is not null);

  select * into strict v_order from public.repair_orders where id = v_estimate.repair_order_id for update;
  if v_order.status = 'awaiting_approval' then
    v_to_order_status := case when p_decision = 'approved' then 'approved' else 'diagnosis' end;
    update public.repair_orders set status = v_to_order_status where id = v_order.id;
    insert into public.repair_order_events (organization_id, branch_id, repair_order_id, from_status, to_status, reason, actor_id)
    values (v_order.organization_id, v_order.branch_id, v_order.id, 'awaiting_approval', v_to_order_status, 'Customer ' || p_decision || ' estimate', auth.uid());
  end if;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_estimate.organization_id, auth.uid(), 'estimate.' || p_decision, 'estimate', v_estimate.id, jsonb_build_object('actor_name', trim(p_actor_name), 'channel', p_channel));
  return v_estimate;
end;
$$;

revoke all on function app_private.recalculate_estimate(uuid) from public, anon, authenticated;
revoke all on function public.create_inspection(uuid) from public, anon, authenticated;
revoke all on function public.add_inspection_item(uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.remove_inspection_item(uuid) from public, anon, authenticated;
revoke all on function public.complete_inspection(uuid) from public, anon, authenticated;
revoke all on function public.create_estimate_from_repair_order(uuid) from public, anon, authenticated;
revoke all on function public.add_estimate_line(uuid, text, text, numeric, numeric, numeric, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.remove_estimate_line(uuid) from public, anon, authenticated;
revoke all on function public.send_estimate(uuid, integer) from public, anon, authenticated;
revoke all on function public.record_estimate_decision(uuid, text, text, text, text) from public, anon, authenticated;

grant execute on function public.create_inspection(uuid) to authenticated;
grant execute on function public.add_inspection_item(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.remove_inspection_item(uuid) to authenticated;
grant execute on function public.complete_inspection(uuid) to authenticated;
grant execute on function public.create_estimate_from_repair_order(uuid) to authenticated;
grant execute on function public.add_estimate_line(uuid, text, text, numeric, numeric, numeric, numeric, text, uuid) to authenticated;
grant execute on function public.remove_estimate_line(uuid) to authenticated;
grant execute on function public.send_estimate(uuid, integer) to authenticated;
grant execute on function public.record_estimate_decision(uuid, text, text, text, text) to authenticated;

comment on function public.create_inspection is 'Starts one permission-checked inspection for an active repair order.';
comment on function public.add_inspection_item is 'Adds a check and atomically creates its finding and repair-order risk escalation.';
comment on function public.complete_inspection is 'Locks a populated inspection as completed.';
comment on function public.create_estimate_from_repair_order is 'Creates the next draft estimate version for an active repair order.';
comment on function public.add_estimate_line is 'Adds and totals a draft estimate line, optionally linked to an inspection finding.';
comment on function public.send_estimate is 'Locks and hashes a populated estimate, then moves its repair order to customer approval.';
comment on function public.record_estimate_decision is 'Records customer decision evidence and advances both estimate and repair-order state.';
