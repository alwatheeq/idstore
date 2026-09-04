-- Workshop execution and inventory setup commands. Direct table writes remain
-- unavailable to authenticated clients; every mutation checks branch access.

create or replace function public.create_part(
  p_organization_id uuid,
  p_branch_id uuid,
  p_part_number text,
  p_description_en text,
  p_unit text,
  p_tracking text,
  p_sale_price numeric
)
returns public.parts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_part public.parts%rowtype;
  v_warehouse_id uuid;
begin
  if not app_private.has_permission(p_organization_id, p_branch_id, 'inventory.manage') then
    raise exception 'Not authorized to manage inventory for this branch' using errcode = '42501';
  end if;
  if nullif(trim(p_part_number), '') is null
     or nullif(trim(p_description_en), '') is null
     or nullif(trim(p_unit), '') is null
     or p_tracking not in ('none', 'lot', 'serial')
     or p_sale_price is null or p_sale_price < 0 then
    raise exception 'Part number, description, unit, tracking and non-negative price are required' using errcode = '22023';
  end if;

  select w.id into v_warehouse_id
  from public.warehouses w
  where w.organization_id = p_organization_id
    and w.branch_id = p_branch_id
    and w.status = 'active'
  order by (w.code = 'MAIN') desc, w.created_at
  limit 1;
  if v_warehouse_id is null then
    raise exception 'The selected branch does not have an active warehouse' using errcode = '23514';
  end if;

  insert into public.bins (organization_id, branch_id, warehouse_id, code, bin_type)
  values
    (p_organization_id, p_branch_id, v_warehouse_id, 'STOCK', 'storage'),
    (p_organization_id, p_branch_id, v_warehouse_id, 'RECEIVING', 'receiving'),
    (p_organization_id, p_branch_id, v_warehouse_id, 'QUARANTINE', 'quarantine'),
    (p_organization_id, p_branch_id, v_warehouse_id, 'RETURNS', 'returns')
  on conflict (warehouse_id, code) do nothing;

  insert into public.parts (
    organization_id, part_number, description_en, unit, tracking, sale_price, status
  ) values (
    p_organization_id, upper(trim(p_part_number)), trim(p_description_en),
    lower(trim(p_unit)), p_tracking, p_sale_price, 'active'
  ) returning * into v_part;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'part.created', 'part', v_part.id,
    jsonb_build_object('part_number', v_part.part_number, 'branch_id', p_branch_id)
  );
  return v_part;
end;
$$;

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
  if p_safety_class in ('hv_isolated', 'hv_battery_open') and not exists (
    select 1 from public.branch_capabilities c
    where c.organization_id = v_order.organization_id
      and c.branch_id = v_order.branch_id
      and c.capability_code = 'HV_SERVICE'
      and c.status = 'active'
      and (c.valid_to is null or c.valid_to >= current_date)
  ) then
    raise exception 'This branch is not approved for high-voltage service' using errcode = '23514';
  end if;

  insert into public.jobs (
    organization_id, branch_id, repair_order_id, operation_code, description_snapshot,
    status, safety_class, required_qualification_code, planned_minutes
  ) values (
    v_order.organization_id, v_order.branch_id, v_order.id,
    nullif(upper(trim(p_operation_code)), ''), trim(p_description), 'ready', p_safety_class,
    nullif(upper(trim(p_required_qualification_code)), ''), p_planned_minutes
  ) returning * into v_job;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_job.organization_id, auth.uid(), 'job.created', 'job', v_job.id,
    jsonb_build_object('repair_order_id', v_job.repair_order_id, 'safety_class', v_job.safety_class)
  );
  return v_job;
end;
$$;

create or replace function public.assign_job(
  p_job_id uuid,
  p_expected_version bigint,
  p_technician_id uuid,
  p_assignment_kind text
)
returns public.job_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_technician public.technician_profiles%rowtype;
  v_assignment public.job_assignments%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_job.organization_id, v_job.branch_id, 'workshop.dispatch') then
    raise exception 'Not authorized to dispatch this job' using errcode = '42501';
  end if;
  if v_job.version <> p_expected_version then
    raise exception 'Job changed; refresh before assigning' using errcode = '40001';
  end if;
  if v_job.status not in ('planned', 'ready', 'assigned', 'paused', 'blocked')
     or p_assignment_kind not in ('primary', 'assistant', 'quality_control', 'safety_witness') then
    raise exception 'Job state or assignment type is invalid' using errcode = '22023';
  end if;

  select * into v_technician
  from public.technician_profiles
  where id = p_technician_id
    and organization_id = v_job.organization_id
    and active;
  if not found then raise exception 'Technician is unavailable' using errcode = '23514'; end if;

  if not exists (
    select 1 from public.memberships m
    where m.organization_id = v_job.organization_id
      and m.user_id = v_technician.user_id
      and m.status = 'active'
      and (
        m.role = 'admin'
        or exists (
          select 1 from public.membership_permissions mp
          where mp.membership_id = m.id and mp.permission_code = 'job.perform' and mp.allowed
        )
      )
      and (
        m.role = 'admin'
        or exists (
          select 1 from public.membership_branches mb
          where mb.membership_id = m.id and mb.branch_id = v_job.branch_id
        )
      )
  ) then
    raise exception 'Technician lacks branch access or job permission' using errcode = '23514';
  end if;

  if p_assignment_kind = 'primary' then
    update public.job_assignments
    set unassigned_at = now()
    where job_id = v_job.id and assignment_kind = 'primary' and unassigned_at is null;
  end if;

  insert into public.job_assignments (
    organization_id, branch_id, job_id, technician_id, assignment_kind
  ) values (
    v_job.organization_id, v_job.branch_id, v_job.id, p_technician_id, p_assignment_kind
  ) returning * into v_assignment;

  update public.jobs set status = 'assigned' where id = v_job.id;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_job.organization_id, auth.uid(), 'job.assigned', 'job', v_job.id,
    jsonb_build_object('technician_id', p_technician_id, 'assignment_kind', p_assignment_kind)
  );
  return v_assignment;
