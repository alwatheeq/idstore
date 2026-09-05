-- Convert signed vehicle check-in evidence into exactly one linked repair order.

create unique index repair_orders_one_per_appointment
  on public.repair_orders(appointment_id)
  where appointment_id is not null;

create or replace function public.open_repair_order_from_checkin(p_appointment_id uuid)
returns public.repair_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_checkin public.vehicle_checkins%rowtype;
  v_order public.repair_orders%rowtype;
  v_services text;
  v_concern text;
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;
  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  if not app_private.has_permission(v_appointment.organization_id, v_appointment.branch_id, 'repair_order.manage') then
    raise exception 'Not authorized to open a repair order for this branch' using errcode = '42501';
  end if;
  if v_appointment.status <> 'checked_in' then
    raise exception 'The vehicle must complete signed check-in before a repair order is opened' using errcode = '23514';
  end if;
  if exists (select 1 from public.repair_orders r where r.appointment_id = v_appointment.id) then
    raise exception 'This appointment already has a repair order' using errcode = '23505';
  end if;

  select * into v_checkin
  from public.vehicle_checkins
  where appointment_id = v_appointment.id;
  if not found then
    raise exception 'Signed vehicle check-in evidence was not found' using errcode = '23514';
  end if;

  select string_agg(item.template_name_en, ', ' order by item.created_at, item.id)
  into v_services
  from public.appointment_service_items item
  where item.appointment_id = v_appointment.id;

  v_concern := concat_ws(' · ',
    case when nullif(v_services, '') is not null then 'Booked services: ' || v_services end,
    nullif(trim(v_appointment.notes), '')
  );

  select * into v_order
  from public.create_repair_order(
    v_appointment.organization_id,
    v_appointment.branch_id,
    v_appointment.customer_id,
    v_appointment.vehicle_id,
    v_appointment.id,
    v_checkin.odometer_km,
    v_checkin.state_of_charge,
    nullif(v_concern, ''),
    v_appointment.promised_at
  );

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_order.organization_id,
    auth.uid(),
    'repair_order.opened_from_checkin',
    'repair_order',
    v_order.id,
    jsonb_build_object(
      'appointment_id', v_appointment.id,
      'checkin_id', v_checkin.id,
      'service_count', (select count(*) from public.appointment_service_items item where item.appointment_id = v_appointment.id),
      'odometer_km', v_checkin.odometer_km,
      'state_of_charge', v_checkin.state_of_charge
    )
  );

  return v_order;
end;
$$;

revoke all on function public.open_repair_order_from_checkin(uuid) from public, anon, authenticated;
grant execute on function public.open_repair_order_from_checkin(uuid) to authenticated;

comment on function public.open_repair_order_from_checkin(uuid)
  is 'Opens one linked repair order from signed appointment check-in evidence and catalog service snapshots.';
