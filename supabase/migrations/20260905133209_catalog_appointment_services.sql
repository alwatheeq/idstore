-- Bind reception bookings to published and effective service-catalog versions.

create table public.appointment_service_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  template_version_id uuid not null references public.service_template_versions(id) on delete restrict,
  template_code text not null,
  template_name_en text not null,
  template_name_ar text,
  version_no integer not null check (version_no > 0),
  planned_minutes integer not null check (planned_minutes >= 0),
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (appointment_id, template_version_id)
);

create index appointment_service_items_appointment
  on public.appointment_service_items(appointment_id, created_at);
create index appointment_service_items_template
  on public.appointment_service_items(template_version_id, appointment_id);
create index appointment_service_items_branch
  on public.appointment_service_items(branch_id, appointment_id);
create index appointment_service_items_organization
  on public.appointment_service_items(organization_id, appointment_id);

create trigger assert_branch_organization
before insert or update of organization_id, branch_id on public.appointment_service_items
for each row execute function app_private.assert_branch_organization();

alter table public.appointment_service_items enable row level security;

create policy appointment_service_items_select on public.appointment_service_items
for select to authenticated
using (app_private.has_branch_access(organization_id, branch_id));

grant select on public.appointment_service_items to authenticated;

create or replace function public.create_catalog_appointments(
  p_organization_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_promised_at timestamptz,
  p_notes text,
  p_service_mode text,
  p_transport_mode text,
  p_advisor_user_id uuid,
  p_resource_id uuid,
  p_service_version_ids uuid[],
  p_recurrence_count integer
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches%rowtype;
  v_vehicle_model_code text;
  v_service_date date;
  v_expected integer;
  v_valid integer;
  v_planned_minutes integer;
  v_requested_services jsonb;
  v_appointment_ids uuid[];
  v_appointment_id uuid;
begin
  select * into strict v_branch
  from public.branches
  where id = p_branch_id and organization_id = p_organization_id and status = 'active';

  if not app_private.has_permission(p_organization_id, p_branch_id, 'appointments.manage') then
    raise exception 'Not authorized to manage appointments for this branch' using errcode = '42501';
  end if;

  v_expected := cardinality(coalesce(p_service_version_ids, array[]::uuid[]));
  if v_expected < 1 or v_expected > 10 then
    raise exception 'Choose between one and ten catalog services' using errcode = '22023';
  end if;
  if (select count(distinct service_id) from unnest(p_service_version_ids) as selected(service_id)) <> v_expected then
    raise exception 'Duplicate or invalid catalog service selection' using errcode = '22023';
  end if;

  select vm.model_code into v_vehicle_model_code
  from public.vehicles v
  left join public.vehicle_models vm on vm.id = v.model_id
  where v.id = p_vehicle_id and v.organization_id = p_organization_id and v.status = 'active';
  if not found then
    raise exception 'Active vehicle not found' using errcode = 'P0002';
  end if;

  v_service_date := (p_start_at at time zone v_branch.timezone)::date;
  select count(distinct sv.id), coalesce(sum(task_totals.minutes), 0)::integer
  into v_valid, v_planned_minutes
  from public.service_template_versions sv
  join public.service_templates st on st.id = sv.template_id
  left join lateral (
    select coalesce(sum(task.standard_minutes), 0)::integer as minutes
    from public.service_template_tasks task
    where task.version_id = sv.id
  ) task_totals on true
  where sv.id = any(p_service_version_ids)
    and sv.organization_id = p_organization_id
    and st.organization_id = p_organization_id
    and sv.status = 'published'
    and sv.effective_from <= v_service_date
    and (sv.effective_to is null or sv.effective_to >= v_service_date)
    and (st.market is null or st.market = v_branch.country_code)
    and (
      not (sv.applicability_json ? 'model_codes')
      or sv.applicability_json->'model_codes' = '[]'::jsonb
      or (
        jsonb_typeof(sv.applicability_json->'model_codes') = 'array'
        and v_vehicle_model_code is not null
        and (sv.applicability_json->'model_codes') ? v_vehicle_model_code
      )
    );

  if v_valid <> v_expected then
    raise exception 'A selected service is unpublished, out of date, wrong-market or not applicable to this vehicle'
      using errcode = '23514';
  end if;
  if p_start_at is null or p_end_at is null or p_end_at - p_start_at < make_interval(mins => v_planned_minutes) then
    raise exception 'Appointment duration is shorter than the selected services'' standard time'
      using errcode = '22023';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'template_version_id', sv.id,
      'code', st.code,
      'name_en', st.name_en,
      'name_ar', st.name_ar,
      'version_no', sv.version_no,
      'planned_minutes', task_totals.minutes
    ) order by selected.ordinality
  ) into v_requested_services
  from unnest(p_service_version_ids) with ordinality selected(id, ordinality)
  join public.service_template_versions sv on sv.id = selected.id
  join public.service_templates st on st.id = sv.template_id
  left join lateral (
    select coalesce(sum(task.standard_minutes), 0)::integer as minutes
    from public.service_template_tasks task
    where task.version_id = sv.id
  ) task_totals on true;

  select public.create_advanced_appointments(
    p_organization_id,
    p_branch_id,
    p_customer_id,
    p_vehicle_id,
    p_start_at,
    p_end_at,
    p_promised_at,
    p_notes,
    p_service_mode,
    p_transport_mode,
    p_advisor_user_id,
    p_resource_id,
    v_requested_services,
    p_recurrence_count
  ) into v_appointment_ids;

  foreach v_appointment_id in array v_appointment_ids loop
    insert into public.appointment_service_items (
      organization_id,
      branch_id,
      appointment_id,
      template_version_id,
      template_code,
      template_name_en,
      template_name_ar,
      version_no,
      planned_minutes,
      snapshot_json
    )
    select
      p_organization_id,
      p_branch_id,
      v_appointment_id,
      sv.id,
      st.code,
      st.name_en,
      st.name_ar,
      sv.version_no,
      task_totals.minutes,
      jsonb_build_object(
        'template_version_id', sv.id,
        'template_code', st.code,
        'template_name_en', st.name_en,
        'template_name_ar', st.name_ar,
        'market', st.market,
        'version_no', sv.version_no,
        'effective_from', sv.effective_from,
        'effective_to', sv.effective_to,
        'applicability', sv.applicability_json,
        'source_uri', sv.source_uri,
        'tasks', task_totals.tasks
      )
    from unnest(p_service_version_ids) with ordinality selected(id, ordinality)
    join public.service_template_versions sv on sv.id = selected.id
    join public.service_templates st on st.id = sv.template_id
    left join lateral (
      select
        coalesce(sum(task.standard_minutes), 0)::integer as minutes,
        coalesce(jsonb_agg(jsonb_build_object(
          'id', task.id,
          'sequence', task.sequence,
          'task_code', task.task_code,
          'description_en', task.description_en,
          'description_ar', task.description_ar,
          'standard_minutes', task.standard_minutes,
          'required_permission', task.required_permission,
          'required_qualification_code', task.required_qualification_code,
          'procedure_ref', task.procedure_ref,
          'result_schema', task.result_schema
        ) order by task.sequence), '[]'::jsonb) as tasks
      from public.service_template_tasks task
      where task.version_id = sv.id
    ) task_totals on true;
  end loop;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id,
    auth.uid(),
    'appointment.catalog_services_booked',
    'appointment',
    v_appointment_ids[1],
    jsonb_build_object(
      'appointment_count', cardinality(v_appointment_ids),
      'service_count', v_expected,
      'planned_minutes', v_planned_minutes,
      'service_version_ids', p_service_version_ids
    )
  );

  return v_appointment_ids;
end;
$$;

revoke all on function public.create_advanced_appointments(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, text, text, text, uuid, uuid, jsonb, integer)
  from authenticated;
revoke all on function public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, text)
  from authenticated;
revoke all on function public.create_catalog_appointments(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, text, text, text, uuid, uuid, uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.create_catalog_appointments(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, text, text, text, uuid, uuid, uuid[], integer)
  to authenticated;

comment on function public.create_catalog_appointments(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, text, text, text, uuid, uuid, uuid[], integer)
  is 'Creates one or more appointments from published service versions and retains an immutable service/task snapshot.';
