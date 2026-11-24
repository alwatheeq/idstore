-- Audit F04–F06: reviewed hold release and revision-bound quality evidence.
alter table public.repair_orders add column release_revision bigint not null default 1;
alter table public.quality_checks add column release_revision bigint not null default 0;
create function app_private.invalidate_quality_release() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status is distinct from old.status and new.status in ('diagnosis','in_progress') then new.release_revision:=old.release_revision+1; end if;
 return new;
end; $$;
create trigger invalidate_quality_release before update of status on public.repair_orders for each row execute function app_private.invalidate_quality_release();
revoke all on function app_private.invalidate_quality_release() from public,anon,authenticated;


create or replace function public.transition_repair_order(p_repair_order_id uuid,p_expected_version bigint,p_to_status text,p_reason text default null)
returns public.repair_orders language plpgsql security definer set search_path = '' as $$
declare v_order public.repair_orders%rowtype; v_from_status text; v_allowed boolean;
begin
  select * into strict v_order from public.repair_orders where id=p_repair_order_id for update;
  if not app_private.has_permission(v_order.organization_id,v_order.branch_id,'repair_order.manage') then raise exception 'Not authorized to progress repair orders' using errcode='42501'; end if;
  if v_order.version<>p_expected_version then raise exception 'Repair order was changed by another user' using errcode='40001'; end if;
  v_from_status:=v_order.status;
  v_allowed:=case v_order.status when 'draft' then p_to_status in ('checked_in','cancelled') when 'checked_in' then p_to_status in ('diagnosis','on_hold','cancelled') when 'diagnosis' then p_to_status in ('awaiting_approval','approved','on_hold','cancelled') when 'awaiting_approval' then p_to_status in ('approved','diagnosis','on_hold','cancelled') when 'approved' then p_to_status in ('in_progress','on_hold','cancelled') when 'in_progress' then p_to_status in ('qc','on_hold') when 'qc' then p_to_status in ('ready','in_progress') when 'ready' then p_to_status in ('delivered','in_progress') when 'delivered' then p_to_status='closed' when 'on_hold' then p_to_status in ('diagnosis','awaiting_approval','approved','in_progress','cancelled') else false end;
  if not v_allowed then raise exception 'Invalid repair order transition: % to %',v_order.status,p_to_status using errcode='22023'; end if;
  if v_order.risk_state in ('restricted','quarantine','emergency_escalation') and p_to_status in ('ready','delivered','closed') then raise exception 'Safety hold must be cleared before handover' using errcode='23514'; end if;
  if p_to_status in ('ready','delivered') then
    if exists(select 1 from public.jobs where repair_order_id=v_order.id and status not in ('completed','cancelled')) then
      raise exception 'Complete all workshop jobs before release' using errcode='23514';
    end if;
    if not coalesce((select q.result='pass' from public.quality_checks q where q.repair_order_id=v_order.id and q.job_id is null and q.release_revision=v_order.release_revision order by q.signed_at desc,q.id desc limit 1),false) then
      raise exception 'A current passing whole-order quality check is required before release' using errcode='23514';
    end if;
  end if;
  update public.repair_orders set status=p_to_status,closed_at=case when p_to_status='closed' then now() else closed_at end where id=p_repair_order_id returning * into v_order;
  insert into public.repair_order_events(organization_id,branch_id,repair_order_id,from_status,to_status,reason,actor_id) values(v_order.organization_id,v_order.branch_id,v_order.id,v_from_status,p_to_status,p_reason,auth.uid());
  return v_order;
end; $$;

create or replace function public.record_quality_check(p_repair_order_id uuid,p_job_id uuid,p_checklist_version text,p_result text,p_notes text)
returns public.quality_checks language plpgsql security definer set search_path = '' as $$
declare v_order public.repair_orders%rowtype; v_check public.quality_checks%rowtype;
begin
  select * into strict v_order from public.repair_orders where id=p_repair_order_id for update;
  if not app_private.has_permission(v_order.organization_id,v_order.branch_id,'repair_order.manage') then raise exception 'Not authorized to sign quality checks' using errcode='42501'; end if;
  if v_order.status not in ('qc','ready') or p_result not in ('pass','fail') or nullif(trim(p_checklist_version),'') is null then raise exception 'Quality check values or repair-order state are invalid' using errcode='22023'; end if;
  if p_job_id is not null then raise exception 'Review the workshop job using its current version first' using errcode='22023'; end if;
  if p_result='pass' and exists(select 1 from public.jobs where repair_order_id=v_order.id and status not in ('completed','cancelled')) then raise exception 'Complete all workshop jobs before signing release' using errcode='23514'; end if;
  if p_job_id is not null and not exists(select 1 from public.jobs where id=p_job_id and repair_order_id=v_order.id) then raise exception 'Quality-check job does not belong to repair order' using errcode='23514'; end if;
  insert into public.quality_checks(organization_id,branch_id,repair_order_id,job_id,checklist_version,result,notes,signed_by,release_revision,signed_at) values(v_order.organization_id,v_order.branch_id,v_order.id,p_job_id,trim(p_checklist_version),p_result,nullif(trim(p_notes),''),auth.uid(),v_order.release_revision,clock_timestamp()) returning * into v_check;
  if p_result='fail' and v_order.status='ready' then
    perform public.transition_repair_order(v_order.id,v_order.version,'in_progress','Failed quality check');
  end if;
  return v_check;
end; $$;

