-- High-voltage work is controlled by short-lived permits and current,
-- verified technician qualifications. Direct table writes remain unavailable.

create or replace function app_private.technician_has_qualification(
  p_organization_id uuid,
  p_user_id uuid,
  p_qualification_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.technician_profiles tp
    join public.technician_qualifications tq on tq.technician_id = tp.id
    join public.qualification_types qt on qt.id = tq.qualification_type_id
    where tp.organization_id = p_organization_id
      and tp.user_id = p_user_id
      and tp.active
      and qt.organization_id = p_organization_id
      and qt.code = upper(trim(p_qualification_code))
      and tq.verified_at is not null
      and tq.valid_from <= current_date
      and (tq.valid_to is null or tq.valid_to >= current_date)
  );
$$;

create or replace function app_private.hv_check_passed(
  p_permit_id uuid,
  p_check_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.result = 'pass'
    from public.hv_permit_checks c
    where c.permit_id = p_permit_id
      and c.check_code = p_check_code
    order by c.occurred_at desc, c.id desc
    limit 1
  ), false);
$$;

revoke all on function app_private.technician_has_qualification(uuid, uuid, text) from public, anon, authenticated;
revoke all on function app_private.hv_check_passed(uuid, text) from public, anon, authenticated;

create or replace function public.create_qualification_type(
  p_organization_id uuid,
  p_code text,
  p_name text,
  p_scope_json jsonb
)
returns public.qualification_types
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.qualification_types%rowtype;
begin
  if not app_private.has_permission(p_organization_id, null, 'staff.manage') then
    raise exception 'Not authorized to manage technician qualifications' using errcode = '42501';
  end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'Qualification code and name are required' using errcode = '22023';
  end if;

  insert into public.qualification_types (organization_id, code, name, scope_json)
  values (p_organization_id, upper(trim(p_code)), trim(p_name), coalesce(p_scope_json, '{}'::jsonb))
  returning * into v_type;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'qualification_type.created', 'qualification_type', v_type.id,
    jsonb_build_object('code', v_type.code));
  return v_type;
end;
$$;

create or replace function public.grant_technician_qualification(
  p_technician_id uuid,
  p_qualification_type_id uuid,
  p_issuer text,
  p_certificate_reference text,
  p_valid_from date,
  p_valid_to date
)
returns public.technician_qualifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_technician public.technician_profiles%rowtype;
  v_type public.qualification_types%rowtype;
  v_qualification public.technician_qualifications%rowtype;
begin
  select * into v_technician from public.technician_profiles where id = p_technician_id;
  if not found then raise exception 'Technician not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_technician.organization_id, null, 'staff.manage') then
    raise exception 'Not authorized to manage technician qualifications' using errcode = '42501';
  end if;
  select * into v_type from public.qualification_types
  where id = p_qualification_type_id and organization_id = v_technician.organization_id;
  if not found then raise exception 'Qualification type not found' using errcode = 'P0002'; end if;
  if not v_technician.active or nullif(trim(p_issuer), '') is null or p_valid_from is null
     or (p_valid_to is not null and p_valid_to < p_valid_from) then
    raise exception 'Active technician, issuer and a valid date range are required' using errcode = '22023';
  end if;

  insert into public.technician_qualifications (
    organization_id, technician_id, qualification_type_id, issuer,
    certificate_reference, valid_from, valid_to, verified_at, verified_by
  ) values (
    v_technician.organization_id, v_technician.id, v_type.id, trim(p_issuer),
    nullif(trim(p_certificate_reference), ''), p_valid_from, p_valid_to, clock_timestamp(), auth.uid()
  ) returning * into v_qualification;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_technician.organization_id, auth.uid(), 'technician_qualification.granted', 'technician_qualification', v_qualification.id,
    jsonb_build_object('technician_id', v_technician.id, 'qualification_code', v_type.code, 'valid_to', v_qualification.valid_to));
  return v_qualification;
end;
$$;

