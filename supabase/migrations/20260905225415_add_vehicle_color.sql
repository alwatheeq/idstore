-- Surface the permanent VIN identity alongside a maintained exterior color.
-- Keep the previous RPC calls working during a rolling web deployment by giving
-- the new final argument a default value.

alter table public.vehicles
  add column if not exists color text;

alter table public.vehicles
  add constraint vehicles_color_length_check
  check (color is null or char_length(color) between 1 and 80) not valid;

alter table public.vehicles validate constraint vehicles_color_length_check;

comment on column public.vehicles.color is
  'Customer-facing exterior color description; VIN remains the immutable vehicle identity.';

drop function if exists public.create_vehicle(uuid, uuid, uuid, uuid, text, text, integer, text, numeric, integer);

create function public.create_vehicle(
  p_organization_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_model_id uuid,
  p_vin text,
  p_registration_no text,
  p_model_year integer default null,
  p_trim text default null,
  p_battery_kwh numeric default null,
  p_odometer_km integer default null,
  p_color text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_vin text := upper(nullif(regexp_replace(trim(p_vin), '\s', '', 'g'), ''));
  v_color text := nullif(trim(p_color), '');
begin
  if not app_private.has_permission(p_organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to create vehicles for this branch' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = p_organization_id and b.status = 'active'
  ) then
    raise exception 'Branch is invalid' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.organization_id = p_organization_id and c.status = 'active'
  ) then
    raise exception 'Customer is invalid' using errcode = '23514';
  end if;
  if p_model_id is not null and not exists (
    select 1 from public.vehicle_models m
    where m.id = p_model_id and (m.organization_id is null or m.organization_id = p_organization_id)
  ) then
    raise exception 'Vehicle model is invalid' using errcode = '23514';
  end if;
  if v_vin is null or v_vin !~ '^[A-HJ-NPR-Z0-9]{17}$'
     or nullif(trim(p_registration_no), '') is null
     or p_model_year is not null and p_model_year not between 2019 and extract(year from current_date)::integer + 1
     or p_battery_kwh is not null and p_battery_kwh <= 0
     or p_odometer_km is not null and p_odometer_km < 0
     or v_color is not null and char_length(v_color) > 80 then
    raise exception 'VIN, registration, color or vehicle measurements are invalid' using errcode = '22023';
  end if;

  insert into public.vehicles (
    organization_id, primary_branch_id, vin, registration_no, registration_country, model_id,
    model_year, trim, color, battery_kwh, status
  ) values (
    p_organization_id, p_branch_id, v_vin, trim(p_registration_no), 'JO', p_model_id,
    p_model_year, nullif(trim(p_trim), ''), v_color, p_battery_kwh, 'active'
  ) returning * into v_vehicle;

  insert into public.vehicle_ownerships (
    organization_id, vehicle_id, customer_id, relationship, verified_at, verified_by
  ) values (
    p_organization_id, v_vehicle.id, p_customer_id, 'owner', now(), auth.uid()
  );

  if p_odometer_km is not null then
    insert into public.odometer_readings (
      organization_id, branch_id, vehicle_id, reading_km, source, recorded_by
    ) values (
      p_organization_id, p_branch_id, v_vehicle.id, p_odometer_km, 'registration', auth.uid()
    );
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'insert', 'public.vehicles', v_vehicle.id,
    jsonb_build_object(
      'branch_id', p_branch_id,
      'primary_branch_id', p_branch_id,
      'customer_id', p_customer_id,
      'color', v_color
    )
  );

  return v_vehicle;
end;
$$;

drop function if exists public.update_vehicle_profile(uuid, uuid, text, text, text, date, date, date, integer);

create function public.update_vehicle_profile(
  p_vehicle_id uuid,
  p_branch_id uuid,
  p_drive_unit text,
  p_connectivity_status text,
  p_software_version text,
  p_first_registration_date date,
  p_warranty_start_date date,
  p_warranty_end_date date,
  p_warranty_distance_km integer,
  p_color text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_color text := nullif(trim(p_color), '');
begin
  select * into strict v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if not app_private.has_permission(v_vehicle.organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to manage this vehicle' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = v_vehicle.organization_id and b.status = 'active'
  )
     or p_connectivity_status not in ('unknown', 'connected', 'disconnected', 'not_supported')
     or (p_warranty_end_date is not null and p_warranty_start_date is not null and p_warranty_end_date < p_warranty_start_date)
     or (p_warranty_distance_km is not null and p_warranty_distance_km <= 0)
     or (v_color is not null and char_length(v_color) > 80) then
    raise exception 'Vehicle profile details are invalid' using errcode = '22023';
  end if;

  update public.vehicles set
    primary_branch_id = p_branch_id,
    drive_unit = nullif(trim(p_drive_unit), ''),
    connectivity_status = p_connectivity_status,
    software_version = nullif(trim(p_software_version), ''),
    first_registration_date = p_first_registration_date,
    warranty_start_date = p_warranty_start_date,
    warranty_end_date = p_warranty_end_date,
    warranty_distance_km = p_warranty_distance_km,
    color = case when p_color is null then color else v_color end,
    updated_at = now()
  where id = v_vehicle.id returning * into v_vehicle;

  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_vehicle.organization_id,
    auth.uid(),
    'vehicle.profile_updated',
    'vehicle',
    v_vehicle.id,
    jsonb_build_object(
      'branch_id', p_branch_id,
      'primary_branch_id', p_branch_id,
      'connectivity_status', p_connectivity_status,
      'warranty_end_date', p_warranty_end_date,
      'warranty_distance_km', p_warranty_distance_km,
      'color', v_vehicle.color
    )
  );
  return v_vehicle;
end;
$$;

revoke all on function public.create_vehicle(uuid, uuid, uuid, uuid, text, text, integer, text, numeric, integer, text) from public, anon;
revoke all on function public.update_vehicle_profile(uuid, uuid, text, text, text, date, date, date, integer, text) from public, anon;
grant execute on function public.create_vehicle(uuid, uuid, uuid, uuid, text, text, integer, text, numeric, integer, text) to authenticated;
grant execute on function public.update_vehicle_profile(uuid, uuid, text, text, text, date, date, date, integer, text) to authenticated;