create function public.review_job_quality(p_job_id uuid,p_expected_version bigint,p_result text,p_note text)
returns public.jobs language plpgsql security definer set search_path='' as $$
declare j public.jobs%rowtype; r public.repair_orders%rowtype;
begin
 select * into strict r from public.repair_orders where id=(select repair_order_id from public.jobs where id=p_job_id) for update;
 if not app_private.has_permission(r.organization_id,r.branch_id,'repair_order.manage') then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into strict j from public.jobs where id=p_job_id for update;
 if j.version is distinct from p_expected_version then raise exception 'Job changed; refresh first' using errcode='40001'; end if;
 if j.status<>'qc' or r.status in ('delivered','closed','cancelled') or p_result is null or p_result not in ('pass','fail') or nullif(trim(p_note),'') is null then raise exception 'A QC job, decision and review note are required' using errcode='22023'; end if;
 insert into public.quality_checks(organization_id,branch_id,repair_order_id,job_id,checklist_version,result,notes,signed_by,release_revision)
 values(r.organization_id,r.branch_id,r.id,j.id,'JOB-QC-1',p_result,trim(p_note),auth.uid(),r.release_revision);
 update public.jobs set status=case when p_result='pass' then 'completed' else 'ready' end,completed_at=case when p_result='pass' then clock_timestamp() else null end where id=j.id returning * into j;
 if p_result='fail' and r.status in ('qc','ready') then select * into r from public.repair_orders where id=r.id; perform public.transition_repair_order(r.id,r.version,'in_progress','Job quality review failed'); end if;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(r.organization_id,auth.uid(),'job.quality_reviewed','job',j.id,jsonb_build_object('result',p_result,'note',trim(p_note)));
 return j;
end; $$;
revoke all on function public.review_job_quality(uuid,bigint,text,text) from public,anon;
grant execute on function public.review_job_quality(uuid,bigint,text,text) to authenticated;

create function public.release_inspection_hold(p_repair_order_id uuid,p_expected_version bigint,p_reason text)
returns public.repair_orders language plpgsql security definer set search_path='' as $$
declare r public.repair_orders%rowtype;
begin
 select * into strict r from public.repair_orders where id=p_repair_order_id for update;
 if not app_private.is_admin(r.organization_id) then raise exception 'Only an administrator can release a safety hold' using errcode='42501'; end if;
 if r.version is distinct from p_expected_version then raise exception 'Order changed; refresh first' using errcode='40001'; end if;
 if r.risk_state not in ('quarantine','restricted') or r.status in ('delivered','closed','cancelled') or length(trim(coalesce(p_reason,'')))<10 then raise exception 'An active inspection hold and release evidence are required' using errcode='22023'; end if;
 -- Retain emergency/HV holds; this command only resolves attributable inspection failures.
 if exists(select 1 from public.hv_work_permits where repair_order_id=r.id) then raise exception 'This hold requires specialist review' using errcode='23514'; end if;
 perform 1 from public.inspections where repair_order_id=r.id for update;
 if not exists(select 1 from public.findings f join public.inspection_items it on it.id=f.inspection_item_id join public.inspections i on i.id=it.inspection_id where i.repair_order_id=r.id and f.severity in ('red','safety_stop') and f.status<>'resolved')
 or exists(select 1 from public.inspections where repair_order_id=r.id and status in ('draft','in_progress')) then raise exception 'Complete and review the inspection retests first' using errcode='23514'; end if;
 if exists(
  select 1 from public.findings f join public.inspection_items it on it.id=f.inspection_item_id join public.inspections i on i.id=it.inspection_id
  where i.repair_order_id=r.id and f.severity in ('red','safety_stop') and f.status<>'resolved'
  and not exists(select 1 from public.inspection_check_results original
   join public.inspection_checklist_tasks t on t.id=original.task_id join public.inspections reviewed on reviewed.id=t.inspection_id
   join lateral(select a.result from public.inspection_check_results a where a.task_id=t.id order by a.attempt desc limit 1) latest on true
   where original.inspection_item_id=it.id and latest.result='pass' and reviewed.status='completed')) then
   raise exception 'Every blocking finding needs a passing, reviewed retest' using errcode='23514';
 end if;
 update public.findings f set status='resolved' from public.inspection_items it,public.inspections i where f.inspection_item_id=it.id and it.inspection_id=i.id and i.repair_order_id=r.id and f.severity in ('red','safety_stop');
 update public.vehicle_recommendations v set status='completed',updated_at=clock_timestamp() where v.finding_id in(select f.id from public.findings f join public.inspection_items it on it.id=f.inspection_item_id join public.inspections i on i.id=it.inspection_id where i.repair_order_id=r.id and f.status='resolved') and v.status in ('open','scheduled');
 update public.repair_orders set risk_state='normal',release_revision=release_revision+1 where id=r.id returning * into r;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(r.organization_id,auth.uid(),'inspection.hold_released','repair_order',r.id,jsonb_build_object('reason',trim(p_reason)));
 return r;
end; $$;
revoke all on function public.release_inspection_hold(uuid,bigint,text) from public,anon;
grant execute on function public.release_inspection_hold(uuid,bigint,text) to authenticated;


-- Any changed workshop scope or progress invalidates a previously signed release.
create function app_private.invalidate_job_release() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.repair_orders set release_revision=release_revision+1 where id=coalesce(new.repair_order_id,old.repair_order_id);
 return coalesce(new,old);
end; $$;
create trigger invalidate_job_release after insert or delete or update of status,description_snapshot,safety_class,planned_minutes on public.jobs for each row execute function app_private.invalidate_job_release();
revoke all on function app_private.invalidate_job_release() from public,anon,authenticated;
