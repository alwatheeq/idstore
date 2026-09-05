-- Versioned service catalog and branch resource planning commands.

create unique index resource_bookings_one_active_appointment_resource
  on public.resource_bookings(appointment_id, resource_id)
  where status = 'active';

create index resource_bookings_resource_window
  on public.resource_bookings(resource_id, starts_at, ends_at)
  where status = 'active';

create or replace function public.create_service_template(
  p_organization_id uuid,
  p_code text,
  p_name_en text,
  p_name_ar text,
  p_market text,
  p_effective_from date,
  p_interval_months integer,
  p_interval_km integer,
  p_source_uri text,
  p_applicability_json jsonb
)
returns public.service_template_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.service_templates%rowtype;
  v_version public.service_template_versions%rowtype;
begin
  if not app_private.has_permission(p_organization_id, null, 'branch.manage') then
    raise exception 'Not authorized to manage service templates' using errcode = '42501';
  end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_name_en), '') is null
     or p_effective_from is null
     or (p_interval_months is not null and p_interval_months <= 0)
     or (p_interval_km is not null and p_interval_km <= 0)
     or jsonb_typeof(coalesce(p_applicability_json, '{}'::jsonb)) <> 'object' then
    raise exception 'Template identity, effective date, intervals or applicability are invalid' using errcode = '22023';
  end if;

  insert into public.service_templates (organization_id, code, name_en, name_ar, market)
  values (p_organization_id, upper(trim(p_code)), trim(p_name_en), nullif(trim(p_name_ar), ''), nullif(upper(trim(p_market)), ''))
  returning * into v_template;

  insert into public.service_template_versions (
    organization_id, template_id, version_no, effective_from, interval_months,
    interval_km, applicability_json, source_uri, status
  ) values (
    p_organization_id, v_template.id, 1, p_effective_from, p_interval_months,
    p_interval_km, coalesce(p_applicability_json, '{}'::jsonb), nullif(trim(p_source_uri), ''), 'draft'
  ) returning * into v_version;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'service_template.created', 'service_template_version', v_version.id,
    jsonb_build_object('template_id', v_template.id, 'code', v_template.code));
  return v_version;
end;
$$;

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
begin
  select * into v_version from public.service_template_versions where id = p_version_id for update;
  if not found then raise exception 'Service-template version not found' using errcode = 'P0002'; end if;
  if v_version.organization_id is null or not app_private.has_permission(v_version.organization_id, null, 'branch.manage') then
    raise exception 'Not authorized to manage this service template' using errcode = '42501';
  end if;
  if v_version.status <> 'draft' then raise exception 'Published service templates are immutable' using errcode = '23514'; end if;
  if nullif(trim(p_task_code), '') is null or nullif(trim(p_description_en), '') is null
     or p_standard_minutes < 0
     or jsonb_typeof(coalesce(p_result_schema, '{}'::jsonb)) <> 'object' then
    raise exception 'Task code, description, time or result definition are invalid' using errcode = '22023';
  end if;
  if nullif(trim(p_required_permission), '') is not null and not exists (
    select 1 from public.permissions where code = trim(p_required_permission)
  ) then raise exception 'Required permission is unknown' using errcode = '22023'; end if;

  select coalesce(max(sequence), 0) + 1 into v_sequence
  from public.service_template_tasks where version_id = v_version.id;
  insert into public.service_template_tasks (
    organization_id, version_id, sequence, task_code, description_en, description_ar,
    standard_minutes, required_permission, required_qualification_code, procedure_ref, result_schema
  ) values (
    v_version.organization_id, v_version.id, v_sequence, upper(trim(p_task_code)), trim(p_description_en),
    nullif(trim(p_description_ar), ''), p_standard_minutes, nullif(trim(p_required_permission), ''),
    nullif(upper(trim(p_required_qualification_code)), ''), nullif(trim(p_procedure_ref), ''),
    coalesce(p_result_schema, '{}'::jsonb)
  ) returning * into v_task;
  return v_task;
end;
$$;

