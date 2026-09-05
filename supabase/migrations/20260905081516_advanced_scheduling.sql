-- Branch calendars, transport choices, recurring bookings and auditable waitlists.

create table public.branch_operating_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, day_of_week),
  check (is_closed or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

create table public.branch_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  is_closed boolean not null default true,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now(),
  unique(branch_id, holiday_date),
  check (is_closed or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

create table public.appointment_waitlist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  preferred_from timestamptz not null,
  preferred_to timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 720),
  service_mode text not null default 'workshop' check (service_mode in ('workshop','mobile')),
  transport_mode text not null default 'customer_dropoff' check (transport_mode in ('customer_dropoff','wait_on_site','pickup_return','loan_vehicle')),
  priority smallint not null default 3 check (priority between 1 and 5),
  notes text,
  status text not null default 'waiting' check (status in ('waiting','offered','booked','cancelled','expired')),
  offered_at timestamptz,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preferred_to >= preferred_from)
);

alter table public.appointments
  add column if not exists service_mode text not null default 'workshop',
  add column if not exists transport_mode text not null default 'customer_dropoff',
  add column if not exists advisor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists recurrence_group_id uuid,
  add column if not exists recurrence_sequence integer,
  add column if not exists requested_services jsonb not null default '[]'::jsonb,
  add column if not exists status_reason text;

alter table public.appointments
  drop constraint if exists appointments_service_mode_check,
  add constraint appointments_service_mode_check check (service_mode in ('workshop','mobile')),
  drop constraint if exists appointments_transport_mode_check,
  add constraint appointments_transport_mode_check check (transport_mode in ('customer_dropoff','wait_on_site','pickup_return','loan_vehicle')),
  drop constraint if exists appointments_requested_services_check,
  add constraint appointments_requested_services_check check (jsonb_typeof(requested_services) = 'array'),
  drop constraint if exists appointments_recurrence_sequence_check,
  add constraint appointments_recurrence_sequence_check check (recurrence_sequence is null or recurrence_sequence > 0);

create index appointment_waitlist_queue on public.appointment_waitlist(branch_id, status, priority, preferred_from);
create index appointments_advisor_schedule on public.appointments(advisor_user_id, start_at) where advisor_user_id is not null and status in ('requested','confirmed','checked_in');
create index appointments_recurrence_group on public.appointments(recurrence_group_id, recurrence_sequence) where recurrence_group_id is not null;

create trigger assert_branch_organization before insert or update of organization_id, branch_id on public.branch_operating_hours for each row execute function app_private.assert_branch_organization();
create trigger assert_branch_organization before insert or update of organization_id, branch_id on public.branch_holidays for each row execute function app_private.assert_branch_organization();
create trigger assert_branch_organization before insert or update of organization_id, branch_id on public.appointment_waitlist for each row execute function app_private.assert_branch_organization();
create trigger touch_branch_operating_hours before update on public.branch_operating_hours for each row execute function app_private.touch_updated_at();
create trigger touch_appointment_waitlist before update on public.appointment_waitlist for each row execute function app_private.touch_updated_at();

alter table public.branch_operating_hours enable row level security;
alter table public.branch_holidays enable row level security;
alter table public.appointment_waitlist enable row level security;
create policy branch_operating_hours_select on public.branch_operating_hours for select to authenticated using (app_private.has_branch_access(organization_id,branch_id));
create policy branch_holidays_select on public.branch_holidays for select to authenticated using (app_private.has_branch_access(organization_id,branch_id));
create policy appointment_waitlist_select on public.appointment_waitlist for select to authenticated using (app_private.has_branch_access(organization_id,branch_id));
grant select on public.branch_operating_hours, public.branch_holidays, public.appointment_waitlist to authenticated;

