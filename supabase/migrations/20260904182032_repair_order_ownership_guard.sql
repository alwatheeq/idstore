-- Ensure the customer selected at intake currently owns or is authorized for
-- the vehicle. This prevents cross-customer repair orders inside one tenant.

create or replace function public.create_repair_order(
  p_organization_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_appointment_id uuid default null,
  p_odometer_km integer default null,
  p_state_of_charge numeric default null,
  p_customer_concern text default null,
  p_promised_at timestamptz default null
)
returns public.repair_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch_code text;
  v_number text;
  v_order public.repair_orders%rowtype;
begin
  if not app_private.has_permission(p_organization_id, p_branch_id, 'repair_order.manage') then
    raise exception 'Not authorized to create repair orders' using errcode = '42501';
  end if;

  select b.code into strict v_branch_code
  from public.branches b
  where b.id = p_branch_id and b.organization_id = p_organization_id and b.status = 'active';

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.organization_id = p_organization_id and c.status = 'active'
  ) then
    raise exception 'Customer does not belong to organization' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.organization_id = p_organization_id and v.status <> 'archived'
  ) then
    raise exception 'Vehicle does not belong to organization' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.vehicle_ownerships ownership
    where ownership.organization_id = p_organization_id
      and ownership.customer_id = p_customer_id
      and ownership.vehicle_id = p_vehicle_id
      and ownership.valid_from <= current_date
      and (ownership.valid_to is null or ownership.valid_to >= current_date)
  ) then
    raise exception 'Customer is not linked to the selected vehicle' using errcode = '23514';
  end if;
  if p_appointment_id is not null and not exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id and a.organization_id = p_organization_id and a.branch_id = p_branch_id
  ) then
    raise exception 'Appointment does not belong to branch' using errcode = '23514';
  end if;
  if p_odometer_km is not null and p_odometer_km < 0 then
    raise exception 'Odometer cannot be negative' using errcode = '22023';
  end if;
  if p_state_of_charge is not null and p_state_of_charge not between 0 and 100 then
    raise exception 'State of charge must be between 0 and 100' using errcode = '22023';
  end if;

  select d.document_number into strict v_number
  from app_private.take_document_number(
    p_organization_id, p_branch_id, 'repair_order', v_branch_code || '-RO-'
  ) d;

  insert into public.repair_orders (
    organization_id, branch_id, ro_number, customer_id, vehicle_id, appointment_id,
    status, odometer_km, state_of_charge, customer_concern, promised_at, created_by
  ) values (
    p_organization_id, p_branch_id, v_number, p_customer_id, p_vehicle_id, p_appointment_id,
    'checked_in', p_odometer_km, p_state_of_charge, p_customer_concern, p_promised_at, auth.uid()
  ) returning * into v_order;

  insert into public.repair_order_events (
    organization_id, branch_id, repair_order_id, from_status, to_status, actor_id
  ) values (
    p_organization_id, p_branch_id, v_order.id, null, 'checked_in', auth.uid()
  );

  return v_order;
end;
$$;

revoke all on function public.create_repair_order(uuid, uuid, uuid, uuid, uuid, integer, numeric, text, timestamptz) from public, anon;
grant execute on function public.create_repair_order(uuid, uuid, uuid, uuid, uuid, integer, numeric, text, timestamptz) to authenticated;