end;
$$;

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

  select * into v_technician
  from public.technician_profiles
  where organization_id = v_job.organization_id and user_id = auth.uid() and active;
  if not found or not exists (
    select 1 from public.job_assignments a
    where a.job_id = v_job.id and a.technician_id = v_technician.id and a.unassigned_at is null
  ) then
    raise exception 'This job is not assigned to the current technician' using errcode = '42501';
  end if;

  if v_job.required_qualification_code is not null and not exists (
    select 1
    from public.technician_qualifications tq
    join public.qualification_types qt on qt.id = tq.qualification_type_id
    where tq.technician_id = v_technician.id
      and qt.code = v_job.required_qualification_code
      and tq.verified_at is not null
      and tq.valid_from <= current_date
      and (tq.valid_to is null or tq.valid_to >= current_date)
  ) then
    raise exception 'Required technician qualification is not current' using errcode = '23514';
  end if;

  if v_job.safety_class in ('hv_isolated', 'hv_battery_open') and not exists (
    select 1 from public.hv_work_permits p
    where p.job_id = v_job.id
      and p.state in ('authorized', 'isolated', 'work_active')
      and (p.valid_from is null or p.valid_from <= now())
      and (p.valid_to is null or p.valid_to > now())
  ) then
    raise exception 'An active high-voltage work permit is required' using errcode = '23514';
  end if;

  if exists (select 1 from public.labor_entries l where l.technician_id = v_technician.id and l.ended_at is null) then
    raise exception 'Technician already has an active timer' using errcode = '23514';
  end if;

  insert into public.labor_entries (
    organization_id, branch_id, job_id, technician_id, started_at, source
  ) values (
    v_job.organization_id, v_job.branch_id, v_job.id, v_technician.id, now(), 'timer'
  );
  update public.jobs
  set status = 'in_progress', started_at = coalesce(started_at, now())
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
  if v_job.version <> p_expected_version then
    raise exception 'Job changed; refresh before stopping' using errcode = '40001';
  end if;
  if v_job.status <> 'in_progress' or p_outcome not in ('paused', 'blocked', 'qc', 'completed') then
    raise exception 'Job state or outcome is invalid' using errcode = '22023';
  end if;

  select * into v_technician
  from public.technician_profiles
  where organization_id = v_job.organization_id and user_id = auth.uid() and active;
  if not found or not exists (
    select 1 from public.job_assignments a
    where a.job_id = v_job.id and a.technician_id = v_technician.id and a.unassigned_at is null
  ) then
    raise exception 'This job is not assigned to the current technician' using errcode = '42501';
  end if;

  update public.labor_entries
  set ended_at = now(), pause_reason = case when p_outcome in ('paused', 'blocked') then nullif(trim(p_note), '') else null end
  where job_id = v_job.id and technician_id = v_technician.id and ended_at is null;
  if not found then raise exception 'No active timer exists for this job' using errcode = '23514'; end if;

  if p_outcome = 'completed' and v_job.safety_class in ('hv_isolated', 'hv_battery_open') and exists (
    select 1 from public.hv_work_permits p where p.job_id = v_job.id and p.state not in ('closed', 'revoked')
  ) then
    raise exception 'Close the high-voltage permit before completing the job' using errcode = '23514';
  end if;

  update public.jobs
  set status = p_outcome,
      completed_at = case when p_outcome = 'completed' then now() else null end
  where id = v_job.id returning * into v_job;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_job.organization_id, auth.uid(), 'job.timer_stopped', 'job', v_job.id,
    jsonb_build_object('outcome', p_outcome, 'note', nullif(trim(p_note), ''))
  );
  return v_job;
end;
$$;

revoke all on function public.create_part(uuid, uuid, text, text, text, text, numeric) from public, anon;
revoke all on function public.create_job(uuid, text, text, text, text, integer) from public, anon;
revoke all on function public.assign_job(uuid, bigint, uuid, text) from public, anon;
revoke all on function public.start_job(uuid, bigint) from public, anon;
revoke all on function public.finish_job(uuid, bigint, text, text) from public, anon;

grant execute on function public.create_part(uuid, uuid, text, text, text, text, numeric) to authenticated;
grant execute on function public.create_job(uuid, text, text, text, text, integer) to authenticated;
grant execute on function public.assign_job(uuid, bigint, uuid, text) to authenticated;
grant execute on function public.start_job(uuid, bigint) to authenticated;
grant execute on function public.finish_job(uuid, bigint, text, text) to authenticated;
