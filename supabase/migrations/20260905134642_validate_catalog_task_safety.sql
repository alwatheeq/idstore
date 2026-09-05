-- Validate safety and qualification metadata when Admin defines a service task,
-- rather than waiting until a booked vehicle reaches the workshop.
create or replace function public.add_service_template_task(
  p_version_id uuid,
  p_task_code text,
  p_description_en text,
  p_description_ar text,
  p_standard_minutes integer,
  p_required_permission text,
  p_required_qualification_code text,
  p_procedure_ref text,
  p_result_schema jsonb
)
returns public.service_template_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.service_template_versions%rowtype;
  v_task public.service_template_tasks%rowtype;
  v_sequence integer;
  v_safety_class text := coalesce(nullif(p_result_schema ->> 'safety_class', ''), 'ev_aware');
  v_qualification_code text := nullif(upper(trim(p_required_qualification_code)), '');
  v_result_schema jsonb;
begin
  select * into v_version
  from public.service_template_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'Service-template version not found' using errcode = 'P0002';
  end if;
  if v_version.organization_id is null
     or not app_private.has_permission(v_version.organization_id, null, 'branch.manage') then
    raise exception 'Not authorized to manage this service template' using errcode = '42501';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'Published service templates are immutable' using errcode = '23514';
  end if;
  if nullif(trim(p_task_code), '') is null
     or nullif(trim(p_description_en), '') is null
     or p_standard_minutes is null
     or p_standard_minutes < 0
     or p_standard_minutes > 1440
     or jsonb_typeof(coalesce(p_result_schema, '{}'::jsonb)) <> 'object'
     or v_safety_class not in ('normal', 'ev_aware', 'hv_isolated', 'hv_battery_open') then
    raise exception 'Task code, description, time, safety class or result definition is invalid'
      using errcode = '22023';
  end if;
  if nullif(trim(p_required_permission), '') is not null and not exists (
    select 1 from public.permissions where code = trim(p_required_permission)
  ) then
    raise exception 'Required permission is unknown' using errcode = '22023';
  end if;
  if v_safety_class in ('hv_isolated', 'hv_battery_open') and v_qualification_code is null then
    raise exception 'HV catalog tasks require a qualification code' using errcode = '23514';
  end if;
  if v_qualification_code is not null and not exists (
    select 1
    from public.qualification_types qualification
    where qualification.organization_id = v_version.organization_id
      and qualification.code = v_qualification_code
  ) then
    raise exception 'Qualification code is not configured for this organization'
      using errcode = '23514';
  end if;

  v_result_schema := jsonb_set(
    coalesce(p_result_schema, '{}'::jsonb),
    '{safety_class}',
    to_jsonb(v_safety_class),
    true
  );

  select coalesce(max(sequence), 0) + 1 into v_sequence
  from public.service_template_tasks
  where version_id = v_version.id;

  insert into public.service_template_tasks (
    organization_id,
    version_id,
    sequence,
    task_code,
    description_en,
    description_ar,
    standard_minutes,
    required_permission,
    required_qualification_code,
    procedure_ref,
    result_schema
  ) values (
    v_version.organization_id,
    v_version.id,
    v_sequence,
    upper(trim(p_task_code)),
    trim(p_description_en),
    nullif(trim(p_description_ar), ''),
    p_standard_minutes,
    nullif(trim(p_required_permission), ''),
    v_qualification_code,
    nullif(trim(p_procedure_ref), ''),
    v_result_schema
  )
  returning * into v_task;

  insert into audit.events (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_version.organization_id,
    auth.uid(),
    'service_template_task.created',
    'service_template_task',
    v_task.id,
    jsonb_build_object(
      'version_id', v_version.id,
      'task_code', v_task.task_code,
      'safety_class', v_safety_class,
      'required_qualification_code', v_qualification_code
    )
  );

  return v_task;
end;
$$;

revoke all on function public.add_service_template_task(
  uuid, text, text, text, integer, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.add_service_template_task(
  uuid, text, text, text, integer, text, text, text, jsonb
) to authenticated;

comment on function public.add_service_template_task(
  uuid, text, text, text, integer, text, text, text, jsonb
) is 'Adds an immutable-recipe task after validating its result, safety, permission and qualification metadata.';
