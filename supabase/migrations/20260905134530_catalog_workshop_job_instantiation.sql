-- Instantiate the immutable service recipe booked on an appointment as workshop jobs.
create or replace function app_private.populate_catalog_jobs_from_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service record;
  v_task jsonb;
  v_job public.jobs%rowtype;
  v_safety_class text;
  v_qualification_code text;
  v_minutes integer;
begin
  if new.appointment_id is null then
    return new;
  end if;

  for v_service in
    select item.template_version_id, item.snapshot_json
    from public.appointment_service_items item
    where item.appointment_id = new.appointment_id
      and item.organization_id = new.organization_id
      and item.branch_id = new.branch_id
    order by item.created_at, item.id
  loop
    for v_task in
      select value
      from jsonb_array_elements(coalesce(v_service.snapshot_json -> 'tasks', '[]'::jsonb))
    loop
      v_safety_class := coalesce(
        nullif(v_task -> 'result_schema' ->> 'safety_class', ''),
        'ev_aware'
      );
      v_qualification_code := nullif(upper(trim(v_task ->> 'required_qualification_code')), '');
      v_minutes := (v_task ->> 'standard_minutes')::integer;

      if nullif(trim(v_task ->> 'task_code'), '') is null
         or nullif(trim(v_task ->> 'description_en'), '') is null
         or v_safety_class not in ('normal', 'ev_aware', 'hv_isolated', 'hv_battery_open')
         or v_minutes is null or v_minutes < 0 or v_minutes > 1440 then
        raise exception 'The booked service recipe contains an invalid workshop task'
          using errcode = '23514';
      end if;

      if v_safety_class in ('hv_isolated', 'hv_battery_open') and v_qualification_code is null then
        raise exception 'HV catalog tasks require a qualification code'
          using errcode = '23514';
      end if;

      if v_qualification_code is not null and not exists (
        select 1
        from public.qualification_types qualification
        where qualification.organization_id = new.organization_id
          and qualification.code = v_qualification_code
      ) then
        raise exception 'A catalog task references an unconfigured qualification code'
          using errcode = '23514';
      end if;

      if v_safety_class in ('hv_isolated', 'hv_battery_open') and not exists (
        select 1
        from public.branch_capabilities capability
        where capability.organization_id = new.organization_id
          and capability.branch_id = new.branch_id
          and capability.capability_code = 'HV_SERVICE'
          and capability.status = 'active'
          and capability.valid_from <= current_date
          and (capability.valid_to is null or capability.valid_to >= current_date)
      ) then
        raise exception 'This branch is not approved for high-voltage service'
          using errcode = '23514';
      end if;

      insert into public.jobs (
        organization_id,
        branch_id,
        repair_order_id,
        operation_code,
        description_snapshot,
        status,
        safety_class,
        required_qualification_code,
        planned_minutes
      ) values (
        new.organization_id,
        new.branch_id,
        new.id,
        upper(trim(v_task ->> 'task_code')),
        trim(v_task ->> 'description_en'),
        'ready',
        v_safety_class,
        v_qualification_code,
        v_minutes
      )
      returning * into v_job;

      insert into audit.events (
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
      ) values (
        new.organization_id,
        auth.uid(),
        'job.created_from_catalog',
        'job',
        v_job.id,
        jsonb_build_object(
          'repair_order_id', new.id,
          'appointment_id', new.appointment_id,
          'template_version_id', v_service.template_version_id,
          'safety_class', v_safety_class
        )
      );
    end loop;
  end loop;

  return new;
end;
$$;

revoke all on function app_private.populate_catalog_jobs_from_appointment()
  from public, anon, authenticated;

drop trigger if exists populate_catalog_jobs_from_appointment on public.repair_orders;
create trigger populate_catalog_jobs_from_appointment
after insert on public.repair_orders
for each row
when (new.appointment_id is not null)
execute function app_private.populate_catalog_jobs_from_appointment();

comment on function app_private.populate_catalog_jobs_from_appointment()
is 'Creates ready workshop jobs from immutable catalog task snapshots when a checked-in appointment becomes a repair order.';
