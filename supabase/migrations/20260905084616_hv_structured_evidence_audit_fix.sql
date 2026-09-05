-- Correct structured HV evidence audit writes for the organization-scoped audit log.

create or replace function public.record_hv_permit_evidence(
  p_permit_id uuid,
  p_check_code text,
  p_result text,
  p_witness_id uuid,
  p_tool_ref text,
  p_measurement_value numeric,
  p_measurement_unit text,
  p_instrument_calibration_due date,
  p_lock_identifier text,
  p_disconnect_key_reference text,
  p_ppe_json jsonb,
  p_notes text
)
returns public.hv_permit_checks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check public.hv_permit_checks%rowtype;
  v_code text := lower(trim(p_check_code));
  v_result text := lower(trim(p_result));
  v_ppe jsonb := coalesce(p_ppe_json, '[]'::jsonb);
begin
  if jsonb_typeof(v_ppe) <> 'array' then
    raise exception 'PPE evidence must be an array' using errcode = '22023';
  end if;

  if v_result = 'pass' then
    if v_code = 'emergency_plan' and nullif(trim(p_notes), '') is null then
      raise exception 'Emergency-plan notes are required' using errcode = '22023';
    elsif v_code = 'vehicle_secured' and jsonb_array_length(v_ppe) = 0 then
      raise exception 'At least one PPE item is required' using errcode = '22023';
    elsif v_code = 'lockout_tagout' and (
      nullif(trim(p_lock_identifier), '') is null
      or nullif(trim(p_disconnect_key_reference), '') is null
    ) then
      raise exception 'Lock identifier and disconnect-key reference are required' using errcode = '22023';
    elsif v_code in ('absence_of_voltage', 'reenergization_test') and (
      p_measurement_value is null
      or p_measurement_value < 0
      or p_measurement_unit not in ('V', 'mV')
      or p_instrument_calibration_due is null
      or p_instrument_calibration_due < current_date
      or p_witness_id is null
      or nullif(trim(p_tool_ref), '') is null
    ) then
      raise exception 'Measurement, unit, current calibration, independent witness and tool reference are required'
        using errcode = '22023';
    end if;
  end if;

  select * into v_check
  from public.record_hv_permit_check(
    p_permit_id,
    v_code,
    v_result,
    p_witness_id,
    coalesce(p_tool_ref, '')
  );

  update public.hv_permit_checks
  set measurement_value = p_measurement_value,
      measurement_unit = nullif(trim(p_measurement_unit), ''),
      instrument_calibration_due = p_instrument_calibration_due,
      lock_identifier = nullif(trim(p_lock_identifier), ''),
      disconnect_key_reference = nullif(trim(p_disconnect_key_reference), ''),
      ppe_json = v_ppe,
      notes = nullif(trim(p_notes), '')
  where id = v_check.id
  returning * into v_check;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_check.organization_id,
    auth.uid(),
    'hv_permit.structured_evidence_recorded',
    'hv_work_permit',
    p_permit_id,
    jsonb_build_object(
      'check_code', v_code,
      'measurement_recorded', p_measurement_value is not null,
      'calibration_due', p_instrument_calibration_due,
      'lock_recorded', nullif(trim(p_lock_identifier), '') is not null,
      'ppe_count', jsonb_array_length(v_ppe)
    )
  );

  return v_check;
end;
$$;

revoke all on function public.record_hv_permit_evidence(uuid, text, text, uuid, text, numeric, text, date, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_hv_permit_evidence(uuid, text, text, uuid, text, numeric, text, date, text, text, jsonb, text)
  to authenticated;
