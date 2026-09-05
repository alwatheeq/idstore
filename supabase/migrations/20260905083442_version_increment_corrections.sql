-- Correct optimistic version increments to rely on the shared before-update trigger.

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

create or replace function public.record_job_narrative(p_job_id uuid,p_cause_text text,p_correction_text text)
returns public.jobs language plpgsql security definer set search_path='' as $$ declare v_job public.jobs%rowtype; begin
 select * into strict v_job from public.jobs where id=p_job_id for update; if not app_private.has_permission(v_job.organization_id,v_job.branch_id,'job.perform') then raise exception 'Not authorized to update this job' using errcode='42501'; end if;
 if nullif(trim(p_cause_text),'') is null or nullif(trim(p_correction_text),'') is null then raise exception 'Cause and correction are required' using errcode='22023'; end if;
 update public.jobs set cause_text=trim(p_cause_text),correction_text=trim(p_correction_text),updated_at=now() where id=v_job.id returning * into v_job;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_job.organization_id,auth.uid(),'job.narrative_recorded','job',v_job.id,jsonb_build_object('repair_order_id',v_job.repair_order_id)); return v_job; end; $$;

create or replace function public.interrupt_job(p_job_id uuid,p_expected_version bigint,p_interruption_type text,p_reason text)
returns public.jobs language plpgsql security definer set search_path='' as $$ declare v_job public.jobs%rowtype; begin
 select * into strict v_job from public.jobs where id=p_job_id for update; if not app_private.has_permission(v_job.organization_id,v_job.branch_id,'job.perform') then raise exception 'Not authorized to interrupt this job' using errcode='42501'; end if;
 if v_job.version<>p_expected_version or v_job.status<>'in_progress' or p_interruption_type not in('pause','blocked') or nullif(trim(p_reason),'') is null then raise exception 'Job interruption is invalid' using errcode='40001'; end if;
 update public.labor_entries set ended_at=now(),pause_reason=trim(p_reason) where job_id=v_job.id and ended_at is null;
 insert into public.job_interruptions(organization_id,branch_id,job_id,interruption_type,reason,started_by) values(v_job.organization_id,v_job.branch_id,v_job.id,p_interruption_type,trim(p_reason),auth.uid());
 update public.jobs set status=case when p_interruption_type='pause' then 'paused' else 'blocked' end,updated_at=now() where id=v_job.id returning * into v_job; return v_job; end; $$;

create or replace function public.resume_job(p_job_id uuid,p_expected_version bigint)
returns public.jobs language plpgsql security definer set search_path='' as $$ declare v_job public.jobs%rowtype; begin
 select * into strict v_job from public.jobs where id=p_job_id for update; if not app_private.has_permission(v_job.organization_id,v_job.branch_id,'job.perform') then raise exception 'Not authorized to resume this job' using errcode='42501'; end if;
 if v_job.version<>p_expected_version or v_job.status not in('paused','blocked') then raise exception 'Job is not available to resume' using errcode='40001'; end if;
 update public.job_interruptions set ended_at=now(),ended_by=auth.uid() where job_id=v_job.id and ended_at is null;
 update public.jobs set status='ready',updated_at=now() where id=v_job.id returning * into v_job; return v_job; end; $$;
