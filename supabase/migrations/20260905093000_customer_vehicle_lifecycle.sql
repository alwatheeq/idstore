-- Complete CRM identity, address, ownership, odometer and VW ID profile workflows.

alter table public.vehicles
  add column if not exists drive_unit text,
  add column if not exists connectivity_status text not null default 'unknown',
  add column if not exists first_registration_date date,
  add column if not exists warranty_start_date date,
  add column if not exists warranty_end_date date,
  add column if not exists warranty_distance_km integer;

alter table public.vehicles
  drop constraint if exists vehicles_connectivity_status_check,
  add constraint vehicles_connectivity_status_check
    check (connectivity_status in ('unknown', 'connected', 'disconnected', 'not_supported')),
  drop constraint if exists vehicles_warranty_dates_check,
  add constraint vehicles_warranty_dates_check
    check (warranty_end_date is null or warranty_start_date is null or warranty_end_date >= warranty_start_date),
  drop constraint if exists vehicles_warranty_distance_check,
  add constraint vehicles_warranty_distance_check
    check (warranty_distance_km is null or warranty_distance_km > 0);

create index if not exists customer_addresses_customer_type
  on public.customer_addresses(customer_id, address_type, is_primary desc);

create or replace function public.find_customer_duplicates(
  p_organization_id uuid,
  p_display_name text default null,
  p_normalized_contact text default null,
  p_tax_number text default null
)
returns table(customer_id uuid, display_name text, status text, match_reasons text[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  ) then
    raise exception 'Not authorized to search customer records' using errcode = '42501';
  end if;

  return query
  select c.id, c.display_name, c.status,
    array_remove(array[
      case when nullif(trim(p_display_name), '') is not null
             and lower(trim(c.display_name)) = lower(trim(p_display_name)) then 'name' end,
      case when nullif(trim(p_tax_number), '') is not null
             and lower(trim(coalesce(c.tax_number, ''))) = lower(trim(p_tax_number)) then 'tax_number' end,
      case when nullif(trim(p_normalized_contact), '') is not null and exists (
             select 1 from public.customer_contacts cc
             where cc.customer_id = c.id
               and cc.normalized_value = trim(p_normalized_contact)
           ) then 'contact' end
    ], null)::text[]
  from public.customers c
  where c.organization_id = p_organization_id
    and c.status <> 'anonymized'
    and (
      (nullif(trim(p_display_name), '') is not null and lower(trim(c.display_name)) = lower(trim(p_display_name)))
      or (nullif(trim(p_tax_number), '') is not null and lower(trim(coalesce(c.tax_number, ''))) = lower(trim(p_tax_number)))
      or (nullif(trim(p_normalized_contact), '') is not null and exists (
        select 1 from public.customer_contacts cc
        where cc.customer_id = c.id and cc.normalized_value = trim(p_normalized_contact)
      ))
    )
  order by c.created_at desc;
end;
$$;

create or replace function public.add_customer_address(
  p_customer_id uuid,
  p_address_type text,
  p_country_code text,
  p_admin_area text,
  p_city text,
  p_address_line1 text,
  p_address_line2 text,
  p_postal_code text,
  p_is_primary boolean
)
returns public.customer_addresses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_address public.customer_addresses%rowtype;
begin
  select * into strict v_customer from public.customers where id = p_customer_id;
  if v_customer.preferred_branch_id is null or not app_private.has_permission(
    v_customer.organization_id, v_customer.preferred_branch_id, 'crm.manage'
  ) then
    raise exception 'Not authorized to manage this customer' using errcode = '42501';
  end if;
  if v_customer.status = 'anonymized'
     or p_address_type not in ('billing', 'service', 'home', 'work')
     or upper(trim(p_country_code)) !~ '^[A-Z]{2}$'
     or nullif(trim(p_city), '') is null
     or nullif(trim(p_address_line1), '') is null then
    raise exception 'Address details are invalid' using errcode = '22023';
  end if;

  if p_is_primary then
    update public.customer_addresses
    set is_primary = false, updated_at = now()
    where customer_id = v_customer.id and address_type = p_address_type and is_primary;
  end if;

  insert into public.customer_addresses(
    organization_id, customer_id, address_type, country_code, admin_area, city,
    address_line1, address_line2, postal_code, is_primary
  ) values (
    v_customer.organization_id, v_customer.id, p_address_type,
    upper(trim(p_country_code)), nullif(trim(p_admin_area), ''), trim(p_city),
    trim(p_address_line1), nullif(trim(p_address_line2), ''),
    nullif(trim(p_postal_code), ''), p_is_primary
  ) returning * into v_address;

  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_customer.organization_id, auth.uid(), 'customer.address_added', 'customer', v_customer.id,
    jsonb_build_object('address_id', v_address.id, 'address_type', v_address.address_type, 'primary', v_address.is_primary));
  return v_address;