create or replace function public.upsert_branch_operating_hour(p_branch_id uuid,p_day_of_week integer,p_opens_at time,p_closes_at time,p_is_closed boolean)
returns public.branch_operating_hours language plpgsql security definer set search_path='' as $$
declare v_branch public.branches%rowtype; v_hour public.branch_operating_hours%rowtype;
begin
  select * into strict v_branch from public.branches where id=p_branch_id;
  if not app_private.has_permission(v_branch.organization_id,v_branch.id,'branch.manage') then raise exception 'Not authorized to manage branch calendars' using errcode='42501'; end if;
  if p_day_of_week not between 0 and 6 or (not p_is_closed and (p_opens_at is null or p_closes_at is null or p_closes_at<=p_opens_at)) then raise exception 'Operating hours are invalid' using errcode='22023'; end if;
  insert into public.branch_operating_hours(organization_id,branch_id,day_of_week,opens_at,closes_at,is_closed)
  values(v_branch.organization_id,v_branch.id,p_day_of_week,case when p_is_closed then null else p_opens_at end,case when p_is_closed then null else p_closes_at end,p_is_closed)
  on conflict(branch_id,day_of_week) do update set opens_at=excluded.opens_at,closes_at=excluded.closes_at,is_closed=excluded.is_closed,updated_at=now()
  returning * into v_hour;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_branch.organization_id,auth.uid(),'branch.hours_updated','branch',v_branch.id,jsonb_build_object('day_of_week',p_day_of_week,'closed',p_is_closed));
  return v_hour;
end; $$;

create or replace function public.upsert_branch_holiday(p_branch_id uuid,p_holiday_date date,p_name text,p_is_closed boolean,p_opens_at time,p_closes_at time)
returns public.branch_holidays language plpgsql security definer set search_path='' as $$
declare v_branch public.branches%rowtype; v_holiday public.branch_holidays%rowtype;
begin
  select * into strict v_branch from public.branches where id=p_branch_id;
  if not app_private.has_permission(v_branch.organization_id,v_branch.id,'branch.manage') then raise exception 'Not authorized to manage branch calendars' using errcode='42501'; end if;
  if p_holiday_date is null or nullif(trim(p_name),'') is null or (not p_is_closed and (p_opens_at is null or p_closes_at is null or p_closes_at<=p_opens_at)) then raise exception 'Holiday details are invalid' using errcode='22023'; end if;
  insert into public.branch_holidays(organization_id,branch_id,holiday_date,name,is_closed,opens_at,closes_at)
  values(v_branch.organization_id,v_branch.id,p_holiday_date,trim(p_name),p_is_closed,case when p_is_closed then null else p_opens_at end,case when p_is_closed then null else p_closes_at end)
  on conflict(branch_id,holiday_date) do update set name=excluded.name,is_closed=excluded.is_closed,opens_at=excluded.opens_at,closes_at=excluded.closes_at
  returning * into v_holiday;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_branch.organization_id,auth.uid(),'branch.holiday_updated','branch',v_branch.id,jsonb_build_object('date',p_holiday_date,'name',trim(p_name),'closed',p_is_closed));
  return v_holiday;
end; $$;

