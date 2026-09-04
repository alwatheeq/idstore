-- Narrow command endpoints for branch and CRM record creation.
-- Authenticated clients retain read-only table grants; writes flow through these
-- functions so organization, branch and permission checks stay transactional.

create or replace function public.create_branch(
  p_organization_id uuid,
  p_code text,
  p_legal_name text,
  p_display_name text,
  p_city text,
  p_address_line1 text default null,
  p_phone text default null,
  p_email text default null,
  p_tax_registration text default null,
  p_hv_capable boolean default false
)
returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches%rowtype;
  v_code text := upper(trim(p_code));
begin
  if not app_private.is_admin(p_organization_id) then
    raise exception 'Not authorized to manage branches' using errcode = '42501';
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,15}$'
     or nullif(trim(p_legal_name), '') is null
     or nullif(trim(p_display_name), '') is null
     or nullif(trim(p_city), '') is null then
    raise exception 'Branch code, legal name, display name and city are required' using errcode = '22023';
  end if;

  insert into public.branches (
    organization_id, code, legal_name, display_name, city, address_json,
    phone, email, tax_registration, country_code, timezone, currency, status
  ) values (
    p_organization_id, v_code, trim(p_legal_name), trim(p_display_name), trim(p_city),
    case when nullif(trim(p_address_line1), '') is null then '{}'::jsonb
         else jsonb_build_object('line1', trim(p_address_line1)) end,
    nullif(trim(p_phone), ''), nullif(trim(p_email), ''), nullif(trim(p_tax_registration), ''),
    'JO', 'Asia/Amman', 'JOD', 'active'
  ) returning * into v_branch;

  insert into public.warehouses (organization_id, branch_id, code, name)
  values (p_organization_id, v_branch.id, 'MAIN', v_branch.display_name || ' Main');

  if p_hv_capable then
    insert into public.branch_capabilities (
      organization_id, branch_id, capability_code, status
    ) values (
      p_organization_id, v_branch.id, 'HV_SERVICE', 'active'
    );
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'insert', 'public.branches', v_branch.id,
    jsonb_build_object('code', v_branch.code, 'city', v_branch.city)
  );

  return v_branch;
end;
$$;

create or replace function public.create_customer(
  p_organization_id uuid,
  p_preferred_branch_id uuid,
  p_customer_type text,
  p_display_name text,
  p_mobile text default null,
  p_email text default null,
  p_city text default null,
  p_address_line1 text default null,
  p_tax_number text default null,
  p_notes text default null
)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
begin
  if p_preferred_branch_id is null or not app_private.has_permission(
    p_organization_id, p_preferred_branch_id, 'crm.manage'
  ) then
    raise exception 'Not authorized to create customers for this branch' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.branches b
    where b.id = p_preferred_branch_id
      and b.organization_id = p_organization_id
      and b.status = 'active'
  ) then
    raise exception 'Preferred branch is invalid' using errcode = '23514';
  end if;
  if p_customer_type not in ('individual', 'company')
     or nullif(trim(p_display_name), '') is null then
    raise exception 'A valid customer type and display name are required' using errcode = '22023';
  end if;

  insert into public.customers (
    organization_id, customer_type, display_name, legal_name, tax_number,
    preferred_locale, preferred_branch_id, notes, status
  ) values (
    p_organization_id, p_customer_type, trim(p_display_name),
    case when p_customer_type = 'company' then trim(p_display_name) else null end,
    nullif(trim(p_tax_number), ''), 'ar-JO', p_preferred_branch_id,
    nullif(trim(p_notes), ''), 'active'
  ) returning * into v_customer;

  if nullif(trim(p_mobile), '') is not null then
    insert into public.customer_contacts (
      organization_id, customer_id, kind, value, normalized_value, is_primary
    ) values (
      p_organization_id, v_customer.id, 'mobile', trim(p_mobile),
      regexp_replace(trim(p_mobile), '[^0-9+]', '', 'g'), true
    );
  end if;

  if nullif(trim(p_email), '') is not null then
    insert into public.customer_contacts (
      organization_id, customer_id, kind, value, normalized_value, is_primary
    ) values (
      p_organization_id, v_customer.id, 'email', lower(trim(p_email)),
      lower(trim(p_email)), true
    );
  end if;

  if nullif(trim(p_city), '') is not null and nullif(trim(p_address_line1), '') is not null then
    insert into public.customer_addresses (
      organization_id, customer_id, address_type, country_code, city,
      address_line1, is_primary
    ) values (
      p_organization_id, v_customer.id, 'billing', 'JO', trim(p_city),
      trim(p_address_line1), true
    );
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'insert', 'public.customers', v_customer.id,
    jsonb_build_object('customer_type', v_customer.customer_type, 'branch_id', p_preferred_branch_id)
  );

  return v_customer;
end;
$$;

create or replace function public.create_vehicle(
  p_organization_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_model_id uuid,
  p_vin text,
  p_registration_no text,
  p_model_year integer default null,
  p_trim text default null,
  p_battery_kwh numeric default null,
  p_odometer_km integer default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_vin text := upper(nullif(regexp_replace(trim(p_vin), '\s', '', 'g'), ''));
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
     or p_odometer_km is not null and p_odometer_km < 0 then
    raise exception 'VIN, registration or vehicle measurements are invalid' using errcode = '22023';
  end if;

  insert into public.vehicles (
    organization_id, vin, registration_no, registration_country, model_id,
    model_year, trim, battery_kwh, status
  ) values (
    p_organization_id, v_vin, trim(p_registration_no), 'JO', p_model_id,
    p_model_year, nullif(trim(p_trim), ''), p_battery_kwh, 'active'
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
    jsonb_build_object('branch_id', p_branch_id, 'customer_id', p_customer_id)
  );

  return v_vehicle;
end;
$$;

revoke all on function public.create_branch(uuid, text, text, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.create_customer(uuid, uuid, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.create_vehicle(uuid, uuid, uuid, uuid, text, text, integer, text, numeric, integer) from public, anon;

grant execute on function public.create_branch(uuid, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.create_customer(uuid, uuid, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_vehicle(uuid, uuid, uuid, uuid, text, text, integer, text, numeric, integer) to authenticated;
