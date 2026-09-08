-- Recovery definitions captured before the permission migration.
-- Apply only to roll back the admin-on-behalf change; no data is deleted.
CREATE OR REPLACE FUNCTION public.inspection_workspace(p_organization_id uuid, p_inspection_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_i public.inspections%rowtype; v_data jsonb;
begin
 if auth.uid() is null or not app_private.is_member(p_organization_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_inspection_id is not null then
  select * into v_i from public.inspections where id=p_inspection_id and organization_id=p_organization_id;
  if not found or not app_private.has_branch_access(p_organization_id,v_i.branch_id) then raise exception 'Inspection unavailable' using errcode='42501'; end if;
 end if;
 select jsonb_build_object(
  'inspection',case when v_i.id is not null then to_jsonb(v_i) else null end,
  'vehicle',(select to_jsonb(v)||jsonb_build_object('model',to_jsonb(m),'complaint',r.customer_concern,'odometer_km',r.odometer_km) from public.repair_orders r join public.vehicles v on v.id=r.vehicle_id left join public.vehicle_models m on m.id=v.model_id where r.id=v_i.repair_order_id),
  'technicians',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',p.display_name,'user_id',t.user_id)) from public.technician_profiles t join public.profiles p on p.user_id=t.user_id join public.memberships m on m.user_id=t.user_id and m.organization_id=t.organization_id where t.organization_id=p_organization_id and t.active and p.status='active' and m.status='active' and (v_i.id is null or m.role='admin' or exists(select 1 from public.membership_branches mb where mb.membership_id=m.id and mb.branch_id=v_i.branch_id)) and (m.role='admin' or exists(select 1 from public.membership_permissions mp where mp.membership_id=m.id and mp.permission_code='inspection.perform' and mp.allowed))),'[]'),
  'catalog',case when v_i.id is null then coalesce((select jsonb_agg(to_jsonb(d) order by d.sort_order) from public.inspection_check_definitions d where d.active and app_private.is_maintenance_check(d.rules) and (d.organization_id is null or d.organization_id=p_organization_id)),'[]') else coalesce((select jsonb_agg(c) from app_private.inspection_candidates(v_i.id) c),'[]') end,
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('attempts',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('actor_name',p.display_name) order by a.attempt) from public.inspection_check_results a left join public.profiles p on p.user_id=a.recorded_by where a.task_id=t.id),'[]')) order by t.sequence) from public.inspection_checklist_tasks t where t.inspection_id=v_i.id),'[]'),
  'can_record',exists(select 1 from public.technician_profiles t where t.id=v_i.technician_id and t.user_id=auth.uid() and t.active) and app_private.has_permission(p_organization_id,v_i.branch_id,'inspection.perform'),
  'can_manage',app_private.has_permission(p_organization_id,v_i.branch_id,'inspection.perform'),
  'can_review',app_private.is_admin(p_organization_id)
 ) into v_data;
 return v_data;
end;
$function$;

