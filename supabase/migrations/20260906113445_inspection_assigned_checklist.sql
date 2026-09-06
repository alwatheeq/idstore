-- Selection creates pending tasks. Results and retests are append-only evidence.
alter table public.inspection_check_definitions add column rules jsonb not null default '{}'::jsonb;
-- A definition can have multiple recorded attempts, never duplicate tasks.
drop index public.inspection_items_definition_unique;
create index inspection_items_definition_lookup on public.inspection_items(inspection_id,check_definition_id);
alter table public.inspections
  add column assignment jsonb not null default '{}'::jsonb,
  add column checklist_generated_at timestamptz,
  add column review_note text,
  add column reviewed_by uuid references auth.users(id);

create table public.inspection_checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  inspection_id uuid not null references public.inspections(id),
  definition_id uuid not null references public.inspection_check_definitions(id),
  snapshot jsonb not null,
  sequence integer not null,
  created_at timestamptz not null default now(),
  unique(inspection_id, definition_id), unique(inspection_id, sequence)
);
create table public.inspection_check_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  task_id uuid not null references public.inspection_checklist_tasks(id),
  attempt integer not null,
  result text not null check(result in ('pass','fail','inconclusive','not_applicable','exception')),
  details jsonb not null,
  technician_id uuid references public.technician_profiles(id),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  inspection_item_id uuid references public.inspection_items(id),
  unique(task_id, attempt)
);
create index inspection_tasks_scope on public.inspection_checklist_tasks(organization_id, branch_id);
create index inspection_results_scope on public.inspection_check_results(organization_id, branch_id);
alter table public.inspection_checklist_tasks enable row level security;
alter table public.inspection_check_results enable row level security;
revoke all on public.inspection_checklist_tasks, public.inspection_check_results from anon, authenticated;
grant select on public.inspection_checklist_tasks, public.inspection_check_results to authenticated;
create policy read_inspection_tasks on public.inspection_checklist_tasks for select to authenticated using(app_private.has_branch_access(organization_id, branch_id));
create policy read_inspection_results on public.inspection_check_results for select to authenticated using(app_private.has_branch_access(organization_id, branch_id));

create function app_private.inspection_evidence_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Inspection evidence is immutable; record a retest instead'; end;
$$;
create trigger immutable_inspection_results before update or delete on public.inspection_check_results for each row execute function app_private.inspection_evidence_immutable();
create trigger immutable_inspection_tasks before update or delete on public.inspection_checklist_tasks for each row execute function app_private.inspection_evidence_immutable();

-- Supersede grouped baseline entries, retaining every historical reference.
update public.inspection_check_definitions set active=false where organization_id is null and code in (
 'IDENTITY_WARNINGS','IDENTITY_SERVICE_STATUS','HV_BATTERY_SOH','HV_COMPONENTS_VISUAL','HV_BATTERY_ENCLOSURE',
 'CHARGE_PORT','CHARGE_CABLE','EXTERIOR_LIGHTS','GLASS_WIPERS','BODY_CLOSURES','TYRE_CONDITION','WHEELS',
 'FRICTION_BRAKES','BRAKE_FLUID','UNDERBODY','STEERING_SUSPENSION','CABIN_SAFETY','CLIMATE_POLLEN',
 'DIAGNOSTIC_SCAN','INFOTAINMENT_CONNECTIVITY','ROAD_TEST');

-- A category can recommend the same check as another category; definition IDs
-- are deduplicated during generation. No manufacturer intervals are invented.
insert into public.inspection_check_definitions(code,category,label_en,label_ar,is_required,sort_order,rules)
select code, category, en, ar, false, row_number() over () * 10,
  jsonb_build_object('groups',string_to_array(groups,','),'baseline',baseline,'capability',capability,
    'qualification',case when specialist then 'HV_TECHNICIAN' else '' end,
    'procedure_ref','', 'unit',unit, 'criteria','', 'evidence_required',unit<>'')
