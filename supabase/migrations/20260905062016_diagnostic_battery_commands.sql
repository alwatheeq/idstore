-- Controlled VW ID diagnostic capture. Authenticated clients retain read-only
-- table access and mutate these records only through permission-checked commands.

create unique index diagnostic_sessions_one_active_per_order
  on public.diagnostic_sessions(repair_order_id)
  where ended_at is null;

create unique index diagnostic_trouble_codes_session_unit_code
  on public.diagnostic_trouble_codes(session_id, control_unit, code);

create or replace function public.start_diagnostic_session(
  p_repair_order_id uuid,
  p_tool text,
  p_tool_version text,
  p_interface_serial text,
  p_external_ref text,
  p_started_at timestamptz
)
returns public.diagnostic_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_technician public.technician_profiles%rowtype;
  v_session public.diagnostic_sessions%rowtype;
begin
  select * into v_order from public.repair_orders where id = p_repair_order_id for update;
  if not found then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'job.perform') then
    raise exception 'Not authorized to record diagnostics for this branch' using errcode = '42501';
  end if;
  if v_order.status in ('ready', 'delivered', 'closed', 'cancelled') then
    raise exception 'Diagnostics cannot be started for this repair-order state' using errcode = '22023';
  end if;
  select * into v_technician from public.technician_profiles
  where organization_id = v_order.organization_id and user_id = auth.uid() and active;
  if not found then
    raise exception 'An active technician profile is required to run diagnostics' using errcode = '23514';
  end if;
  if nullif(trim(p_tool), '') is null or p_started_at is null
     or p_started_at > clock_timestamp() + interval '5 minutes'
     or p_started_at < v_order.opened_at - interval '1 day' then
    raise exception 'Diagnostic tool and a valid start time are required' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.diagnostic_sessions s
    where s.repair_order_id = v_order.id and s.ended_at is null
  ) then
    raise exception 'This repair order already has an active diagnostic session' using errcode = '23514';
  end if;

  insert into public.diagnostic_sessions (
    organization_id, branch_id, repair_order_id, technician_id, tool,
    tool_version, interface_serial, external_ref, started_at
  ) values (
    v_order.organization_id, v_order.branch_id, v_order.id, v_technician.id, trim(p_tool),
    nullif(trim(p_tool_version), ''), nullif(trim(p_interface_serial), ''),
    nullif(trim(p_external_ref), ''), p_started_at
  ) returning * into v_session;

  if v_order.status = 'checked_in' then
    update public.repair_orders set status = 'diagnosis' where id = v_order.id;
  end if;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_order.organization_id, auth.uid(), 'diagnostic_session.started', 'diagnostic_session', v_session.id,
    jsonb_build_object('repair_order_id', v_order.id, 'tool', v_session.tool));
  return v_session;
end;
$$;

create or replace function public.record_diagnostic_trouble_code(
  p_session_id uuid,
  p_control_unit text,
  p_code text,
  p_description text,
  p_before_status text
)
returns public.diagnostic_trouble_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.diagnostic_sessions%rowtype;
  v_code public.diagnostic_trouble_codes%rowtype;
begin
  select * into v_session from public.diagnostic_sessions where id = p_session_id for update;
  if not found then raise exception 'Diagnostic session not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_session.organization_id, v_session.branch_id, 'job.perform') then
    raise exception 'Not authorized to record diagnostic codes' using errcode = '42501';
  end if;
  if v_session.ended_at is not null then
    raise exception 'Completed diagnostic sessions cannot be changed' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.technician_profiles t
    where t.id = v_session.technician_id and t.user_id = auth.uid() and t.active
  ) then
    raise exception 'Only the technician who started this session may record codes' using errcode = '42501';
  end if;
  if nullif(trim(p_control_unit), '') is null or nullif(trim(p_code), '') is null
     or p_before_status not in ('active', 'sporadic', 'stored', 'passive', 'unknown') then
    raise exception 'Control unit, DTC and a valid initial status are required' using errcode = '22023';
  end if;

  insert into public.diagnostic_trouble_codes (
    organization_id, branch_id, session_id, control_unit, code,
    description_snapshot, before_status
  ) values (
    v_session.organization_id, v_session.branch_id, v_session.id,
    upper(trim(p_control_unit)), upper(trim(p_code)), nullif(trim(p_description), ''), p_before_status
  ) returning * into v_code;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_session.organization_id, auth.uid(), 'diagnostic_code.recorded', 'diagnostic_trouble_code', v_code.id,
    jsonb_build_object('session_id', v_session.id, 'control_unit', v_code.control_unit, 'code', v_code.code));
  return v_code;
end;
$$;

create or replace function public.set_diagnostic_trouble_code_outcome(
  p_trouble_code_id uuid,
  p_after_status text
)
returns public.diagnostic_trouble_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.diagnostic_trouble_codes%rowtype;
  v_session public.diagnostic_sessions%rowtype;
begin
  select * into v_code from public.diagnostic_trouble_codes where id = p_trouble_code_id for update;
  if not found then raise exception 'Diagnostic trouble code not found' using errcode = 'P0002'; end if;
  select * into v_session from public.diagnostic_sessions where id = v_code.session_id for update;
  if not app_private.has_permission(v_session.organization_id, v_session.branch_id, 'job.perform') then
    raise exception 'Not authorized to update diagnostic codes' using errcode = '42501';
  end if;
  if v_session.ended_at is not null then
    raise exception 'Completed diagnostic sessions cannot be changed' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.technician_profiles t
    where t.id = v_session.technician_id and t.user_id = auth.uid() and t.active
  ) then
    raise exception 'Only the technician who started this session may update codes' using errcode = '42501';
  end if;
  if p_after_status not in ('active', 'sporadic', 'cleared', 'returned', 'not_tested') then
    raise exception 'Diagnostic outcome is invalid' using errcode = '22023';
  end if;

  update public.diagnostic_trouble_codes set after_status = p_after_status
  where id = v_code.id returning * into v_code;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_session.organization_id, auth.uid(), 'diagnostic_code.outcome_recorded', 'diagnostic_trouble_code', v_code.id,
    jsonb_build_object('session_id', v_session.id, 'after_status', p_after_status));
  return v_code;