create or replace function public.create_hv_work_permit(
  p_job_id uuid,
  p_procedure_ref text,
  p_risk_json jsonb,
  p_valid_from timestamptz,
  p_valid_to timestamptz
)
returns public.hv_work_permits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_permit public.hv_work_permits%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_job.organization_id, v_job.branch_id, 'hv_permit.authorize') then
    raise exception 'Not authorized to manage high-voltage permits' using errcode = '42501';
  end if;
  if v_job.safety_class not in ('hv_isolated', 'hv_battery_open') then
    raise exception 'A high-voltage permit can only be created for an HV job' using errcode = '22023';
  end if;
  if v_job.required_qualification_code is null then
    raise exception 'The HV job must specify its required qualification' using errcode = '23514';
  end if;
  if v_job.status in ('in_progress', 'qc', 'completed', 'cancelled') then
    raise exception 'A permit cannot be created for this job state' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.branch_capabilities c
    where c.organization_id = v_job.organization_id and c.branch_id = v_job.branch_id
      and c.capability_code = 'HV_SERVICE' and c.status = 'active'
      and c.valid_from <= current_date and (c.valid_to is null or c.valid_to >= current_date)
  ) then
    raise exception 'This branch is not approved for high-voltage service' using errcode = '23514';
  end if;
  if nullif(trim(p_procedure_ref), '') is null or p_valid_from is null or p_valid_to is null
     or p_valid_to <= p_valid_from or p_valid_to > p_valid_from + interval '24 hours' then
    raise exception 'Procedure and a permit window of no more than 24 hours are required' using errcode = '22023';
  end if;

  insert into public.hv_work_permits (
    organization_id, branch_id, repair_order_id, job_id, procedure_ref,
    risk_json, valid_from, valid_to
  ) values (
    v_job.organization_id, v_job.branch_id, v_job.repair_order_id, v_job.id, trim(p_procedure_ref),
    coalesce(p_risk_json, '{}'::jsonb), p_valid_from, p_valid_to
  ) returning * into v_permit;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_job.organization_id, auth.uid(), 'hv_permit.created', 'hv_work_permit', v_permit.id,
    jsonb_build_object('job_id', v_job.id, 'procedure_ref', v_permit.procedure_ref));
  return v_permit;
end;
$$;

create or replace function public.record_hv_permit_check(
  p_permit_id uuid,
  p_check_code text,
  p_result text,
  p_witness_id uuid,
  p_tool_ref text
)
returns public.hv_permit_checks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permit public.hv_work_permits%rowtype;
  v_job public.jobs%rowtype;
  v_check public.hv_permit_checks%rowtype;
  v_code text := lower(trim(p_check_code));
begin
  select * into v_permit from public.hv_work_permits where id = p_permit_id for update;
  if not found then raise exception 'HV permit not found' using errcode = 'P0002'; end if;
  select * into v_job from public.jobs where id = v_permit.job_id;
  if not app_private.has_permission(v_permit.organization_id, v_permit.branch_id, 'hv_permit.authorize') then
    raise exception 'Not authorized to record high-voltage checks' using errcode = '42501';
  end if;
  if not app_private.technician_has_qualification(v_permit.organization_id, auth.uid(), v_job.required_qualification_code) then
    raise exception 'A current verified technician qualification is required' using errcode = '23514';
  end if;
  if v_permit.state in ('closed', 'revoked') then
    raise exception 'Closed or revoked permits cannot be changed' using errcode = '23514';
  end if;
  if v_code not in ('scope_review', 'emergency_plan', 'vehicle_secured', 'ignition_disabled', 'lockout_tagout', 'absence_of_voltage', 'work_area_clear', 'battery_enclosure_closed', 'reenergization_test', 'vehicle_safe')
     or p_result not in ('pass', 'fail', 'not_applicable') then
    raise exception 'HV check code or result is invalid' using errcode = '22023';
  end if;
  if (v_code in ('scope_review', 'emergency_plan') and v_permit.state not in ('draft', 'risk_review'))
     or (v_code in ('vehicle_secured', 'ignition_disabled', 'lockout_tagout', 'absence_of_voltage') and v_permit.state <> 'authorized')
     or (v_code in ('work_area_clear', 'battery_enclosure_closed') and v_permit.state <> 'work_active')
     or (v_code in ('reenergization_test', 'vehicle_safe') and v_permit.state <> 'reenergization_check') then
    raise exception 'This check is not available in the current permit state' using errcode = '23514';
  end if;
  if v_code in ('absence_of_voltage', 'reenergization_test') and (
    p_witness_id is null or p_witness_id = auth.uid() or nullif(trim(p_tool_ref), '') is null
  ) then
    raise exception 'This check requires an independent witness and test-tool reference' using errcode = '23514';
  end if;
  if p_witness_id is not null and not exists (
    select 1 from public.memberships m
    where m.organization_id = v_permit.organization_id and m.user_id = p_witness_id and m.status = 'active'
  ) then
    raise exception 'Witness must be an active member of this organization' using errcode = '23514';
  end if;

  insert into public.hv_permit_checks (
    organization_id, branch_id, permit_id, check_code, result, actor_id, witness_id, tool_ref
  ) values (
    v_permit.organization_id, v_permit.branch_id, v_permit.id, v_code, p_result,
    auth.uid(), p_witness_id, nullif(trim(p_tool_ref), '')
  ) returning * into v_check;

  if p_result = 'fail' then
    update public.repair_orders set risk_state = 'quarantine' where id = v_permit.repair_order_id;
    if v_permit.state in ('authorized', 'isolated', 'work_active', 'reenergization_check') then
      update public.hv_work_permits set state = 'revoked' where id = v_permit.id;
      update public.labor_entries
        set ended_at = greatest(clock_timestamp(), started_at + interval '1 millisecond'), pause_reason = 'HV permit revoked'
        where job_id = v_job.id and ended_at is null;
      update public.jobs set status = 'blocked' where id = v_job.id and status = 'in_progress';
    end if;
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_permit.organization_id, auth.uid(), 'hv_permit.check_recorded', 'hv_work_permit', v_permit.id,
    jsonb_build_object('check_id', v_check.id, 'check_code', v_code, 'result', p_result, 'witness_id', p_witness_id));
  return v_check;