from (values
 ('EV_WARNINGS','identity','Dashboard warnings','تحذيرات لوحة العدادات','general',true,'',false,''),
 ('EV_DTC_SCAN','electronics','Diagnostic fault-code scan','فحص رموز الأعطال التشخيصية','general,no_start,charging,range,cooling',true,'',false,''),
 ('EV_HISTORY','identity','Maintenance history and due items','سجل الصيانة والبنود المستحقة','general',true,'',false,''),
 ('EV_CAMPAIGNS','identity','Applicable recalls and service campaigns','الاستدعاءات وحملات الصيانة المنطبقة','general',true,'',false,''),
 ('EV_LV_BATTERY','electronics','Low-voltage battery condition','حالة بطارية الجهد المنخفض','no_start',false,'',false,'V'),
 ('EV_LV_TERMINALS','electronics','Battery terminals and connections','أقطاب البطارية وتوصيلاتها','no_start',false,'',false,''),
 ('EV_LV_CHARGING','electronics','Low-voltage charging function','وظيفة شحن الجهد المنخفض','no_start',false,'',false,'V'),
 ('EV_READY','electronics','Starting and Ready-mode diagnosis','تشخيص التشغيل ووضع الاستعداد','no_start',false,'',false,''),
 ('EV_PORT','charging','Charge-port condition','حالة منفذ الشحن','charging',false,'',false,''),
 ('EV_PORT_LOCK','charging','Charge-port locking mechanism','آلية قفل منفذ الشحن','charging',false,'',false,''),
 ('EV_CABLE','charging','Charging cable condition','حالة كابل الشحن','charging',false,'',false,''),
 ('EV_AC_CHARGE','charging','AC charging operation','تشغيل الشحن بالتيار المتردد','charging',false,'ac',false,''),
 ('EV_DC_CHARGE','charging','DC charging operation','تشغيل الشحن بالتيار المستمر','charging',false,'dc',false,''),
 ('EV_CHARGE_DIAG','charging','Charging fault diagnosis','تشخيص أعطال الشحن','charging',false,'hv',true,''),
 ('EV_BMS','hv_battery','Battery-management-system data','بيانات نظام إدارة البطارية','range',false,'hv',true,''),
 ('EV_SOH','hv_battery','Battery health assessment','تقييم صحة البطارية','range',false,'soh',true,'%'),
 ('EV_CELL_DATA','hv_battery','Abnormal battery temperature or cell data','تشخيص حرارة البطارية أو بيانات الخلايا غير الطبيعية','range,cooling',false,'hv',true,''),
 ('EV_BRAKE_DRAG','tyres_brakes','Abnormal brake drag','مقاومة الفرامل غير الطبيعية','range,brakes',false,'',false,''),
 ('EV_ENCLOSURE','hv_battery','Accessible battery enclosure condition','حالة غلاف البطارية الذي يمكن الوصول إليه','damage',false,'hv',true,''),
 ('EV_IMPACT','underbody','Underbody impact damage','أضرار الصدمات أسفل المركبة','damage',false,'',false,''),
 ('EV_HV_CABLES','hv_battery','Visible high-voltage cable damage','أضرار كابلات الجهد العالي الظاهرة','damage',false,'hv',true,''),
 ('EV_LEAKS','underbody','Evidence of leaks','آثار التسربات','damage,cooling',false,'',false,''),
 ('EV_COOLANT','hv_battery','Coolant inspection to manufacturer procedure','فحص سائل التبريد وفق إجراء الشركة المصنعة','cooling',false,'hv',true,''),
 ('EV_HOSES','underbody','Cooling hoses and leaks','خراطيم التبريد وتسرباتها','cooling',false,'',false,''),
 ('EV_RADIATOR','underbody','Radiator condition','حالة المشع الحراري','cooling',false,'',false,''),
 ('EV_FAN','electronics','Cooling fan diagnosis','تشخيص مروحة التبريد','cooling',false,'',false,''),
 ('EV_PUMP','hv_battery','Coolant-pump diagnosis','تشخيص مضخة سائل التبريد','cooling',false,'hv',true,''),
 ('EV_DISCS','tyres_brakes','Brake disc condition','حالة أقراص الفرامل','brakes',false,'',false,''),
 ('EV_BRAKE_LINES','tyres_brakes','Brake lines and hoses','أنابيب وخراطيم الفرامل','brakes',false,'',false,''),
 ('EV_BRAKE_FLUID','tyres_brakes','Brake-fluid condition when due','حالة سائل الفرامل عند استحقاق الفحص','brakes',false,'',false,''),
 ('EV_PARKING_BRAKE','tyres_brakes','Parking-brake operation','تشغيل فرامل الوقوف','brakes',false,'',false,''),
 ('EV_REGEN','electronics','Regenerative-braking diagnosis','تشخيص الفرملة التجديدية','brakes,range',false,'hv',true,''),
 ('EV_TYRE_AGE','tyres_brakes','Tyre damage and age','أضرار الإطارات وعمرها','tyres',false,'',false,''),
 ('EV_TYRE_WEAR','tyres_brakes','Uneven tyre wear','تآكل الإطارات غير المتساوي','tyres',false,'',false,''),
 ('EV_ALIGNMENT','tyres_brakes','Alignment or balancing assessment','تقييم ضبط الزوايا أو ترصيص العجلات','tyres',false,'',false,''),
 ('EV_STEERING','underbody','Steering joints and linkages','مفاصل ووصلات التوجيه','steering',false,'',false,''),
 ('EV_SUSPENSION','underbody','Suspension components','مكونات التعليق','steering',false,'',false,''),
 ('EV_DAMPERS','underbody','Dampers','ممتصات الصدمات','steering',false,'',false,''),
 ('EV_BEARINGS','underbody','Wheel bearings','محامل العجلات','steering,tyres',false,'',false,''),
 ('EV_DRIVESHAFTS','underbody','Driveshafts and boots','أعمدة نقل الحركة وأغطيتها','steering',false,'',false,''),
 ('EV_AC_PERFORMANCE','cabin','Air-conditioning cooling performance','أداء تبريد المكيف','climate',false,'',false,'°C'),
 ('EV_HEAT_PERFORMANCE','cabin','Heating performance','أداء التدفئة','climate',false,'',false,'°C'),
 ('EV_CABIN_FILTER','cabin','Cabin filter','فلتر المقصورة','climate',false,'',false,''),
 ('EV_REFRIGERANT','cabin','Refrigerant-system diagnosis','تشخيص نظام غاز التبريد','climate',false,'',false,''),
 ('EV_LIGHTS','exterior','Exterior lights','المصابيح الخارجية','visibility',false,'',false,''),
 ('EV_HORN','cabin','Horn','البوق','visibility',false,'',false,''),
 ('EV_WIPERS','exterior','Wipers and washers','المساحات ورشاشات الغسيل','visibility',false,'',false,''),
 ('EV_WINDSCREEN','exterior','Windscreen condition','حالة الزجاج الأمامي','visibility',false,'',false,''),
 ('EV_ACCESSORY','electronics','Reported accessory faults','أعطال الملحقات المبلغ عنها','visibility',false,'',false,''),
 ('EV_DTC_RECHECK','electronics','Relevant fault-code recheck','إعادة فحص رموز الأعطال ذات الصلة','final',false,'',false,''),
 ('EV_FUNCTION_TEST','road_test','Safe functional or road test','اختبار وظيفي أو اختبار طريق آمن','final',false,'',false,''),
 ('EV_COMPLAINT_RECHECK','road_test','Confirm whether the original complaint remains','التحقق من استمرار الشكوى الأصلية','final',false,'',false,'')
) as seed(code,category,en,ar,groups,baseline,capability,specialist,unit);