create or replace function public.publish_service_template_version(p_version_id uuid)
returns public.service_template_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.service_template_versions%rowtype;
begin
  select * into v_version from public.service_template_versions where id = p_version_id for update;
  if not found then raise exception 'Service-template version not found' using errcode = 'P0002'; end if;
  if v_version.organization_id is null or not app_private.has_permission(v_version.organization_id, null, 'branch.manage') then
    raise exception 'Not authorized to publish this service template' using errcode = '42501';
  end if;
  if v_version.status <> 'draft' then raise exception 'Only a draft template can be published' using errcode = '23514'; end if;
  if nullif(trim(v_version.source_uri), '') is null then
    raise exception 'A verified source reference is required before publishing' using errcode = '23514';
  end if;
  if not exists (select 1 from public.service_template_tasks where version_id = v_version.id) then
    raise exception 'Add at least one task before publishing' using errcode = '23514';
  end if;
  update public.service_template_versions set status = 'retired', effective_to = greatest(effective_from, current_date - 1)
  where template_id = v_version.template_id and status = 'published' and id <> v_version.id;
  update public.service_template_versions set status = 'published'
  where id = v_version.id returning * into v_version;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_version.organization_id, auth.uid(), 'service_template.published', 'service_template_version', v_version.id,
    jsonb_build_object('template_id', v_version.template_id, 'version_no', v_version.version_no));
  return v_version;
end;
$$;

create or replace function public.create_resource(
  p_branch_id uuid,
  p_resource_type text,
  p_code text,
  p_name text,
  p_capabilities jsonb
)
returns public.resources
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches%rowtype;
  v_resource public.resources%rowtype;
begin
  select * into v_branch from public.branches where id = p_branch_id and status = 'active';
  if not found then raise exception 'Active branch not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_branch.organization_id, v_branch.id, 'branch.manage') then
    raise exception 'Not authorized to manage branch resources' using errcode = '42501';
  end if;
  if p_resource_type not in ('bay', 'lift', 'charger', 'diagnostic_device', 'loan_vehicle', 'other')
     or nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null
     or jsonb_typeof(coalesce(p_capabilities, '{}'::jsonb)) <> 'object' then
    raise exception 'Resource type, code, name or capabilities are invalid' using errcode = '22023';
  end if;
  insert into public.resources (organization_id, branch_id, resource_type, code, name, capabilities)
  values (v_branch.organization_id, v_branch.id, p_resource_type, upper(trim(p_code)), trim(p_name), coalesce(p_capabilities, '{}'::jsonb))
  returning * into v_resource;
  return v_resource;
end;
$$;

create or replace function public.book_appointment_resource(p_appointment_id uuid, p_resource_id uuid)
returns public.resource_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_resource public.resources%rowtype;
  v_booking public.resource_bookings%rowtype;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Appointment not found' using errcode = 'P0002'; end if;
  select * into v_resource from public.resources where id = p_resource_id for update;
  if not found or v_resource.status <> 'active' then raise exception 'Active resource not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_appointment.organization_id, v_appointment.branch_id, 'appointments.manage') then
    raise exception 'Not authorized to allocate appointment resources' using errcode = '42501';
  end if;
  if v_appointment.branch_id <> v_resource.branch_id or v_appointment.organization_id <> v_resource.organization_id then
    raise exception 'Resource and appointment must belong to the same branch' using errcode = '23514';
  end if;
  if v_appointment.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Resources cannot be allocated to this appointment state' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.resource_bookings b
    where b.resource_id = v_resource.id and b.status = 'active'
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_appointment.start_at, v_appointment.end_at, '[)')
  ) then raise exception 'Resource is already booked in this time window' using errcode = '23P01'; end if;
  insert into public.resource_bookings (organization_id, branch_id, resource_id, appointment_id, starts_at, ends_at)
  values (v_appointment.organization_id, v_appointment.branch_id, v_resource.id, v_appointment.id, v_appointment.start_at, v_appointment.end_at)
  returning * into v_booking;
  return v_booking;
end;
$$;

revoke all on function public.create_service_template(uuid, text, text, text, text, date, integer, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.add_service_template_task(uuid, text, text, text, integer, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.publish_service_template_version(uuid) from public, anon, authenticated;
revoke all on function public.create_resource(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.book_appointment_resource(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_service_template(uuid, text, text, text, text, date, integer, integer, text, jsonb) to authenticated;
grant execute on function public.add_service_template_task(uuid, text, text, text, integer, text, text, text, jsonb) to authenticated;
grant execute on function public.publish_service_template_version(uuid) to authenticated;
grant execute on function public.create_resource(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.book_appointment_resource(uuid, uuid) to authenticated;
