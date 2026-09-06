-- Backward compatible: retain create_vehicle's signature and return type.
-- Existing identities and factory-warranty data are never rewritten.
create or replace function public.create_vehicle(
  p_organization_id uuid, p_branch_id uuid, p_customer_id uuid, p_model_id uuid,
  p_vin text, p_registration_no text, p_model_year integer default null,
  p_trim text default null, p_battery_kwh numeric default null,
  p_odometer_km integer default null, p_color text default null
) returns public.vehicles
language plpgsql security definer set search_path = '' as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_vin text := upper(nullif(regexp_replace(trim(p_vin), '\s', '', 'g'), ''));
  v_plate text := nullif(trim(p_registration_no), '');
  v_plate_key text := upper(regexp_replace(v_plate, '\s', '', 'g'));
  v_color text := nullif(trim(p_color), '');
begin
  if auth.uid() is null or not app_private.has_permission(p_organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to create vehicles for this branch' using errcode = '42501';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and organization_id = p_organization_id and status = 'active') then
    raise exception 'Branch is invalid' using errcode = '23514';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and organization_id = p_organization_id and status = 'active') then
    raise exception 'Customer is invalid' using errcode = '23514';
  end if;
  if not exists (select 1 from public.vehicle_models where id = p_model_id and (organization_id is null or organization_id = p_organization_id)) then
    raise exception 'Vehicle model is invalid' using errcode = '23514';
  end if;
  if (v_vin is null and v_plate is null)
    or (v_vin is not null and v_vin !~ '^[A-HJ-NPR-Z0-9]{17}$')
    or char_length(v_plate) > 40
    or (p_model_year is not null and p_model_year not between 2019 and extract(year from current_date)::integer + 1)
    or (p_battery_kwh is not null and p_battery_kwh <= 0)
    or (p_odometer_km is not null and p_odometer_km < 0)
    or char_length(v_color) > 80 then
    raise exception 'Enter a plate or valid VIN and valid vehicle measurements.' using errcode = '22023';
  end if;
  -- Serialize duplicate checks for new JO plates without rebuilding an index
  -- over potentially duplicated historical records. VIN already has a unique index.
  if v_plate is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || ':JO:' || v_plate_key, 0));
    if exists (select 1 from public.vehicles where organization_id = p_organization_id
      and registration_country = 'JO' and upper(regexp_replace(registration_no, '\s', '', 'g')) = v_plate_key) then
      raise exception 'A vehicle with this registration already exists.' using errcode = '23505';
    end if;
  end if;
  insert into public.vehicles(organization_id, primary_branch_id, vin, registration_no, registration_country,
    model_id, model_year, trim, color, battery_kwh, status)
  values (p_organization_id, p_branch_id, v_vin, v_plate, 'JO', p_model_id, p_model_year,
    nullif(trim(p_trim), ''), v_color, p_battery_kwh, 'active') returning * into v_vehicle;
  insert into public.vehicle_ownerships(organization_id, vehicle_id, customer_id, relationship, verified_at, verified_by)
  values (p_organization_id, v_vehicle.id, p_customer_id, 'owner', now(), auth.uid());
  if p_odometer_km is not null then
    insert into public.odometer_readings(organization_id, branch_id, vehicle_id, reading_km, source, recorded_by)
    values (p_organization_id, p_branch_id, v_vehicle.id, p_odometer_km, 'registration', auth.uid());
  end if;
  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'insert', 'public.vehicles', v_vehicle.id,
    jsonb_build_object('branch_id', p_branch_id, 'customer_id', p_customer_id, 'identity_incomplete', v_vin is null or v_plate is null));
  return v_vehicle;
end;
$$;
revoke all on function public.create_vehicle(uuid, uuid, uuid, uuid, text, text, integer, text, numeric, integer, text) from public, anon;
grant execute on function public.create_vehicle(uuid, uuid, uuid, uuid, text, text, integer, text, numeric, integer, text) to authenticated;

-- Only complete an absent identifier. Correcting an existing identifier needs
-- a separately reviewed workflow; this endpoint cannot overwrite it.
create or replace function public.complete_vehicle_identity(p_vehicle_id uuid, p_branch_id uuid, p_vin text, p_registration_no text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v public.vehicles%rowtype;
  v_vin text := upper(nullif(regexp_replace(trim(p_vin), '\s', '', 'g'), ''));
  v_plate text := nullif(trim(p_registration_no), '');
begin
  select * into strict v from public.vehicles where id = p_vehicle_id for update;
  if auth.uid() is null or not app_private.has_permission(v.organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to manage this vehicle' using errcode = '42501';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and organization_id = v.organization_id and status = 'active') then
    raise exception 'Branch is invalid' using errcode = '23514';
  end if;
  if (v_vin is not null and v_vin !~ '^[A-HJ-NPR-Z0-9]{17}$') or char_length(v_plate) > 40
    or (v.vin is not null and v_vin is distinct from v.vin)
    or (v.registration_no is not null and v_plate is distinct from v.registration_no)
    or (v_vin is null and v_plate is null) then
    raise exception 'Existing vehicle identifiers cannot be changed here.' using errcode = '22023';
  end if;
  if v.registration_no is null and v_plate is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v.organization_id::text || ':JO:' || upper(regexp_replace(v_plate, '\s', '', 'g')), 0));
    if exists (select 1 from public.vehicles where organization_id = v.organization_id and id <> v.id
      and registration_country = 'JO' and upper(regexp_replace(registration_no, '\s', '', 'g')) = upper(regexp_replace(v_plate, '\s', '', 'g'))) then
      raise exception 'A vehicle with this registration already exists.' using errcode = '23505';
    end if;
  end if;
  update public.vehicles set vin = coalesce(v.vin, v_vin), registration_no = coalesce(v.registration_no, v_plate), updated_at = now() where id = v.id;
  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values(v.organization_id, auth.uid(), 'vehicle.identity_completed', 'vehicle', v.id,
    jsonb_build_object('branch_id', p_branch_id, 'vin_added', v.vin is null and v_vin is not null,
      'plate_added', v.registration_no is null and v_plate is not null));
  return v.id;
end;
$$;
revoke all on function public.complete_vehicle_identity(uuid, uuid, text, text) from public, anon;
grant execute on function public.complete_vehicle_identity(uuid, uuid, text, text) to authenticated;