insert into public.inspection_check_definitions(code,category,label_en,label_ar,is_required,sort_order,rules)
select 'EV_'||kind.code||'_'||wheel.code,'tyres_brakes',kind.en||' — '||wheel.en,kind.ar||' — '||wheel.ar,false,600+row_number() over (),
 jsonb_build_object('groups',case when kind.code='PAD' then jsonb_build_array('brakes') else jsonb_build_array('tyres','range') end,
 'baseline',false,'unit',kind.unit,'evidence_required',true)
from (values ('FL','front left','الأمامي الأيسر'),('FR','front right','الأمامي الأيمن'),('RL','rear left','الخلفي الأيسر'),('RR','rear right','الخلفي الأيمن')) wheel(code,en,ar)
cross join (values ('PAD','Brake-pad thickness','سماكة وسادة الفرامل','mm'),('PRESSURE','Tyre pressure','ضغط الإطار','bar'),('TREAD','Tread depth','عمق نقشة الإطار','mm')) kind(code,en,ar,unit);

create function app_private.inspection_candidates(p_id uuid) returns setof jsonb
language sql stable security definer set search_path='' as $$
 with ctx as (
  select i.*,v.model_id,v.model_year,vm.market,t.user_id
  from public.inspections i join public.repair_orders r on r.id=i.repair_order_id
  join public.vehicles v on v.id=r.vehicle_id left join public.vehicle_models vm on vm.id=v.model_id
  left join public.technician_profiles t on t.id=i.technician_id where i.id=p_id
 ), applicable as (
 select d.*,c.user_id,c.assignment,c.organization_id as org,
  (coalesce(d.rules->'groups','[]'::jsonb) ?| array(select jsonb_array_elements_text(coalesce(c.assignment->'groups','[]')))) as complaint_match,
  ((nullif(d.rules->>'interval_km','') is not null and nullif(c.assignment->>'last_service_km','') is not null
    and (c.assignment->>'odometer_km')::integer - (c.assignment->>'last_service_km')::integer >= (d.rules->>'interval_km')::integer)
   or (nullif(d.rules->>'interval_months','') is not null and nullif(c.assignment->>'last_service_date','') is not null
    and current_date >= (c.assignment->>'last_service_date')::date + make_interval(months=>(d.rules->>'interval_months')::integer))) as schedule_due
 from public.inspection_check_definitions d cross join ctx c
 where d.active and (d.organization_id is null or d.organization_id=c.organization_id)
 and (d.vehicle_model_id is null or d.vehicle_model_id=c.model_id)
 and (nullif(d.rules->>'year_from','') is null or c.model_year >= (d.rules->>'year_from')::int)
 and (nullif(d.rules->>'year_to','') is null or c.model_year <= (d.rules->>'year_to')::int)
 and (nullif(d.rules->>'market','') is null or lower(d.rules->>'market')=lower(coalesce(nullif(c.assignment->>'market',''),c.market)))
 and (nullif(d.rules->>'capability','') is null or coalesce(c.assignment->'capabilities','[]') ? (d.rules->>'capability'))
 and (d.organization_id is not null or not exists(select 1 from public.inspection_check_definitions o where o.organization_id=c.organization_id and o.code=d.code and (o.vehicle_model_id is null or o.vehicle_model_id=c.model_id)))
 ) select to_jsonb(a)-'user_id'-'assignment'-'org' || jsonb_build_object(
 'recommended',a.is_required or coalesce((a.rules->>'baseline')::boolean,false) or a.complaint_match or coalesce(a.schedule_due,false),
 'reason',case when a.schedule_due then 'schedule' when a.complaint_match then 'complaint' when a.is_required then 'required' when coalesce((a.rules->>'baseline')::boolean,false) then 'baseline' else 'optional' end,
 'eligible',case when nullif(a.rules->>'qualification','') is null then true else
   nullif(a.rules->>'procedure_ref','') is not null and app_private.technician_has_qualification(a.org,a.user_id,a.rules->>'qualification') end
 ) from applicable a order by a.sort_order,a.code;