CREATE OR REPLACE FUNCTION public.inspection_workflow(p_inspection_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_i public.inspections%rowtype; v_t public.inspection_checklist_tasks%rowtype;
 v_tp public.technician_profiles%rowtype; v_m public.memberships%rowtype;
 v_candidate jsonb; v_id uuid; v_ids uuid[]; v_count integer:=0; v_seq integer;
 v_result text; v_attempt integer; v_item public.inspection_items%rowtype; v_reason text;
 v_prev public.inspection_check_results%rowtype; v_finding uuid; v_vehicle uuid; v_status text;
begin
 select * into v_i from public.inspections where id=p_inspection_id for update;
 if not found then raise exception 'Inspection unavailable'; end if;
 if auth.uid() is null or not app_private.has_permission(v_i.organization_id,v_i.branch_id,'inspection.perform') then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_action not in ('assign','generate','record','exception','review') then raise exception 'Invalid inspection action'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>64000 then raise exception 'Invalid inspection data'; end if;
 if v_i.status <> 'in_progress' and not (v_i.status='completed' and p_action in ('record','exception','review')) then raise exception 'Inspection is locked'; end if;
 if p_action='assign' then
  if v_i.checklist_generated_at is not null then raise exception 'Assignment is locked after checklist generation'; end if;
  select * into v_tp from public.technician_profiles where id=(p_data->>'technician_id')::uuid and organization_id=v_i.organization_id and active;
  if not found then raise exception 'Select an active technician'; end if;
  select * into v_m from public.memberships where user_id=v_tp.user_id and organization_id=v_i.organization_id and status='active';
  if not found or not (v_m.role='admin' or exists(select 1 from public.membership_branches mb where mb.membership_id=v_m.id and mb.branch_id=v_i.branch_id))
    or not (v_m.role='admin' or exists(select 1 from public.membership_permissions mp where mp.membership_id=v_m.id and mp.permission_code='inspection.perform' and mp.allowed)) then raise exception 'Technician requires inspection permission and branch access'; end if;
  if nullif(trim(p_data->>'complaint'),'') is null or length(p_data->>'complaint')>4000 or coalesce((p_data->>'odometer_km')::int,-1)<0 then raise exception 'Mileage and customer complaint are required'; end if;
  if jsonb_typeof(p_data->'groups') is distinct from 'array' or jsonb_typeof(p_data->'capabilities') is distinct from 'array' then raise exception 'Invalid assignment categories'; end if;
  if nullif(p_data->>'last_service_km','') is not null and ((p_data->>'last_service_km')::int<0 or (p_data->>'last_service_km')::int>(p_data->>'odometer_km')::int) then raise exception 'Previous service mileage cannot exceed current mileage'; end if;
  if nullif(p_data->>'last_service_date','') is not null and (p_data->>'last_service_date')::date>current_date then raise exception 'Previous service date cannot be in the future'; end if;
  if not exists(select 1 from public.repair_orders r join public.vehicles v on v.id=r.vehicle_id where r.id=v_i.repair_order_id and v.model_id is not null and v.model_year is not null) then raise exception 'Set the vehicle model and year in the vehicle record first'; end if;
  update public.inspections set technician_id=v_tp.id,assignment=(p_data-'technician_id')||jsonb_build_object('assigned_by',auth.uid(),'assigned_at',now(),'vehicle',(select to_jsonb(v) from public.vehicles v join public.repair_orders r on r.vehicle_id=v.id where r.id=v_i.repair_order_id)) where id=v_i.id;
 elsif p_action='generate' then
  if v_i.technician_id is null or v_i.assignment='{}' then raise exception 'Assign the technician and vehicle context first'; end if;
  if jsonb_typeof(p_data->'ids') is distinct from 'array' or jsonb_array_length(p_data->'ids') not between 1 and 200 then raise exception 'Select between 1 and 200 checks'; end if;
  select array_agg(distinct x::uuid) into v_ids from jsonb_array_elements_text(p_data->'ids') x;
  select coalesce(max(sequence),0) into v_seq from public.inspection_checklist_tasks where inspection_id=v_i.id;
  foreach v_id in array v_ids loop
   select c into v_candidate from app_private.inspection_candidates(v_i.id) c where c->>'id'=v_id::text;
   if not found or not (v_candidate->>'eligible')::boolean then raise exception 'Check is not applicable or requires a qualified technician and procedure'; end if;
   if not exists(select 1 from public.inspection_checklist_tasks where inspection_id=v_i.id and definition_id=v_id) then
    v_seq:=v_seq+1;
    insert into public.inspection_checklist_tasks(organization_id,branch_id,inspection_id,definition_id,snapshot,sequence) values(v_i.organization_id,v_i.branch_id,v_i.id,v_id,v_candidate,v_seq);
    v_count:=v_count+1;
   end if;
  end loop;
  if v_count=0 then raise exception 'Selected checks already exist'; end if;
  update public.inspections set checklist_generated_at=coalesce(checklist_generated_at,now()) where id=v_i.id;
 elsif p_action in ('record','exception') then
  select * into v_t from public.inspection_checklist_tasks where id=(p_data->>'task_id')::uuid and inspection_id=v_i.id;
  if not found then raise exception 'Check task unavailable'; end if;
  select * into v_prev from public.inspection_check_results where task_id=v_t.id order by attempt desc limit 1;
  v_attempt:=coalesce(v_prev.attempt,0)+1;
  if coalesce((p_data->>'expected_attempt')::int,-1)<>v_attempt-1 then raise exception 'A newer result exists; reload before saving'; end if;
  if p_action='exception' then
   if not app_private.is_admin(v_i.organization_id) then raise exception 'Only an administrator can approve an exception' using errcode='42501'; end if;
   if v_prev.result is not null and v_prev.result<>'inconclusive' then raise exception 'Only outstanding or inconclusive checks can receive an exception'; end if;
   if nullif(trim(p_data->>'reason'),'') is null then raise exception 'Document the supervisor exception reason'; end if;
   v_result:='exception';
  else
   select * into v_tp from public.technician_profiles where id=v_i.technician_id and active and user_id=auth.uid();
   if not found then raise exception 'Only the assigned technician can record results' using errcode='42501'; end if;
   if nullif(v_t.snapshot->'rules'->>'qualification','') is not null and
    (nullif(v_t.snapshot->'rules'->>'procedure_ref','') is null or not app_private.technician_has_qualification(v_i.organization_id,auth.uid(),v_t.snapshot->'rules'->>'qualification')) then raise exception 'A current verified qualification and vehicle procedure are required'; end if;
   v_result:=p_data->>'result';
   if v_result is null or v_result not in ('pass','fail','inconclusive','not_applicable') then raise exception 'Choose a result for this check'; end if;
   if v_result in ('inconclusive','not_applicable') and nullif(trim(p_data->>'reason'),'') is null then raise exception 'A reason is required for inconclusive or not applicable results'; end if;
   if v_result='fail' and (nullif(trim(p_data->>'finding'),'') is null or coalesce(p_data->>'recommendation','') not in ('monitor','service','repair','replace','diagnose') or coalesce(p_data->>'urgency','') not in ('immediate','soon','routine')) then raise exception 'Failures require a finding, recommendation and urgency'; end if;
   if v_attempt>1 and nullif(trim(p_data->>'retest_note'),'') is null then raise exception 'Record the repair or reason for the retest'; end if;
   if v_result in ('pass','fail') and nullif(trim(p_data->>'criteria'),'') is null then raise exception 'Record the applicable acceptance criteria'; end if;
   if v_result in ('pass','fail') and coalesce((v_t.snapshot->'rules'->>'evidence_required')::boolean,false) and (nullif(trim(p_data->>'measurement'),'') is null or nullif(trim(p_data->>'unit'),'') is null) then raise exception 'Measurement and unit are required for this check'; end if;
   -- Existing findings and estimates continue to use inspection_items. Each retest
   -- gets a fresh item, so the original failure and recommendation remain intact.
   if v_i.status='completed' and v_attempt=1 then raise exception 'Only a retest can be appended to a completed inspection'; end if;
   insert into public.inspection_items(organization_id,branch_id,inspection_id,check_definition_id,sequence,result,measurement_json,finding_text,customer_text)
   select v_i.organization_id,v_i.branch_id,v_i.id,v_t.definition_id,coalesce(max(sequence),0)+1,
    case when v_result='inconclusive' then 'not_applicable' else v_result end,
    jsonb_build_object('check',v_t.snapshot->>'label_en','check_ar',v_t.snapshot->>'label_ar','measurement',concat_ws(' ',nullif(p_data->>'measurement',''),nullif(p_data->>'unit',''))),
    nullif(p_data->>'finding',''),nullif(p_data->>'recommendation','')
   from public.inspection_items where inspection_id=v_i.id returning * into v_item;
   if v_result='fail' then
    insert into public.findings(organization_id,branch_id,inspection_item_id,severity,status)
    values(v_i.organization_id,v_i.branch_id,v_item.id,case p_data->>'urgency' when 'immediate' then 'safety_stop' when 'soon' then 'red' else 'amber' end,'open') returning id into v_finding;
    update public.repair_orders set risk_state=case when p_data->>'urgency'='immediate' then 'quarantine' when p_data->>'urgency'='soon' and risk_state='normal' then 'restricted' else risk_state end where id=v_i.repair_order_id;
    select vehicle_id into v_vehicle from public.repair_orders where id=v_i.repair_order_id;
    insert into public.vehicle_recommendations(organization_id,branch_id,vehicle_id,finding_id,description,severity)
     values(v_i.organization_id,v_i.branch_id,v_vehicle,v_finding,concat_ws(' · ',v_t.snapshot->>'label_en',p_data->>'finding',p_data->>'recommendation'),case p_data->>'urgency' when 'immediate' then 'safety_stop' when 'soon' then 'red' else 'amber' end);
   end if;
  end if;
  insert into public.inspection_check_results(organization_id,branch_id,task_id,attempt,result,details,technician_id,recorded_by,inspection_item_id)
   values(v_i.organization_id,v_i.branch_id,v_t.id,v_attempt,v_result,p_data-'task_id'-'expected_attempt',case when p_action='record' then v_i.technician_id else null end,auth.uid(),v_item.id);
   -- Retesting a reviewed inspection reopens review, while audit and attempts retain the original evidence.
  if v_i.status='completed' then
   update public.inspections set status='in_progress',completed_at=null,reviewed_by=null,review_note=null where id=v_i.id;
  end if;
 elsif p_action='review' then
  if not app_private.is_admin(v_i.organization_id) then raise exception 'Only an administrator can review and complete the inspection' using errcode='42501'; end if;
  if v_i.checklist_generated_at is null then raise exception 'Generate a checklist first'; end if;
  if exists(select 1 from public.inspection_checklist_tasks t left join lateral(select a.result from public.inspection_check_results a where a.task_id=t.id order by a.attempt desc limit 1) a on true where t.inspection_id=v_i.id and (a.result is null or a.result='inconclusive')) then raise exception 'Outstanding checks need a result or documented supervisor exception'; end if;
  if nullif(trim(p_data->>'review_note'),'') is null then raise exception 'Record the review summary'; end if;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(v_i.organization_id,auth.uid(),'inspection.review_evidence','inspection',v_i.id,jsonb_build_object('summary',p_data->>'review_note','reviewed_at',now(),'results',(select jsonb_agg(to_jsonb(a)) from public.inspection_checklist_tasks t join lateral(select id,result,attempt from public.inspection_check_results where task_id=t.id order by attempt desc limit 1) a on true where t.inspection_id=v_i.id)));
  update public.inspections set status='completed',completed_at=now(),reviewed_by=auth.uid(),review_note=p_data->>'review_note' where id=v_i.id;
  select status into v_status from public.repair_orders where id=v_i.repair_order_id for update;
  if v_status='checked_in' then
   update public.repair_orders set status='diagnosis' where id=v_i.repair_order_id;
   insert into public.repair_order_events(organization_id,branch_id,repair_order_id,from_status,to_status,reason,actor_id) values(v_i.organization_id,v_i.branch_id,v_i.repair_order_id,v_status,'diagnosis','Inspection reviewed',auth.uid());
  end if;
 end if;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_i.organization_id,auth.uid(),'inspection.'||p_action,'inspection',v_i.id,jsonb_build_object('task_id',v_t.id,'attempt',v_attempt,'count',v_count));
 return jsonb_build_object('id',v_i.id,'action',p_action);
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_job(p_job_id uuid, p_expected_version bigint)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.jobs%rowtype;
  v_technician public.technician_profiles%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_job.organization_id, v_job.branch_id, 'job.perform') then
    raise exception 'Not authorized to perform this job' using errcode = '42501';
  end if;
  if v_job.version <> p_expected_version then
    raise exception 'Job changed; refresh before starting' using errcode = '40001';
  end if;
  if v_job.status not in ('assigned', 'paused') then
    raise exception 'Only assigned or paused jobs can be started' using errcode = '22023';
  end if;

  select * into v_technician from public.technician_profiles
  where organization_id = v_job.organization_id and user_id = auth.uid() and active;
  if not found or not exists (
    select 1 from public.job_assignments a
    where a.job_id = v_job.id and a.technician_id = v_technician.id and a.unassigned_at is null
  ) then
    raise exception 'This job is not assigned to the current technician' using errcode = '42501';
  end if;
  if v_job.required_qualification_code is not null and not app_private.technician_has_qualification(
    v_job.organization_id, auth.uid(), v_job.required_qualification_code
  ) then
    raise exception 'Required technician qualification is not current' using errcode = '23514';
  end if;
  if v_job.safety_class in ('hv_isolated', 'hv_battery_open') and not exists (
    select 1 from public.hv_work_permits p
    where p.job_id = v_job.id and p.state = 'work_active'
      and p.valid_from <= clock_timestamp() and p.valid_to > clock_timestamp()
  ) then
    raise exception 'A valid work-active high-voltage permit is required' using errcode = '23514';
  end if;
  if exists (select 1 from public.labor_entries l where l.technician_id = v_technician.id and l.ended_at is null) then
    raise exception 'Technician already has an active timer' using errcode = '23514';
  end if;

  insert into public.labor_entries (organization_id, branch_id, job_id, technician_id, started_at, source)
  values (v_job.organization_id, v_job.branch_id, v_job.id, v_technician.id, clock_timestamp(), 'timer');
  update public.jobs set status = 'in_progress', started_at = coalesce(started_at, clock_timestamp())
  where id = v_job.id returning * into v_job;
  return v_job;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_job(p_job_id uuid, p_expected_version bigint, p_outcome text, p_note text)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.jobs%rowtype;
  v_technician public.technician_profiles%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_job.organization_id, v_job.branch_id, 'job.perform') then
    raise exception 'Not authorized to perform this job' using errcode = '42501';
  end if;
  if v_job.version <> p_expected_version then raise exception 'Job changed; refresh before stopping' using errcode = '40001'; end if;
  if v_job.status <> 'in_progress' or p_outcome not in ('paused', 'blocked', 'qc', 'completed') then
    raise exception 'Job state or outcome is invalid' using errcode = '22023';
  end if;

  select * into v_technician from public.technician_profiles
  where organization_id = v_job.organization_id and user_id = auth.uid() and active;
  if not found or not exists (
    select 1 from public.job_assignments a
    where a.job_id = v_job.id and a.technician_id = v_technician.id and a.unassigned_at is null
  ) then
    raise exception 'This job is not assigned to the current technician' using errcode = '42501';
  end if;
  if p_outcome in ('qc', 'completed') and v_job.safety_class in ('hv_isolated', 'hv_battery_open') and not exists (
    select 1 from public.hv_work_permits p where p.job_id = v_job.id and p.state = 'closed'
  ) then
    raise exception 'Close the high-voltage permit before QC or completion' using errcode = '23514';
  end if;

  update public.labor_entries
  set ended_at = greatest(clock_timestamp(), started_at + interval '1 millisecond'),
      pause_reason = case when p_outcome in ('paused', 'blocked') then nullif(trim(p_note), '') else null end
  where job_id = v_job.id and technician_id = v_technician.id and ended_at is null;
  if not found then raise exception 'No active timer exists for this job' using errcode = '23514'; end if;

  update public.jobs set status = p_outcome,
    completed_at = case when p_outcome = 'completed' then clock_timestamp() else null end
  where id = v_job.id returning * into v_job;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_job.organization_id, auth.uid(), 'job.timer_stopped', 'job', v_job.id,
    jsonb_build_object('outcome', p_outcome, 'note', nullif(trim(p_note), '')));
  return v_job;