end;
$$;

create or replace function public.transition_hv_work_permit(
  p_permit_id uuid,
  p_to_state text
)
returns public.hv_work_permits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permit public.hv_work_permits%rowtype;
  v_job public.jobs%rowtype;
  v_required text[];
  v_code text;
  v_from_state text;
begin
  select * into v_permit from public.hv_work_permits where id = p_permit_id for update;
  if not found then raise exception 'HV permit not found' using errcode = 'P0002'; end if;
  v_from_state := v_permit.state;
  select * into v_job from public.jobs where id = v_permit.job_id for update;
  if not app_private.has_permission(v_permit.organization_id, v_permit.branch_id, 'hv_permit.authorize') then
    raise exception 'Not authorized to manage high-voltage permits' using errcode = '42501';
  end if;
  if v_permit.state in ('closed', 'revoked') then
    raise exception 'Closed or revoked permits cannot be changed' using errcode = '23514';
  end if;
  if p_to_state = 'revoked' then
    update public.hv_work_permits set state = 'revoked' where id = v_permit.id returning * into v_permit;
    update public.repair_orders set risk_state = 'quarantine' where id = v_permit.repair_order_id;
    update public.labor_entries
      set ended_at = greatest(clock_timestamp(), started_at + interval '1 millisecond'), pause_reason = 'HV permit revoked'
      where job_id = v_job.id and ended_at is null;
    update public.jobs set status = 'blocked' where id = v_job.id and status = 'in_progress';
  else
    if not app_private.technician_has_qualification(v_permit.organization_id, auth.uid(), v_job.required_qualification_code) then
      raise exception 'A current verified technician qualification is required' using errcode = '23514';
    end if;
    if clock_timestamp() < v_permit.valid_from or clock_timestamp() >= v_permit.valid_to then
      raise exception 'The permit is outside its valid time window' using errcode = '23514';
    end if;
    if not (
      (v_permit.state = 'draft' and p_to_state = 'risk_review')
      or (v_permit.state = 'risk_review' and p_to_state = 'authorized')
      or (v_permit.state = 'authorized' and p_to_state = 'isolated')
      or (v_permit.state = 'isolated' and p_to_state = 'work_active')
      or (v_permit.state = 'work_active' and p_to_state = 'reenergization_check')
      or (v_permit.state = 'reenergization_check' and p_to_state = 'closed')
    ) then
      raise exception 'Invalid high-voltage permit transition' using errcode = '22023';
    end if;

    v_required := case p_to_state
      when 'authorized' then array['scope_review', 'emergency_plan']
      when 'isolated' then array['vehicle_secured', 'ignition_disabled', 'lockout_tagout', 'absence_of_voltage']
      when 'reenergization_check' then array['work_area_clear', 'battery_enclosure_closed']
      when 'closed' then array['reenergization_test', 'vehicle_safe']
      else array[]::text[]
    end;
    foreach v_code in array v_required loop
      if not app_private.hv_check_passed(v_permit.id, v_code) then
        raise exception 'Required HV check is not passed: %', replace(v_code, '_', ' ') using errcode = '23514';
      end if;
    end loop;

    update public.hv_work_permits
    set state = p_to_state,
        authorized_by = case when p_to_state = 'authorized' then auth.uid() else authorized_by end
    where id = v_permit.id returning * into v_permit;
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_permit.organization_id, auth.uid(), 'hv_permit.transitioned', 'hv_work_permit', v_permit.id,
    jsonb_build_object('from_state', v_from_state, 'to_state', p_to_state, 'job_id', v_job.id));
  return v_permit;