end;
$$;

create or replace function public.transition_customer_status(
  p_customer_id uuid,
  p_to_status text,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_from_status text;
begin
  select * into strict v_customer from public.customers where id = p_customer_id for update;
  if v_customer.preferred_branch_id is null or not app_private.has_permission(
    v_customer.organization_id, v_customer.preferred_branch_id, 'crm.manage'
  ) then
    raise exception 'Not authorized to manage this customer' using errcode = '42501';
  end if;
  if p_to_status not in ('active', 'restricted', 'archived')
     or nullif(trim(p_reason), '') is null
     or v_customer.status = 'anonymized' then
    raise exception 'Customer status transition is invalid' using errcode = '22023';
  end if;
  if v_customer.status = p_to_status then return v_customer; end if;

  v_from_status := v_customer.status;
  update public.customers set status = p_to_status, updated_at = now()
  where id = v_customer.id returning * into v_customer;

  if p_to_status <> 'active' then
    update public.customer_accounts set status = 'revoked'
    where customer_id = v_customer.id and organization_id = v_customer.organization_id and status <> 'revoked';
  end if;

  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_customer.organization_id, auth.uid(), 'customer.status_changed', 'customer', v_customer.id,
    jsonb_build_object('from', v_from_status, 'to', p_to_status, 'reason', trim(p_reason)));
  return v_customer;
end;
$$;

create or replace function public.update_vehicle_profile(
  p_vehicle_id uuid,
  p_branch_id uuid,
  p_drive_unit text,
  p_connectivity_status text,
  p_software_version text,
  p_first_registration_date date,
  p_warranty_start_date date,
  p_warranty_end_date date,
  p_warranty_distance_km integer
)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare v_vehicle public.vehicles%rowtype;
begin
  select * into strict v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if not app_private.has_permission(v_vehicle.organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to manage this vehicle' using errcode = '42501';
  end if;
  if not exists (select 1 from public.branches b where b.id = p_branch_id and b.organization_id = v_vehicle.organization_id and b.status = 'active')
     or p_connectivity_status not in ('unknown', 'connected', 'disconnected', 'not_supported')
     or (p_warranty_end_date is not null and p_warranty_start_date is not null and p_warranty_end_date < p_warranty_start_date)
     or (p_warranty_distance_km is not null and p_warranty_distance_km <= 0) then
    raise exception 'Vehicle profile details are invalid' using errcode = '22023';
  end if;

  update public.vehicles set
    drive_unit = nullif(trim(p_drive_unit), ''), connectivity_status = p_connectivity_status,
    software_version = nullif(trim(p_software_version), ''), first_registration_date = p_first_registration_date,
    warranty_start_date = p_warranty_start_date, warranty_end_date = p_warranty_end_date,
    warranty_distance_km = p_warranty_distance_km, updated_at = now()
  where id = v_vehicle.id returning * into v_vehicle;

  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_vehicle.organization_id, auth.uid(), 'vehicle.profile_updated', 'vehicle', v_vehicle.id,
    jsonb_build_object('branch_id', p_branch_id, 'connectivity_status', p_connectivity_status,
      'warranty_end_date', p_warranty_end_date, 'warranty_distance_km', p_warranty_distance_km));
  return v_vehicle;
end;
$$;

create or replace function public.add_vehicle_ownership(
  p_vehicle_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_relationship text,
  p_valid_from date,
  p_verified boolean
)
returns public.vehicle_ownerships
language plpgsql
security definer
set search_path = ''
as $$
declare v_vehicle public.vehicles%rowtype; v_ownership public.vehicle_ownerships%rowtype;
begin
  select * into strict v_vehicle from public.vehicles where id = p_vehicle_id;
  if not app_private.has_permission(v_vehicle.organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to manage vehicle ownership' using errcode = '42501';
  end if;
  if p_relationship not in ('owner', 'driver', 'fleet_manager', 'authorized_contact')
     or p_valid_from is null
     or not exists (select 1 from public.branches b where b.id = p_branch_id and b.organization_id = v_vehicle.organization_id and b.status = 'active')
     or not exists (select 1 from public.customers c where c.id = p_customer_id and c.organization_id = v_vehicle.organization_id and c.status = 'active') then
    raise exception 'Ownership details are invalid' using errcode = '22023';
  end if;
  if exists (select 1 from public.vehicle_ownerships o where o.vehicle_id = v_vehicle.id and o.customer_id = p_customer_id and o.relationship = p_relationship and o.valid_to is null) then
    raise exception 'This active ownership relationship already exists' using errcode = '23505';
  end if;

  insert into public.vehicle_ownerships(organization_id, vehicle_id, customer_id, relationship, valid_from, verified_at, verified_by)
  values (v_vehicle.organization_id, v_vehicle.id, p_customer_id, p_relationship, p_valid_from,
    case when p_verified then now() end, case when p_verified then auth.uid() end)
  returning * into v_ownership;
  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_vehicle.organization_id, auth.uid(), 'vehicle.ownership_added', 'vehicle', v_vehicle.id,
    jsonb_build_object('ownership_id', v_ownership.id, 'customer_id', p_customer_id, 'relationship', p_relationship, 'branch_id', p_branch_id));
  return v_ownership;