end;
$$;

create or replace function public.complete_diagnostic_session(
  p_session_id uuid
)
returns public.diagnostic_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.diagnostic_sessions%rowtype;
begin
  select * into v_session from public.diagnostic_sessions where id = p_session_id for update;
  if not found then raise exception 'Diagnostic session not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_session.organization_id, v_session.branch_id, 'job.perform') then
    raise exception 'Not authorized to complete diagnostics' using errcode = '42501';
  end if;
  if v_session.ended_at is not null then
    raise exception 'Diagnostic session is already completed' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.technician_profiles t
    where t.id = v_session.technician_id and t.user_id = auth.uid() and t.active
  ) then
    raise exception 'Only the technician who started this session may complete it' using errcode = '42501';
  end if;

  update public.diagnostic_sessions
  set ended_at = greatest(clock_timestamp(), started_at + interval '1 millisecond')
  where id = v_session.id returning * into v_session;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_session.organization_id, auth.uid(), 'diagnostic_session.completed', 'diagnostic_session', v_session.id,
    jsonb_build_object('repair_order_id', v_session.repair_order_id,
      'code_count', (select count(*) from public.diagnostic_trouble_codes c where c.session_id = v_session.id)));
  return v_session;
end;
$$;

create or replace function public.record_battery_health_report(
  p_repair_order_id uuid,
  p_measured_at timestamptz,
  p_soh_percent numeric,
  p_usable_kwh numeric,
  p_method text,
  p_tool text,
  p_conditions_json jsonb
)
returns public.battery_health_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_report public.battery_health_reports%rowtype;
begin
  select * into v_order from public.repair_orders where id = p_repair_order_id for update;
  if not found then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'job.perform') then
    raise exception 'Not authorized to record battery health for this branch' using errcode = '42501';
  end if;
  if v_order.status in ('closed', 'cancelled') then
    raise exception 'Battery health cannot be recorded for this repair-order state' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.technician_profiles t
    where t.organization_id = v_order.organization_id and t.user_id = auth.uid() and t.active
  ) then
    raise exception 'An active technician profile is required to record battery health' using errcode = '23514';
  end if;
  select * into v_vehicle from public.vehicles
  where id = v_order.vehicle_id and organization_id = v_order.organization_id;
  if not found then raise exception 'Repair-order vehicle not found' using errcode = 'P0002'; end if;
  if p_measured_at is null or p_measured_at > clock_timestamp() + interval '5 minutes'
     or p_measured_at < v_order.opened_at - interval '1 day'
     or (p_soh_percent is null and p_usable_kwh is null)
     or p_soh_percent < 0 or p_soh_percent > 100
     or p_usable_kwh < 0
     or (v_vehicle.battery_kwh is not null and p_usable_kwh > v_vehicle.battery_kwh * 1.10)
     or nullif(trim(p_method), '') is null
     or jsonb_typeof(coalesce(p_conditions_json, '{}'::jsonb)) <> 'object' then
    raise exception 'Battery measurement values, method, time or conditions are invalid' using errcode = '22023';
  end if;

  insert into public.battery_health_reports (
    organization_id, branch_id, vehicle_id, repair_order_id, measured_at,
    soh_percent, usable_kwh, method, tool, conditions_json
  ) values (
    v_order.organization_id, v_order.branch_id, v_vehicle.id, v_order.id, p_measured_at,
    p_soh_percent, p_usable_kwh, trim(p_method), nullif(trim(p_tool), ''),
    coalesce(p_conditions_json, '{}'::jsonb)
  ) returning * into v_report;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_order.organization_id, auth.uid(), 'battery_health.recorded', 'battery_health_report', v_report.id,
    jsonb_build_object('repair_order_id', v_order.id, 'vehicle_id', v_vehicle.id,
      'soh_percent', v_report.soh_percent, 'usable_kwh', v_report.usable_kwh));
  return v_report;
end;
$$;

revoke all on function public.start_diagnostic_session(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_diagnostic_trouble_code(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_diagnostic_trouble_code_outcome(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_diagnostic_session(uuid) from public, anon, authenticated;
revoke all on function public.record_battery_health_report(uuid, timestamptz, numeric, numeric, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.start_diagnostic_session(uuid, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.record_diagnostic_trouble_code(uuid, text, text, text, text) to authenticated;
grant execute on function public.set_diagnostic_trouble_code_outcome(uuid, text) to authenticated;
grant execute on function public.complete_diagnostic_session(uuid) to authenticated;
grant execute on function public.record_battery_health_report(uuid, timestamptz, numeric, numeric, text, text, jsonb) to authenticated;

comment on function public.start_diagnostic_session(uuid, text, text, text, text, timestamptz)
  is 'Authenticated diagnostic command; branch permission and active technician ownership are checked in-function.';
comment on function public.record_diagnostic_trouble_code(uuid, text, text, text, text)
  is 'Authenticated DTC command; only the active session technician may append observations.';
comment on function public.record_battery_health_report(uuid, timestamptz, numeric, numeric, text, text, jsonb)
  is 'Authenticated battery-health command bound to the repair-order branch and vehicle.';
