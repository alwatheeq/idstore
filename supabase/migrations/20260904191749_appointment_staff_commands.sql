-- Transactional commands for appointment scheduling and staff provisioning.
-- Direct table writes remain revoked from authenticated clients.

create or replace function public.create_appointment(
  p_organization_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_promised_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid;
begin
  if not app_private.has_permission(p_organization_id, p_branch_id, 'appointments.manage') then
    raise exception 'Not authorized to manage appointments for this branch' using errcode = '42501';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'Appointment end time must be after its start time' using errcode = '22023';
  end if;

  if p_end_at - p_start_at > interval '12 hours' then
    raise exception 'Appointment duration cannot exceed 12 hours' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.organization_id = p_organization_id
      and b.status = 'active'
  ) then
    raise exception 'The selected branch is unavailable' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.customers c
    join public.vehicles v on v.organization_id = c.organization_id
    join public.vehicle_ownerships vo
      on vo.organization_id = c.organization_id
     and vo.customer_id = c.id
     and vo.vehicle_id = v.id
     and vo.valid_from <= current_date
     and (vo.valid_to is null or vo.valid_to >= current_date)
    where c.id = p_customer_id
      and v.id = p_vehicle_id
      and c.organization_id = p_organization_id
      and c.status = 'active'
      and v.status = 'active'
  ) then
    raise exception 'The selected customer does not currently own this active vehicle' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.organization_id = p_organization_id
      and a.vehicle_id = p_vehicle_id
      and a.status in ('requested', 'confirmed', 'checked_in')
      and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'This vehicle already has an overlapping appointment' using errcode = '23P01';
  end if;

  insert into public.appointments (
    organization_id, branch_id, customer_id, vehicle_id,
    start_at, end_at, promised_at, channel, status, notes, created_by
  ) values (
    p_organization_id, p_branch_id, p_customer_id, p_vehicle_id,
    p_start_at, p_end_at, p_promised_at, 'staff', 'requested', nullif(trim(p_notes), ''), auth.uid()
  )
  returning id into v_appointment_id;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'appointment.created', 'appointment', v_appointment_id,
    jsonb_build_object('branch_id', p_branch_id, 'start_at', p_start_at)
  );

  return v_appointment_id;
end;
$$;

create or replace function public.transition_appointment(
  p_appointment_id uuid,
  p_expected_version bigint,
  p_to_status text
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.appointments;
  v_updated public.appointments;
begin
  select * into v_current
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;

  if not app_private.has_permission(v_current.organization_id, v_current.branch_id, 'appointments.manage') then
    raise exception 'Not authorized to manage this appointment' using errcode = '42501';
  end if;

  if v_current.version <> p_expected_version then
    raise exception 'Appointment changed; refresh before retrying' using errcode = '40001';
  end if;

  if not (
    (v_current.status = 'requested' and p_to_status in ('confirmed', 'cancelled'))
    or (v_current.status = 'confirmed' and p_to_status in ('checked_in', 'cancelled', 'no_show'))
    or (v_current.status = 'checked_in' and p_to_status = 'completed')
  ) then
    raise exception 'Invalid appointment status transition from % to %', v_current.status, p_to_status using errcode = '22023';
  end if;

  update public.appointments
  set status = p_to_status
  where id = p_appointment_id
  returning * into v_updated;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_current.organization_id, auth.uid(), 'appointment.status_changed', 'appointment', p_appointment_id,
    jsonb_build_object('from', v_current.status, 'to', p_to_status)
  );

  return v_updated;
end;
$$;

create or replace function public.provision_staff_access(
  p_organization_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_mobile text,
  p_role public.app_role,
  p_branch_ids uuid[],
  p_permission_codes text[],
  p_is_technician boolean,
  p_employee_no text,
  p_labor_grade text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id uuid;
  v_branch_ids uuid[];
  v_permission_codes text[];
  v_expected_email text;
begin
  if not app_private.is_admin(p_organization_id) then
    raise exception 'Only administrators can provision staff access' using errcode = '42501';
  end if;

  if p_user_id is null or nullif(trim(p_display_name), '') is null then
    raise exception 'User and display name are required' using errcode = '22023';
  end if;

  if p_mobile is null or p_mobile !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'A valid E.164 mobile number is required' using errcode = '22023';
  end if;

  v_expected_email := substring(p_mobile from 2) || '@mobile.idstore.invalid';
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and lower(u.email) = lower(v_expected_email)
  ) then
    raise exception 'The Auth account does not match the supplied mobile number' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct requested_branch.branch_id), '{}'::uuid[])
  into v_branch_ids
  from unnest(coalesce(p_branch_ids, '{}'::uuid[])) as requested_branch(branch_id);

  select coalesce(array_agg(distinct requested_permission.permission_code), '{}'::text[])
  into v_permission_codes
  from unnest(coalesce(p_permission_codes, '{}'::text[])) as requested_permission(permission_code);

  if p_role = 'staff' and cardinality(v_branch_ids) = 0 then
    raise exception 'Staff must be assigned to at least one branch' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(v_branch_ids) requested(id)
    where not exists (
      select 1 from public.branches b
      where b.id = requested.id
        and b.organization_id = p_organization_id
        and b.status = 'active'
    )
  ) then
    raise exception 'A selected branch is unavailable' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(v_permission_codes) requested(code)
    where not exists (select 1 from public.permissions p where p.code = requested.code)
  ) then
    raise exception 'An unknown permission was selected' using errcode = '23514';
  end if;

  insert into public.profiles (user_id, display_name, locale, phone, status)
  values (p_user_id, trim(p_display_name), 'ar-JO', p_mobile, 'active');

  insert into public.memberships (organization_id, user_id, role, all_branches, status)
  values (p_organization_id, p_user_id, p_role, p_role = 'admin', 'active')
  returning id into v_membership_id;

  if p_role = 'staff' then
    insert into public.membership_branches (organization_id, membership_id, branch_id)
    select p_organization_id, v_membership_id, requested_branch.branch_id
    from unnest(v_branch_ids) as requested_branch(branch_id);

    insert into public.membership_permissions (
      organization_id, membership_id, permission_code, allowed, granted_by
    )
    select p_organization_id, v_membership_id, requested_permission.permission_code, true, auth.uid()
    from unnest(v_permission_codes) as requested_permission(permission_code);
  end if;

  if p_is_technician then
    insert into public.technician_profiles (
      organization_id, user_id, employee_no, labor_grade, active
    ) values (
      p_organization_id, p_user_id, nullif(trim(p_employee_no), ''), nullif(trim(p_labor_grade), ''), true
    );
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'staff.provisioned', 'membership', v_membership_id,
    jsonb_build_object('user_id', p_user_id, 'role', p_role, 'branches', v_branch_ids, 'permissions', v_permission_codes)
  );

  return v_membership_id;
end;
$$;

drop policy if exists read_profiles on public.profiles;
create policy read_profiles
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.memberships target_membership
    join public.memberships caller_membership
      on caller_membership.organization_id = target_membership.organization_id
    where target_membership.user_id = profiles.user_id
      and caller_membership.user_id = (select auth.uid())
      and caller_membership.role = 'admin'
      and caller_membership.status = 'active'
  )
);

revoke all on function public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.transition_appointment(uuid, bigint, text) from public, anon;
revoke all on function public.provision_staff_access(uuid, uuid, text, text, public.app_role, uuid[], text[], boolean, text, text) from public, anon;

grant execute on function public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.transition_appointment(uuid, bigint, text) to authenticated;
grant execute on function public.provision_staff_access(uuid, uuid, text, text, public.app_role, uuid[], text[], boolean, text, text) to authenticated;