end;
$$;

-- HV jobs must declare a real organization qualification code before dispatch.
create or replace function public.create_job(
  p_repair_order_id uuid,
  p_description text,
  p_operation_code text,
  p_safety_class text,
  p_required_qualification_code text,
  p_planned_minutes integer
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_job public.jobs%rowtype;
  v_qualification_code text := nullif(upper(trim(p_required_qualification_code)), '');
begin
  select * into v_order from public.repair_orders where id = p_repair_order_id for update;
  if not found then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'workshop.dispatch') then
    raise exception 'Not authorized to dispatch workshop jobs' using errcode = '42501';
  end if;
  if v_order.status in ('ready', 'delivered', 'closed', 'cancelled') then
    raise exception 'Jobs cannot be added to this repair order state' using errcode = '22023';
  end if;
  if nullif(trim(p_description), '') is null
     or p_safety_class not in ('normal', 'ev_aware', 'hv_isolated', 'hv_battery_open')
     or p_planned_minutes is null or p_planned_minutes < 0 or p_planned_minutes > 1440 then
    raise exception 'Description, safety class and planned minutes are invalid' using errcode = '22023';
  end if;
  if p_safety_class in ('hv_isolated', 'hv_battery_open') and v_qualification_code is null then
    raise exception 'HV jobs require a qualification code' using errcode = '23514';
  end if;
  if v_qualification_code is not null and not exists (
    select 1 from public.qualification_types qt
    where qt.organization_id = v_order.organization_id and qt.code = v_qualification_code
  ) then
    raise exception 'Qualification code is not configured for this organization' using errcode = '23514';
  end if;
  if p_safety_class in ('hv_isolated', 'hv_battery_open') and not exists (
    select 1 from public.branch_capabilities c
    where c.organization_id = v_order.organization_id and c.branch_id = v_order.branch_id
      and c.capability_code = 'HV_SERVICE' and c.status = 'active'
      and c.valid_from <= current_date and (c.valid_to is null or c.valid_to >= current_date)
  ) then
    raise exception 'This branch is not approved for high-voltage service' using errcode = '23514';
  end if;

  insert into public.jobs (
    organization_id, branch_id, repair_order_id, operation_code, description_snapshot,
    status, safety_class, required_qualification_code, planned_minutes
  ) values (
    v_order.organization_id, v_order.branch_id, v_order.id,
    nullif(upper(trim(p_operation_code)), ''), trim(p_description), 'ready', p_safety_class,
    v_qualification_code, p_planned_minutes
  ) returning * into v_job;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_job.organization_id, auth.uid(), 'job.created', 'job', v_job.id,
    jsonb_build_object('repair_order_id', v_job.repair_order_id, 'safety_class', v_job.safety_class));
  return v_job;
end;
$$;

-- A timer may only run after isolation is confirmed and the permit is explicitly active.
create or replace function public.start_job(
  p_job_id uuid,
  p_expected_version bigint
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_technician public.technician_profiles%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_job.organization_id, v_job.branch_id, 'job.perform') then
    raise exception 'Not authorized to perform this job' using errcode = '42501';
  end if;
  if v_job.version <> p_expected_version then
    raise exception 'Job changed; refresh before starting' using errcode = '40001';
  end if;
  if v_job.status not in ('assigned', 'paused') then
    raise exception 'Only assigned or paused jobs can be started' using errcode = '22023';
  end if;

  select * into v_technician from public.technician_profiles
  where organization_id = v_job.organization_id and user_id = auth.uid() and active;
  if not found or not exists (
    select 1 from public.job_assignments a
    where a.job_id = v_job.id and a.technician_id = v_technician.id and a.unassigned_at is null
  ) then
    raise exception 'This job is not assigned to the current technician' using errcode = '42501';
  end if;
  if v_job.required_qualification_code is not null and not app_private.technician_has_qualification(
    v_job.organization_id, auth.uid(), v_job.required_qualification_code
  ) then
    raise exception 'Required technician qualification is not current' using errcode = '23514';
  end if;
  if v_job.safety_class in ('hv_isolated', 'hv_battery_open') and not exists (
    select 1 from public.hv_work_permits p
    where p.job_id = v_job.id and p.state = 'work_active'
      and p.valid_from <= clock_timestamp() and p.valid_to > clock_timestamp()
  ) then
    raise exception 'A valid work-active high-voltage permit is required' using errcode = '23514';
  end if;
  if exists (select 1 from public.labor_entries l where l.technician_id = v_technician.id and l.ended_at is null) then
    raise exception 'Technician already has an active timer' using errcode = '23514';
  end if;

  insert into public.labor_entries (organization_id, branch_id, job_id, technician_id, started_at, source)
  values (v_job.organization_id, v_job.branch_id, v_job.id, v_technician.id, clock_timestamp(), 'timer');
  update public.jobs set status = 'in_progress', started_at = coalesce(started_at, clock_timestamp())
  where id = v_job.id returning * into v_job;
  return v_job;