create or replace function public.create_advanced_appointments(
  p_organization_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,
  p_start_at timestamptz,p_end_at timestamptz,p_promised_at timestamptz,p_notes text,
  p_service_mode text,p_transport_mode text,p_advisor_user_id uuid,p_resource_id uuid,
  p_requested_services jsonb,p_recurrence_count integer
) returns uuid[] language plpgsql security definer set search_path='' as $$
declare v_branch public.branches%rowtype; v_ids uuid[]:='{}'; v_id uuid; v_group uuid; v_index integer; v_start timestamptz; v_end timestamptz; v_promise timestamptz; v_local_start timestamp; v_local_end timestamp; v_day integer; v_hour public.branch_operating_hours%rowtype; v_holiday public.branch_holidays%rowtype;
begin
  select * into strict v_branch from public.branches where id=p_branch_id and organization_id=p_organization_id and status='active';
  if not app_private.has_permission(p_organization_id,p_branch_id,'appointments.manage') then raise exception 'Not authorized to manage appointments for this branch' using errcode='42501'; end if;
  if p_start_at is null or p_end_at is null or p_end_at<=p_start_at or p_end_at-p_start_at>interval '12 hours' or p_recurrence_count not between 1 and 12 then raise exception 'Appointment dates or recurrence count are invalid' using errcode='22023'; end if;
  if p_service_mode not in ('workshop','mobile') or p_transport_mode not in ('customer_dropoff','wait_on_site','pickup_return','loan_vehicle') or jsonb_typeof(coalesce(p_requested_services,'[]'::jsonb))<>'array' then raise exception 'Appointment service choices are invalid' using errcode='22023'; end if;
  if not exists(select 1 from public.vehicle_ownerships o join public.customers c on c.id=o.customer_id join public.vehicles v on v.id=o.vehicle_id where o.customer_id=p_customer_id and o.vehicle_id=p_vehicle_id and o.organization_id=p_organization_id and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>=current_date) and c.status='active' and v.status='active') then raise exception 'The customer does not have an active relationship with this vehicle' using errcode='23514'; end if;
  if p_advisor_user_id is not null and not exists(select 1 from public.memberships m where m.user_id=p_advisor_user_id and m.organization_id=p_organization_id and m.status='active') then raise exception 'Advisor is not active in this organization' using errcode='23514'; end if;
  if p_resource_id is not null and not exists(select 1 from public.resources r where r.id=p_resource_id and r.organization_id=p_organization_id and r.branch_id=p_branch_id and r.status='active') then raise exception 'Resource is not available in this branch' using errcode='23514'; end if;

  v_group:=case when p_recurrence_count>1 then gen_random_uuid() end;
  for v_index in 1..p_recurrence_count loop
    v_start:=p_start_at+(v_index-1)*interval '7 days'; v_end:=p_end_at+(v_index-1)*interval '7 days'; v_promise:=case when p_promised_at is null then null else p_promised_at+(v_index-1)*interval '7 days' end;
    v_local_start:=v_start at time zone v_branch.timezone; v_local_end:=v_end at time zone v_branch.timezone; v_day:=extract(dow from v_local_start)::integer;
    select * into v_holiday from public.branch_holidays h where h.branch_id=p_branch_id and h.holiday_date=v_local_start::date;
    if found and (v_holiday.is_closed or v_local_start::time<v_holiday.opens_at or v_local_end::time>v_holiday.closes_at) then raise exception 'Appointment falls outside holiday opening hours' using errcode='22023'; end if;
    if not found then
      select * into v_hour from public.branch_operating_hours h where h.branch_id=p_branch_id and h.day_of_week=v_day;
      if found and (v_hour.is_closed or v_local_start::time<v_hour.opens_at or v_local_end::time>v_hour.closes_at) then raise exception 'Appointment falls outside branch operating hours' using errcode='22023'; end if;
    end if;
    if exists(select 1 from public.appointments a where a.organization_id=p_organization_id and a.vehicle_id=p_vehicle_id and a.status in('requested','confirmed','checked_in') and tstzrange(a.start_at,a.end_at,'[)')&&tstzrange(v_start,v_end,'[)')) then raise exception 'This vehicle already has an overlapping appointment' using errcode='23P01'; end if;
    if p_advisor_user_id is not null and exists(select 1 from public.appointments a where a.advisor_user_id=p_advisor_user_id and a.status in('requested','confirmed','checked_in') and tstzrange(a.start_at,a.end_at,'[)')&&tstzrange(v_start,v_end,'[)')) then raise exception 'Advisor is already booked in this time window' using errcode='23P01'; end if;
    if p_resource_id is not null and exists(select 1 from public.resource_bookings b where b.resource_id=p_resource_id and b.status='active' and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(v_start,v_end,'[)')) then raise exception 'Resource is already booked in this time window' using errcode='23P01'; end if;
    insert into public.appointments(organization_id,branch_id,customer_id,vehicle_id,start_at,end_at,promised_at,channel,status,notes,created_by,service_mode,transport_mode,advisor_user_id,recurrence_group_id,recurrence_sequence,requested_services)
    values(p_organization_id,p_branch_id,p_customer_id,p_vehicle_id,v_start,v_end,v_promise,'staff','requested',nullif(trim(p_notes),''),auth.uid(),p_service_mode,p_transport_mode,p_advisor_user_id,v_group,case when v_group is null then null else v_index end,coalesce(p_requested_services,'[]'::jsonb)) returning id into v_id;
    if p_resource_id is not null then insert into public.resource_bookings(organization_id,branch_id,resource_id,appointment_id,starts_at,ends_at) values(p_organization_id,p_branch_id,p_resource_id,v_id,v_start,v_end); end if;
    v_ids:=array_append(v_ids,v_id);
  end loop;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(p_organization_id,auth.uid(),'appointment.series_created','appointment',v_ids[1],jsonb_build_object('branch_id',p_branch_id,'count',p_recurrence_count,'recurrence_group_id',v_group,'resource_id',p_resource_id));
  return v_ids;
end; $$;

