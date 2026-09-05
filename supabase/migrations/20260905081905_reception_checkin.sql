-- Guided reception check-in with ownership verification and signed condition evidence.

create table public.vehicle_checkins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  odometer_km integer not null check (odometer_km >= 0),
  state_of_charge numeric(5,2) check (state_of_charge between 0 and 100),
  keys_count integer not null default 1 check (keys_count between 0 and 10),
  accessories jsonb not null default '[]'::jsonb check (jsonb_typeof(accessories)='array'),
  warning_lights jsonb not null default '[]'::jsonb check (jsonb_typeof(warning_lights)='array'),
  ownership_verified boolean not null,
  diagnosis_authorized boolean not null,
  road_test_authorized boolean not null,
  signer_name text not null,
  signature_hash text not null check (signature_hash ~ '^[a-f0-9]{64}$'),
  signed_at timestamptz not null default now(),
  received_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(appointment_id)
);

create table public.checkin_condition_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  checkin_id uuid not null references public.vehicle_checkins(id) on delete cascade,
  zone text not null check (zone in ('front','rear','left','right','roof','interior','wheels','cargo','other')),
  condition text not null check (condition in ('clear','noted','damaged')),
  notes text,
  photo_attachment_id uuid references public.attachments(id) on delete set null,
  created_at timestamptz not null default now()
);

create index checkin_vehicle_history on public.vehicle_checkins(vehicle_id,created_at desc);
create index checkin_condition_parent on public.checkin_condition_items(checkin_id,zone);
create trigger assert_branch_organization before insert or update of organization_id,branch_id on public.vehicle_checkins for each row execute function app_private.assert_branch_organization();
create trigger assert_branch_organization before insert or update of organization_id,branch_id on public.checkin_condition_items for each row execute function app_private.assert_branch_organization();
alter table public.vehicle_checkins enable row level security;
alter table public.checkin_condition_items enable row level security;
create policy vehicle_checkins_select on public.vehicle_checkins for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));
create policy checkin_condition_items_select on public.checkin_condition_items for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));
grant select on public.vehicle_checkins,public.checkin_condition_items to authenticated;

create or replace function public.complete_vehicle_checkin(
  p_appointment_id uuid,p_expected_version bigint,p_odometer_km integer,p_state_of_charge numeric,
  p_keys_count integer,p_accessories jsonb,p_warning_lights jsonb,p_ownership_verified boolean,
  p_diagnosis_authorized boolean,p_road_test_authorized boolean,p_signer_name text,p_condition_items jsonb,
  p_odometer_correction_reason text
) returns public.vehicle_checkins language plpgsql security definer set search_path='' as $$
declare v_appointment public.appointments%rowtype; v_checkin public.vehicle_checkins%rowtype; v_item jsonb; v_latest integer; v_signed_at timestamptz:=now();
begin
  select * into strict v_appointment from public.appointments where id=p_appointment_id for update;
  if not app_private.has_permission(v_appointment.organization_id,v_appointment.branch_id,'appointments.manage') then raise exception 'Not authorized to check in this vehicle' using errcode='42501'; end if;
  if v_appointment.status<>'confirmed' or v_appointment.version<>p_expected_version then raise exception 'Appointment must be confirmed and current before check-in' using errcode='40001'; end if;
  if p_odometer_km is null or p_odometer_km<0 or p_state_of_charge is not null and p_state_of_charge not between 0 and 100 or p_keys_count not between 0 and 10 or jsonb_typeof(coalesce(p_accessories,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_warning_lights,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_condition_items,'[]'::jsonb))<>'array' or not p_ownership_verified or not p_diagnosis_authorized or nullif(trim(p_signer_name),'') is null then raise exception 'Check-in evidence and authorization are incomplete' using errcode='22023'; end if;
  select max(reading_km) into v_latest from public.odometer_readings where vehicle_id=v_appointment.vehicle_id;
  if v_latest is not null and p_odometer_km<v_latest and (nullif(trim(p_odometer_correction_reason),'') is null or not app_private.is_admin(v_appointment.organization_id)) then raise exception 'A lower odometer requires administrator approval and correction reason' using errcode='42501'; end if;
  insert into public.vehicle_checkins(organization_id,branch_id,appointment_id,customer_id,vehicle_id,odometer_km,state_of_charge,keys_count,accessories,warning_lights,ownership_verified,diagnosis_authorized,road_test_authorized,signer_name,signature_hash,signed_at,received_by)
  values(v_appointment.organization_id,v_appointment.branch_id,v_appointment.id,v_appointment.customer_id,v_appointment.vehicle_id,p_odometer_km,p_state_of_charge,p_keys_count,coalesce(p_accessories,'[]'::jsonb),coalesce(p_warning_lights,'[]'::jsonb),p_ownership_verified,p_diagnosis_authorized,p_road_test_authorized,trim(p_signer_name),encode(extensions.digest(concat_ws('|',v_appointment.id::text,p_odometer_km::text,p_state_of_charge::text,p_keys_count::text,coalesce(p_accessories,'[]'::jsonb)::text,coalesce(p_warning_lights,'[]'::jsonb)::text,p_ownership_verified::text,p_diagnosis_authorized::text,p_road_test_authorized::text,trim(p_signer_name),v_signed_at::text),'sha256'),'hex'),v_signed_at,auth.uid()) returning * into v_checkin;
  for v_item in select value from jsonb_array_elements(coalesce(p_condition_items,'[]'::jsonb)) loop
    if coalesce(v_item->>'zone','') not in ('front','rear','left','right','roof','interior','wheels','cargo','other') or coalesce(v_item->>'condition','') not in ('clear','noted','damaged') then raise exception 'Condition item is invalid' using errcode='22023'; end if;
    insert into public.checkin_condition_items(organization_id,branch_id,checkin_id,zone,condition,notes)
    values(v_appointment.organization_id,v_appointment.branch_id,v_checkin.id,v_item->>'zone',v_item->>'condition',nullif(trim(v_item->>'notes'),''));
  end loop;
  insert into public.odometer_readings(organization_id,branch_id,vehicle_id,reading_km,source,correction_reason,recorded_by)
  values(v_appointment.organization_id,v_appointment.branch_id,v_appointment.vehicle_id,p_odometer_km,'vehicle_checkin',nullif(trim(p_odometer_correction_reason),''),auth.uid());
  update public.vehicle_ownerships set verified_at=coalesce(verified_at,now()),verified_by=coalesce(verified_by,auth.uid()) where organization_id=v_appointment.organization_id and vehicle_id=v_appointment.vehicle_id and customer_id=v_appointment.customer_id and valid_from<=current_date and(valid_to is null or valid_to>=current_date);
  update public.appointments set status='checked_in',updated_at=now() where id=v_appointment.id;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_appointment.organization_id,auth.uid(),'appointment.vehicle_checked_in','vehicle_checkin',v_checkin.id,jsonb_build_object('appointment_id',v_appointment.id,'vehicle_id',v_appointment.vehicle_id,'signature_hash',v_checkin.signature_hash,'condition_count',jsonb_array_length(coalesce(p_condition_items,'[]'::jsonb))));
  return v_checkin;
end; $$;

revoke all on function public.complete_vehicle_checkin(uuid,bigint,integer,numeric,integer,jsonb,jsonb,boolean,boolean,boolean,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.complete_vehicle_checkin(uuid,bigint,integer,numeric,integer,jsonb,jsonb,boolean,boolean,boolean,text,jsonb,text) to authenticated;
