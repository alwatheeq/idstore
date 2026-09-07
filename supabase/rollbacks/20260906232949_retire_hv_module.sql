-- Manual rollback only: restore the retired module after restoring its application code.
begin;
drop trigger if exists maintenance_scope on public.jobs;
drop trigger if exists maintenance_scope on public.service_template_tasks;
drop trigger if exists maintenance_scope on public.inspection_check_definitions;
drop trigger if exists maintenance_scope on public.inspection_checklist_tasks;
drop trigger if exists maintenance_scope on public.branch_capabilities;
drop trigger if exists maintenance_scope on public.resources;
drop trigger if exists maintenance_scope on public.membership_permissions;
drop trigger if exists maintenance_scope on public.hv_work_permits;
drop trigger if exists maintenance_scope on public.hv_permit_checks;
drop trigger if exists maintenance_scope on public.qualification_types;
drop trigger if exists maintenance_scope on public.technician_qualifications;
create or replace function app_private.inspection_candidates(p_id uuid) returns setof jsonb
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
 ) select to_jsonb(a)-'user_id'-'assignment'-'org' || jsonb_build_object(
 'recommended',a.is_required or coalesce((a.rules->>'baseline')::boolean,false) or a.complaint_match or coalesce(a.schedule_due,false),
 'reason',case when a.schedule_due then 'schedule' when a.complaint_match then 'complaint' when a.is_required then 'required' when coalesce((a.rules->>'baseline')::boolean,false) then 'baseline' else 'optional' end,
 'eligible',case when nullif(a.rules->>'qualification','') is null then true else
   nullif(a.rules->>'procedure_ref','') is not null and app_private.technician_has_qualification(a.org,a.user_id,a.rules->>'qualification') end
 ) from (select distinct on (code) * from applicable order by code,(organization_id is not null) desc,(vehicle_model_id is not null) desc,id) a order by a.sort_order,a.code;
$$;

create or replace function public.inspection_workspace(p_organization_id uuid,p_inspection_id uuid default null) returns jsonb
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
  'technicians',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',p.display_name,'user_id',t.user_id)) from public.technician_profiles t join public.profiles p on p.user_id=t.user_id join public.memberships m on m.user_id=t.user_id and m.organization_id=t.organization_id where t.organization_id=p_organization_id and t.active and p.status='active' and m.status='active' and (v_i.id is null or m.role='admin' or exists(select 1 from public.membership_branches mb where mb.membership_id=m.id and mb.branch_id=v_i.branch_id)) and (m.role='admin' or exists(select 1 from public.membership_permissions mp where mp.membership_id=m.id and mp.permission_code='inspection.perform' and mp.allowed))),'[]'),
  'catalog',case when v_i.id is null then coalesce((select jsonb_agg(to_jsonb(d) order by d.sort_order) from public.inspection_check_definitions d where d.active and (d.organization_id is null or d.organization_id=p_organization_id)),'[]') else coalesce((select jsonb_agg(c) from app_private.inspection_candidates(v_i.id) c),'[]') end,
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('attempts',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('actor_name',p.display_name) order by a.attempt) from public.inspection_check_results a left join public.profiles p on p.user_id=a.recorded_by where a.task_id=t.id),'[]')) order by t.sequence) from public.inspection_checklist_tasks t where t.inspection_id=v_i.id),'[]'),
  'can_record',exists(select 1 from public.technician_profiles t where t.id=v_i.technician_id and t.user_id=auth.uid() and t.active) and app_private.has_permission(p_organization_id,v_i.branch_id,'inspection.perform'),
  'can_manage',app_private.has_permission(p_organization_id,v_i.branch_id,'inspection.perform'),
  'can_review',app_private.is_admin(p_organization_id)
 ) into v_data;
 return v_data;
end;
$$;


grant execute on function public.create_qualification_type(uuid, text, text, jsonb) to authenticated;
grant execute on function public.grant_technician_qualification(uuid, uuid, text, text, date, date) to authenticated;
grant execute on function public.create_hv_work_permit(uuid, text, jsonb, timestamptz, timestamptz) to authenticated;
grant execute on function public.record_hv_permit_check(uuid, text, text, uuid, text) to authenticated;
grant execute on function public.transition_hv_work_permit(uuid, text) to authenticated;
grant execute on function public.record_hv_permit_evidence(uuid, text, text, uuid, text, numeric, text, date, text, text, jsonb, text) to authenticated;
drop function app_private.enforce_maintenance_scope();
drop function app_private.is_maintenance_check(jsonb);
commit;
