-- Synthetic fixtures only. Always rolls back, including test users and audit events.
begin;
do $$
declare
 org uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid();
 admin_user uuid:=gen_random_uuid(); tech_user uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 tech_member uuid; other_member uuid; tech uuid; customer uuid; vehicle uuid; model uuid; ro uuid; inspection uuid; definition uuid; task uuid; job uuid; cash uuid;
 version_no bigint; payload jsonb; ws jsonb; assignment jsonb; snapshot_before jsonb;
begin
 insert into auth.users(id) values(admin_user),(tech_user),(other_user),(outsider);
 insert into public.profiles(user_id,display_name) values(admin_user,'Test admin'),(tech_user,'Test technician'),(other_user,'Test other staff'),(outsider,'Test outsider') on conflict(user_id) do nothing;
 insert into public.organizations(id,legal_name,display_name) values(org,'Permission test','Permission test'),(other_org,'Other permission test','Other permission test');
 insert into public.branches(id,organization_id,code,legal_name,display_name,city) values(branch,org,'TEST','Permission test','Permission test','Test');
 insert into public.memberships(organization_id,user_id,role) values(org,admin_user,'admin'),(other_org,outsider,'admin');
 insert into public.memberships(organization_id,user_id,role) values(org,tech_user,'staff') returning id into tech_member;
 insert into public.memberships(organization_id,user_id,role) values(org,other_user,'staff') returning id into other_member;
 insert into public.membership_branches(organization_id,membership_id,branch_id) values(org,tech_member,branch),(org,other_member,branch);
 insert into public.membership_permissions(organization_id,membership_id,permission_code) select org,m,p from unnest(array[tech_member,other_member]) m cross join unnest(array['inspection.perform','job.perform','payment.receive']) p;
 insert into public.technician_profiles(organization_id,user_id) values(org,tech_user) returning id into tech;
 insert into public.customers(organization_id,display_name) values(org,'Test customer') returning id into customer;
 insert into public.vehicle_models(organization_id,model_code,name) values(org,'TEST','Test vehicle') returning id into model;
 insert into public.vehicles(organization_id,registration_no,model_id,model_year) values(org,'TEST',model,2024) returning id into vehicle;
 insert into public.repair_orders(organization_id,branch_id,ro_number,customer_id,vehicle_id,customer_concern) values(org,branch,'TEST',customer,vehicle,'Test concern') returning id into ro;
 assignment:=jsonb_build_object('technician_id',tech,'odometer_km',1000,'complaint','Test concern','groups',jsonb_build_array('general'),'capabilities','[]'::jsonb);
 insert into public.inspections(organization_id,branch_id,repair_order_id,technician_id,status,assignment,checklist_generated_at) values(org,branch,ro,tech,'in_progress',assignment,now()) returning id into inspection;
 insert into public.inspection_check_definitions(organization_id,code,category,label_en,label_ar,is_required) values(org,'TEST_CHECK','identity','Test check','فحص تجريبي',false) returning id into definition;
 snapshot_before:=jsonb_build_object('id',definition,'code','TEST_CHECK','label_en','Test check','label_ar','فحص تجريبي','rules','{}'::jsonb);
 insert into public.inspection_checklist_tasks(organization_id,branch_id,inspection_id,definition_id,snapshot,sequence) values(org,branch,inspection,definition,snapshot_before,1) returning id into task;
 payload:=jsonb_build_object('task_id',task,'expected_attempt',0,'result','pass','criteria','Synthetic criteria','recorded_on_behalf','false');

 -- A staff member with the capability but not the assignment cannot enter results.
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 ws:=public.inspection_workspace(org,inspection);
 if (ws->>'can_record')::boolean or (ws->>'can_reassign')::boolean then raise exception 'Unassigned staff exposed write controls'; end if;
 begin perform public.inspection_workflow(inspection,'record',payload); raise exception 'Unassigned staff was allowed'; exception when insufficient_privilege then null; end;
 begin perform public.inspection_workflow(inspection,'assign',assignment); raise exception 'Staff could reassign generated checklist'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin perform public.inspection_workflow(inspection,'record',payload); raise exception 'Cross-tenant admin was allowed'; exception when insufficient_privilege then null; end;

 -- Admin has no technician profile, but records for the assigned technician.
 perform set_config('request.jwt.claim.sub',admin_user::text,true);
 ws:=public.inspection_workspace(org,inspection);
 if not ((ws->>'can_record')::boolean and (ws->>'can_reassign')::boolean and (ws->>'recording_on_behalf')::boolean) then raise exception 'Admin workspace permissions missing'; end if;
 perform public.inspection_workflow(inspection,'record',payload);
 if not exists(select 1 from public.inspection_check_results where task_id=task and attempt=1 and technician_id=tech and recorded_by=admin_user and details->>'recorded_on_behalf'='true') then raise exception 'Incorrect on-behalf attribution'; end if;
 perform public.inspection_workflow(inspection,'assign',assignment||'{"complaint":"Updated concern"}');
 if (select snapshot from public.inspection_checklist_tasks where id=task) is distinct from snapshot_before then raise exception 'Reassignment changed original checklist'; end if;
 if not exists(select 1 from audit.events where entity_id=inspection and action='inspection.assign' and actor_id=admin_user and metadata->'previous_assignment'=assignment) then raise exception 'Assignment history not audited'; end if;
 begin
  perform public.inspection_workflow(inspection,'record',payload||'{"expected_attempt":1}');
  raise exception 'Retest without a reason succeeded';
 exception when raise_exception then if sqlerrm='Retest without a reason succeeded' then raise; end if; end;
 perform public.inspection_workflow(inspection,'record',payload||'{"expected_attempt":1,"retest_note":"Rechecked after repair"}');
 if (select count(*) from public.inspection_check_results where task_id=task)<>2 then raise exception 'Retest did not preserve original'; end if;
 begin update public.inspection_check_results set result='fail' where task_id=task; raise exception 'Evidence mutation succeeded'; exception when raise_exception then if sqlerrm='Evidence mutation succeeded' then raise; end if; end;
 -- An actual assigned technician still works and cannot forge an on-behalf flag.
 perform set_config('request.jwt.claim.sub',tech_user::text,true);
 perform public.inspection_workflow(inspection,'record',payload||'{"expected_attempt":2,"retest_note":"Technician verification","recorded_on_behalf":"true"}');
 if not exists(select 1 from public.inspection_check_results where task_id=task and attempt=3 and recorded_by=tech_user and details->>'recorded_on_behalf'='false') then raise exception 'Technician attribution regression'; end if;

 insert into public.jobs(organization_id,branch_id,repair_order_id,description_snapshot,status) values(org,branch,ro,'Synthetic job','ready') returning id,version into job,version_no;
 insert into public.job_assignments(organization_id,branch_id,job_id,technician_id) values(org,branch,job,tech);
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 begin perform public.start_job(job,version_no); raise exception 'Unassigned staff started timer'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',admin_user::text,true);
 perform public.start_job(job,version_no);
 if not exists(select 1 from public.labor_entries where job_id=job and technician_id=tech and ended_at is null) then raise exception 'Timer assigned to wrong technician'; end if;
 if not exists(select 1 from audit.events where entity_id=job and action='job.timer_started' and actor_id=admin_user and (metadata->>'recorded_on_behalf')::boolean) then raise exception 'Timer actor missing'; end if;
 select version into version_no from public.jobs where id=job;
 perform public.finish_job(job,version_no,'completed','Admin recording completion');
 if exists(select 1 from public.labor_entries where job_id=job and ended_at is null) then raise exception 'Timer not stopped'; end if;
 if not exists(select 1 from audit.events where entity_id=job and action='job.timer_stopped' and actor_id=admin_user and metadata->>'technician_id'=tech::text) then raise exception 'Completion attribution missing'; end if;

 insert into public.cash_sessions(organization_id,branch_id,staff_user_id,register_code,opening_float) values(org,branch,tech_user,'TEST',10) returning id into cash;
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 begin perform public.close_cash_session(cash,10); raise exception 'Unrelated staff closed cashier register'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',admin_user::text,true);
 perform public.close_cash_session(cash,10);
 if not exists(select 1 from public.cash_sessions where id=cash and status='closed' and staff_user_id=tech_user and variance=0) then raise exception 'Cashier ownership or balance changed'; end if;
 if not exists(select 1 from audit.events where entity_id=cash and action='cash_session.closed' and actor_id=admin_user) then raise exception 'Register closure actor missing'; end if;
 update public.memberships set status='suspended' where organization_id=org and user_id=admin_user;
 begin perform public.inspection_workspace(org,inspection); raise exception 'Disabled admin retained access'; exception when insufficient_privilege then null; end;
end;
$$;
select 'Admin on-behalf permission tests passed; all fixtures rolled back' as result;
rollback;