$$;

create function public.inspection_workspace(p_organization_id uuid,p_inspection_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
  'technicians',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',p.display_name,'user_id',t.user_id)) from public.technician_profiles t join public.profiles p on p.user_id=t.user_id join public.memberships m on m.user_id=t.user_id and m.organization_id=t.organization_id where t.organization_id=p_organization_id and t.active and p.status='active' and m.status='active' and (v_i.id is null or (m.role='admin' and m.all_branches) or exists(select 1 from public.membership_branches mb where mb.membership_id=m.id and mb.branch_id=v_i.branch_id)) and (m.role='admin' or exists(select 1 from public.membership_permissions mp where mp.membership_id=m.id and mp.permission_code='inspection.perform' and mp.allowed))),'[]'),
  'catalog',case when v_i.id is null then coalesce((select jsonb_agg(to_jsonb(d) order by d.sort_order) from public.inspection_check_definitions d where d.active and (d.organization_id is null or d.organization_id=p_organization_id)),'[]') else coalesce((select jsonb_agg(c) from app_private.inspection_candidates(v_i.id) c),'[]') end,
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('attempts',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('actor_name',p.display_name) order by a.attempt) from public.inspection_check_results a left join public.profiles p on p.user_id=a.recorded_by where a.task_id=t.id),'[]')) order by t.sequence) from public.inspection_checklist_tasks t where t.inspection_id=v_i.id),'[]'),
  'can_record',exists(select 1 from public.technician_profiles t where t.id=v_i.technician_id and t.user_id=auth.uid() and t.active) and app_private.has_permission(p_organization_id,v_i.branch_id,'inspection.perform'),
  'can_manage',app_private.has_permission(p_organization_id,v_i.branch_id,'inspection.perform'),
  'can_review',app_private.is_admin(p_organization_id)
 ) into v_data;
 return v_data;
end;
$$;