end;
$$;

create or replace function public.finish_job(
  p_job_id uuid,
  p_expected_version bigint,
  p_outcome text,
  p_note text
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_technician public.technician_profiles%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_job.organization_id, v_job.branch_id, 'job.perform') then
    raise exception 'Not authorized to perform this job' using errcode = '42501';
  end if;
  if v_job.version <> p_expected_version then raise exception 'Job changed; refresh before stopping' using errcode = '40001'; end if;
  if v_job.status <> 'in_progress' or p_outcome not in ('paused', 'blocked', 'qc', 'completed') then
    raise exception 'Job state or outcome is invalid' using errcode = '22023';
  end if;

  select * into v_technician from public.technician_profiles
  where organization_id = v_job.organization_id and user_id = auth.uid() and active;
  if not found or not exists (
    select 1 from public.job_assignments a
    where a.job_id = v_job.id and a.technician_id = v_technician.id and a.unassigned_at is null
  ) then
    raise exception 'This job is not assigned to the current technician' using errcode = '42501';
  end if;
  if p_outcome in ('qc', 'completed') and v_job.safety_class in ('hv_isolated', 'hv_battery_open') and not exists (
    select 1 from public.hv_work_permits p where p.job_id = v_job.id and p.state = 'closed'
  ) then
    raise exception 'Close the high-voltage permit before QC or completion' using errcode = '23514';
  end if;

  update public.labor_entries
  set ended_at = greatest(clock_timestamp(), started_at + interval '1 millisecond'),
      pause_reason = case when p_outcome in ('paused', 'blocked') then nullif(trim(p_note), '') else null end
  where job_id = v_job.id and technician_id = v_technician.id and ended_at is null;
  if not found then raise exception 'No active timer exists for this job' using errcode = '23514'; end if;

  update public.jobs set status = p_outcome,
    completed_at = case when p_outcome = 'completed' then clock_timestamp() else null end
  where id = v_job.id returning * into v_job;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_job.organization_id, auth.uid(), 'job.timer_stopped', 'job', v_job.id,
    jsonb_build_object('outcome', p_outcome, 'note', nullif(trim(p_note), '')));
  return v_job;
end;
$$;

revoke all on function public.create_qualification_type(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.grant_technician_qualification(uuid, uuid, text, text, date, date) from public, anon, authenticated;
revoke all on function public.create_hv_work_permit(uuid, text, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.record_hv_permit_check(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.transition_hv_work_permit(uuid, text) from public, anon, authenticated;
revoke all on function public.create_job(uuid, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.start_job(uuid, bigint) from public, anon, authenticated;
revoke all on function public.finish_job(uuid, bigint, text, text) from public, anon, authenticated;

grant execute on function public.create_qualification_type(uuid, text, text, jsonb) to authenticated;
grant execute on function public.grant_technician_qualification(uuid, uuid, text, text, date, date) to authenticated;
grant execute on function public.create_hv_work_permit(uuid, text, jsonb, timestamptz, timestamptz) to authenticated;
grant execute on function public.record_hv_permit_check(uuid, text, text, uuid, text) to authenticated;
grant execute on function public.transition_hv_work_permit(uuid, text) to authenticated;
grant execute on function public.create_job(uuid, text, text, text, text, integer) to authenticated;
grant execute on function public.start_job(uuid, bigint) to authenticated;
grant execute on function public.finish_job(uuid, bigint, text, text) to authenticated;

comment on function public.create_hv_work_permit(uuid, text, jsonb, timestamptz, timestamptz)
  is 'Authenticated HV permit command; authorization, branch capability and job scope are checked in-function.';
comment on function public.record_hv_permit_check(uuid, text, text, uuid, text)
  is 'Authenticated HV check command; requires a current verified technician qualification.';
comment on function public.transition_hv_work_permit(uuid, text)
  is 'Authenticated HV permit transition command; validates qualification, time window and mandatory checks.';