create or replace function public.create_waitlist_entry(p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_preferred_from timestamptz,p_preferred_to timestamptz,p_duration_minutes integer,p_service_mode text,p_transport_mode text,p_priority integer,p_notes text)
returns public.appointment_waitlist language plpgsql security definer set search_path='' as $$
declare v_branch public.branches%rowtype; v_entry public.appointment_waitlist%rowtype;
begin
  select * into strict v_branch from public.branches where id=p_branch_id and status='active';
  if not app_private.has_permission(v_branch.organization_id,v_branch.id,'appointments.manage') then raise exception 'Not authorized to manage this waitlist' using errcode='42501'; end if;
  if p_preferred_from is null or p_preferred_to<p_preferred_from or p_duration_minutes not between 15 and 720 or p_priority not between 1 and 5 or p_service_mode not in('workshop','mobile') or p_transport_mode not in('customer_dropoff','wait_on_site','pickup_return','loan_vehicle') then raise exception 'Waitlist details are invalid' using errcode='22023'; end if;
  if not exists(select 1 from public.vehicle_ownerships o where o.organization_id=v_branch.organization_id and o.customer_id=p_customer_id and o.vehicle_id=p_vehicle_id and o.valid_from<=current_date and(o.valid_to is null or o.valid_to>=current_date)) then raise exception 'Customer and vehicle relationship is invalid' using errcode='23514'; end if;
  insert into public.appointment_waitlist(organization_id,branch_id,customer_id,vehicle_id,preferred_from,preferred_to,duration_minutes,service_mode,transport_mode,priority,notes,created_by)
  values(v_branch.organization_id,v_branch.id,p_customer_id,p_vehicle_id,p_preferred_from,p_preferred_to,p_duration_minutes,p_service_mode,p_transport_mode,p_priority,nullif(trim(p_notes),''),auth.uid()) returning * into v_entry;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_branch.organization_id,auth.uid(),'appointment.waitlisted','appointment_waitlist',v_entry.id,jsonb_build_object('branch_id',p_branch_id,'priority',p_priority));
  return v_entry;
end; $$;

create or replace function public.transition_waitlist_entry(p_waitlist_id uuid,p_to_status text,p_appointment_id uuid,p_reason text)
returns public.appointment_waitlist language plpgsql security definer set search_path='' as $$
declare v_entry public.appointment_waitlist%rowtype;
begin
  select * into strict v_entry from public.appointment_waitlist where id=p_waitlist_id for update;
  if not app_private.has_permission(v_entry.organization_id,v_entry.branch_id,'appointments.manage') then raise exception 'Not authorized to manage this waitlist' using errcode='42501'; end if;
  if p_to_status not in('offered','booked','cancelled','expired') or nullif(trim(p_reason),'') is null or (p_to_status='booked' and p_appointment_id is null) then raise exception 'Waitlist transition is invalid' using errcode='22023'; end if;
  if p_appointment_id is not null and not exists(select 1 from public.appointments a where a.id=p_appointment_id and a.organization_id=v_entry.organization_id and a.branch_id=v_entry.branch_id and a.customer_id=v_entry.customer_id and a.vehicle_id=v_entry.vehicle_id) then raise exception 'Booked appointment does not match the waitlist entry' using errcode='23514'; end if;
  update public.appointment_waitlist set status=p_to_status,offered_at=case when p_to_status='offered' then now() else offered_at end,appointment_id=case when p_to_status='booked' then p_appointment_id else appointment_id end,updated_at=now() where id=v_entry.id returning * into v_entry;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_entry.organization_id,auth.uid(),'appointment.waitlist_status_changed','appointment_waitlist',v_entry.id,jsonb_build_object('to',p_to_status,'reason',trim(p_reason),'appointment_id',p_appointment_id));
  return v_entry;
end; $$;

revoke all on function public.upsert_branch_operating_hour(uuid,integer,time,time,boolean) from public,anon,authenticated;
revoke all on function public.upsert_branch_holiday(uuid,date,text,boolean,time,time) from public,anon,authenticated;
revoke all on function public.create_advanced_appointments(uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz,text,text,text,uuid,uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.create_waitlist_entry(uuid,uuid,uuid,timestamptz,timestamptz,integer,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.transition_waitlist_entry(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.upsert_branch_operating_hour(uuid,integer,time,time,boolean) to authenticated;
grant execute on function public.upsert_branch_holiday(uuid,date,text,boolean,time,time) to authenticated;
grant execute on function public.create_advanced_appointments(uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz,text,text,text,uuid,uuid,jsonb,integer) to authenticated;
grant execute on function public.create_waitlist_entry(uuid,uuid,uuid,timestamptz,timestamptz,integer,text,text,integer,text) to authenticated;
grant execute on function public.transition_waitlist_entry(uuid,text,uuid,text) to authenticated;