create function public.inspection_workflow(p_inspection_id uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
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
  if not found or not ((v_m.role='admin' and v_m.all_branches) or exists(select 1 from public.membership_branches mb where mb.membership_id=v_m.id and mb.branch_id=v_i.branch_id))
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
$$;

create function public.configure_inspection_check(p_organization_id uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_d public.inspection_check_definitions%rowtype; v_id uuid; v_rules jsonb:=coalesce(p_data->'rules','{}'); v_model uuid:=nullif(p_data->>'vehicle_model_id','')::uuid;
begin
 if auth.uid() is null or not app_private.is_admin(p_organization_id) then raise exception 'Only an administrator can manage inspection checks' using errcode='42501'; end if;
 if v_model is not null and not exists(select 1 from public.vehicle_models where id=v_model and (organization_id is null or organization_id=p_organization_id)) then raise exception 'Vehicle model unavailable'; end if;
 if nullif(v_rules->>'interval_km','') is not null or nullif(v_rules->>'interval_months','') is not null then
  if nullif(trim(v_rules->>'manufacturer_ref'),'') is null or v_model is null or nullif(v_rules->>'market','') is null or nullif(v_rules->>'year_from','') is null or nullif(v_rules->>'year_to','') is null then raise exception 'Schedule rules require model, year range, market and manufacturer reference'; end if;
  if coalesce((v_rules->>'interval_km')::int,1)<1 or coalesce((v_rules->>'interval_months')::int,1)<1 then raise exception 'Schedule intervals must be positive'; end if;
 end if;
 if coalesce((v_rules->>'year_from')::int,1900)>coalesce((v_rules->>'year_to')::int,2200) then raise exception 'Invalid model year range'; end if;
 if v_rules->>'capability' in ('hv','soh') and (nullif(v_rules->>'qualification','') is null or v_model is null or nullif(trim(v_rules->>'procedure_ref'),'') is null) then raise exception 'HV checks require a model, qualification code and vehicle procedure'; end if;
 if jsonb_typeof(v_rules->'groups') is distinct from 'array' then raise exception 'Select problem categories'; end if;
 if nullif(p_data->>'id','') is not null then
  select * into v_d from public.inspection_check_definitions where id=(p_data->>'id')::uuid and (organization_id is null or organization_id=p_organization_id);
  if not found then raise exception 'Check unavailable'; end if;
  if v_d.organization_id=p_organization_id then
   update public.inspection_check_definitions set vehicle_model_id=v_model,code=upper(trim(p_data->>'code')),category=p_data->>'category',label_en=trim(p_data->>'label_en'),label_ar=trim(p_data->>'label_ar'),is_required=coalesce((p_data->>'is_required')::boolean,false),rules=v_rules,updated_at=now() where id=v_d.id;
   insert into audit.events(organization_id,actor_id,action,entity_type,entity_id) values(p_organization_id,auth.uid(),'inspection.catalog_configured','inspection_check_definition',v_d.id);
   return v_d.id;
  end if;
 end if;
 insert into public.inspection_check_definitions(organization_id,vehicle_model_id,code,category,label_en,label_ar,is_required,sort_order,rules,created_by)
 values(p_organization_id,v_model,upper(trim(p_data->>'code')),p_data->>'category',trim(p_data->>'label_en'),trim(p_data->>'label_ar'),coalesce((p_data->>'is_required')::boolean,false),coalesce((p_data->>'sort_order')::int,900),v_rules,auth.uid())
 on conflict(organization_id,vehicle_model_id,code) do update set label_en=excluded.label_en,label_ar=excluded.label_ar,category=excluded.category,is_required=excluded.is_required,sort_order=excluded.sort_order,rules=excluded.rules,active=true,updated_at=now()
 returning id into v_id;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(p_organization_id,auth.uid(),'inspection.catalog_configured','inspection_check_definition',v_id,jsonb_build_object('source_id',v_d.id));
 return v_id;
end;
$$;

-- Enforce the new workflow even when an old browser posts the previous action.
create or replace function public.add_inspection_catalog_items(p_inspection_id uuid,p_items jsonb) returns integer language plpgsql security definer set search_path='' as $$
begin raise exception 'Select checks and generate pending tasks before recording results'; end;
$$;
create or replace function public.complete_inspection(p_inspection_id uuid) returns public.inspections language plpgsql security definer set search_path='' as $$
begin raise exception 'Review recommendations and complete the generated checklist'; end;
$$;

-- Block deleting old evidence once it is linked to an append-only result.
create function app_private.protect_inspection_item() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.inspection_check_results where inspection_item_id=old.id) then raise exception 'Inspection evidence is immutable; record a retest instead'; end if;
 return old;
end;
$$;
create trigger protect_inspection_item before update or delete on public.inspection_items for each row execute function app_private.protect_inspection_item();

revoke all on function app_private.inspection_candidates(uuid) from public,anon,authenticated;
revoke all on function public.inspection_workspace(uuid,uuid), public.inspection_workflow(uuid,text,jsonb),public.configure_inspection_check(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.inspection_workspace(uuid,uuid),public.inspection_workflow(uuid,text,jsonb),public.configure_inspection_check(uuid,jsonb) to authenticated;

create index inspection_tasks_definition on public.inspection_checklist_tasks(definition_id);
create index inspection_results_item on public.inspection_check_results(inspection_item_id);
create index inspection_results_technician on public.inspection_check_results(technician_id);
create index inspection_results_actor on public.inspection_check_results(recorded_by);
create index inspections_reviewer on public.inspections(reviewed_by);