end;
$function$;

CREATE OR REPLACE FUNCTION public.close_cash_session(p_session_id uuid, p_counted_close numeric)
 RETURNS cash_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_session public.cash_sessions%rowtype; v_expected numeric;
begin
  select * into strict v_session from public.cash_sessions where id=p_session_id for update;
  if v_session.staff_user_id<>auth.uid() or not app_private.has_permission(v_session.organization_id,v_session.branch_id,'payment.receive') then raise exception 'Only the owning cashier can close this register' using errcode='42501'; end if;
  if v_session.status<>'open' or p_counted_close<0 then raise exception 'Open session and non-negative count are required' using errcode='22023'; end if;
  select v_session.opening_float + coalesce(sum(p.amount),0) - coalesce((select sum(r.amount) from public.payment_refunds r join public.payments rp on rp.id=r.payment_id where rp.method='cash' and rp.received_by=v_session.staff_user_id and r.branch_id=v_session.branch_id and r.created_at>=v_session.opened_at and r.status='recorded'),0)
  into v_expected from public.payments p where p.branch_id=v_session.branch_id and p.received_by=v_session.staff_user_id and p.method='cash' and p.received_at>=v_session.opened_at and p.status in ('received','partially_refunded','refunded');
  update public.cash_sessions set expected_close=round(v_expected,3),counted_close=round(p_counted_close,3),variance=round(p_counted_close-v_expected,3),status='closed',closed_at=now() where id=v_session.id returning * into v_session;
  return v_session;
end; $function$;