end;
$$;

create or replace function public.end_vehicle_ownership(
  p_ownership_id uuid,
  p_branch_id uuid,
  p_valid_to date,
  p_reason text
)
returns public.vehicle_ownerships
language plpgsql
security definer
set search_path = ''
as $$
declare v_ownership public.vehicle_ownerships%rowtype;
begin
  select * into strict v_ownership from public.vehicle_ownerships where id = p_ownership_id for update;
  if not app_private.has_permission(v_ownership.organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to manage vehicle ownership' using errcode = '42501';
  end if;
  if v_ownership.valid_to is not null or p_valid_to is null or p_valid_to < v_ownership.valid_from or nullif(trim(p_reason), '') is null then
    raise exception 'Ownership end details are invalid' using errcode = '22023';
  end if;
  update public.vehicle_ownerships set valid_to = p_valid_to where id = v_ownership.id returning * into v_ownership;
  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_ownership.organization_id, auth.uid(), 'vehicle.ownership_ended', 'vehicle', v_ownership.vehicle_id,
    jsonb_build_object('ownership_id', v_ownership.id, 'valid_to', p_valid_to, 'reason', trim(p_reason), 'branch_id', p_branch_id));
  return v_ownership;
end;
$$;

create or replace function public.record_odometer_reading(
  p_vehicle_id uuid,
  p_branch_id uuid,
  p_reading_km integer,
  p_source text,
  p_correction_reason text
)
returns public.odometer_readings
language plpgsql
security definer
set search_path = ''
as $$
declare v_vehicle public.vehicles%rowtype; v_reading public.odometer_readings%rowtype; v_latest integer;
begin
  select * into strict v_vehicle from public.vehicles where id = p_vehicle_id;
  if not app_private.has_permission(v_vehicle.organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to record odometer readings' using errcode = '42501';
  end if;
  select max(reading_km) into v_latest from public.odometer_readings where vehicle_id = v_vehicle.id;
  if p_reading_km is null or p_reading_km < 0 or nullif(trim(p_source), '') is null then
    raise exception 'Odometer details are invalid' using errcode = '22023';
  end if;
  if v_latest is not null and p_reading_km < v_latest then
    if nullif(trim(p_correction_reason), '') is null or not app_private.is_admin(v_vehicle.organization_id) then
      raise exception 'A lower odometer reading requires administrator approval and a correction reason' using errcode = '42501';
    end if;
  end if;

  insert into public.odometer_readings(organization_id, branch_id, vehicle_id, reading_km, source, correction_reason, recorded_by)
  values (v_vehicle.organization_id, p_branch_id, v_vehicle.id, p_reading_km, trim(p_source), nullif(trim(p_correction_reason), ''), auth.uid())
  returning * into v_reading;
  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_vehicle.organization_id, auth.uid(), 'vehicle.odometer_recorded', 'vehicle', v_vehicle.id,
    jsonb_build_object('reading_id', v_reading.id, 'reading_km', p_reading_km, 'source', trim(p_source),
      'correction', v_latest is not null and p_reading_km < v_latest, 'branch_id', p_branch_id));
  return v_reading;
end;
$$;

revoke all on function public.find_customer_duplicates(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.add_customer_address(uuid, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.transition_customer_status(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_vehicle_profile(uuid, uuid, text, text, text, date, date, date, integer) from public, anon, authenticated;
revoke all on function public.add_vehicle_ownership(uuid, uuid, uuid, text, date, boolean) from public, anon, authenticated;
revoke all on function public.end_vehicle_ownership(uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function public.record_odometer_reading(uuid, uuid, integer, text, text) from public, anon, authenticated;

grant execute on function public.find_customer_duplicates(uuid, text, text, text) to authenticated;
grant execute on function public.add_customer_address(uuid, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.transition_customer_status(uuid, text, text) to authenticated;
grant execute on function public.update_vehicle_profile(uuid, uuid, text, text, text, date, date, date, integer) to authenticated;
grant execute on function public.add_vehicle_ownership(uuid, uuid, uuid, text, date, boolean) to authenticated;
grant execute on function public.end_vehicle_ownership(uuid, uuid, date, text) to authenticated;
grant execute on function public.record_odometer_reading(uuid, uuid, integer, text, text) to authenticated;
