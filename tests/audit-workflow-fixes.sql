-- Synthetic invoice/payment fixtures only. No provider calls; all rows roll back.
begin;
do $$
declare
 org uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid();
 actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); customer uuid; vehicle uuid; model uuid; ro uuid;
 invoice public.invoices%rowtype; payment public.payments%rowtype; replay public.payments%rowtype;
 key text:=gen_random_uuid()::text;
 credit public.credit_notes%rowtype; refund public.payment_refunds%rowtype; refund_key text:=gen_random_uuid()::text;
 line_id uuid; estimate uuid; invoice2 uuid; ro2 uuid; job public.jobs%rowtype; current_order public.repair_orders%rowtype;
 template uuid; service uuid; waitlist uuid; booking uuid;
 part uuid; warehouse uuid; bin uuid; balance uuid; stock jsonb; result jsonb;
begin
 insert into auth.users(id) values(actor),(outsider);
 insert into public.profiles(user_id,display_name) values(actor,'Audit admin'),(outsider,'Audit outsider') on conflict(user_id) do nothing;
 insert into public.organizations(id,legal_name,display_name) values(org,'Audit payment test','Audit payment test'),(other_org,'Audit other tenant','Audit other tenant');
 insert into public.branches(id,organization_id,code,legal_name,display_name,city) values(branch,org,'AUDIT','Audit','Audit','Amman');
 insert into public.memberships(organization_id,user_id,role) values(org,actor,'admin'),(other_org,outsider,'admin');
 insert into public.customers(organization_id,display_name) values(org,'Synthetic customer') returning id into customer;
 insert into public.vehicle_models(organization_id,model_code,name) values(org,'AUDIT','Audit vehicle') returning id into model;
 insert into public.vehicles(organization_id,registration_no,model_id,model_year) values(org,'AUDIT',model,2024) returning id into vehicle;
 insert into public.repair_orders(organization_id,branch_id,ro_number,customer_id,vehicle_id,customer_concern) values(org,branch,'AUDIT',customer,vehicle,'Synthetic test') returning id into ro;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 invoice:=public.create_invoice_from_repair_order(ro);
 perform public.add_invoice_line(invoice.id,invoice.version,'labor','Synthetic service',2,10,0,0);
 begin
  perform public.add_invoice_line(invoice.id,invoice.version,'labor','Stale edit',1,10,0,0);
  raise exception 'Stale invoice version accepted';
 exception when serialization_failure then null; end;
 select * into invoice from public.invoices where id=invoice.id;
 invoice:=public.post_invoice(invoice.id,invoice.version);
 if invoice.grand_total<>20 or invoice.status<>'posted' then raise exception 'Invoice totals/posting wrong'; end if;
 if (select count(*) from integration.outbox_events where aggregate_id=invoice.id and event_type='invoice.posted')<>1 then raise exception 'Posting event missing or duplicated'; end if;
 payment:=public.receive_invoice_payment(invoice.id,10,'cash',null,key);
 replay:=public.receive_invoice_payment(invoice.id,10,'cash',null,key);
 if payment.id<>replay.id then raise exception 'Payment replay created a second receipt'; end if;
 if (select paid_total from public.invoices where id=invoice.id)<>10 then raise exception 'Replay changed balance'; end if;
 if (select count(*) from public.payment_allocations where invoice_id=invoice.id)<>1 then raise exception 'Replay duplicated allocation'; end if;
 begin
  perform public.receive_invoice_payment(invoice.id,11,'cash',null,gen_random_uuid()::text);
  raise exception 'Overpayment accepted';
 exception when check_violation then null; end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin
  perform public.receive_invoice_payment(invoice.id,10,'cash',null,gen_random_uuid()::text);
  raise exception 'Cross-tenant payment accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform public.receive_invoice_payment(invoice.id,10,'cash',null,gen_random_uuid()::text);
 if not exists(select 1 from public.invoices where id=invoice.id and status='paid' and paid_total=20) then raise exception 'Final balance wrong'; end if;

 select id into line_id from public.invoice_lines where invoice_id=invoice.id;
 credit:=public.post_credit_note(invoice.id,'Synthetic return',jsonb_build_array(jsonb_build_object('invoice_line_id',line_id,'quantity',1)));
 refund:=public.record_payment_refund(payment.id,credit.id,6,'Return',null,refund_key);
 perform public.record_payment_refund(payment.id,credit.id,6,'Return',null,refund_key);
 if (select count(*) from public.payment_refunds where credit_note_id=credit.id)<>1 then raise exception 'Refund replay duplicated'; end if;
 begin perform public.record_payment_refund(payment.id,credit.id,5,'Return',null,refund_key); raise exception 'Changed refund replay allowed'; exception when unique_violation then null; end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin perform public.record_payment_refund(payment.id,credit.id,6,'Return',null,refund_key); raise exception 'Unauthorized refund replay allowed'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.record_payment_refund(payment.id,credit.id,5,'Return',null,gen_random_uuid()::text); raise exception 'Excess refund allowed'; exception when check_violation then null; end;
 begin perform public.record_payment_refund(payment.id,credit.id,'NaN'::numeric,'Return',null,gen_random_uuid()::text); raise exception 'NaN refund allowed'; exception when invalid_parameter_value then null; end;
 if app_private.invoice_net_due(invoice.id)<>0 then raise exception 'Credit/refund balance wrong'; end if;

 -- Partially approved scope copies only approved lines; retries never duplicate.
 insert into public.repair_orders(organization_id,branch_id,ro_number,customer_id,vehicle_id,customer_concern) values(org,branch,'AUDIT-2',customer,vehicle,'Handoff') returning id into ro2;
 insert into public.estimate_versions(organization_id,branch_id,repair_order_id,version_no,currency) values(org,branch,ro2,1,'JOD') returning id into estimate;
 perform public.add_estimate_line(estimate,'labor','Approved labor',1,30,0,0,'General',null);
 perform public.add_estimate_line(estimate,'part','Declined part',1,10,0,0,'Optional',null);
 update public.estimate_versions set status='partially_approved' where id=estimate;
 insert into public.estimate_approvals(organization_id,branch_id,estimate_version_id,approval_group,decision,channel,actor_user_id) values(org,branch,estimate,'General','approved','in_person',actor);
 invoice2:=public.materialize_approved_estimate(estimate,'invoice');
 perform public.materialize_approved_estimate(estimate,'invoice');
 perform public.materialize_approved_estimate(estimate,'jobs');
 perform public.materialize_approved_estimate(estimate,'jobs');
 if (select count(*) from public.invoice_lines where invoice_id=invoice2)<>1 or (select grand_total from public.invoices where id=invoice2)<>30 then raise exception 'Approved invoice handoff incorrect'; end if;
 if (select count(*) from public.jobs where repair_order_id=ro2)<>1 then raise exception 'Job handoff duplicated'; end if;
 if app_private.invoice_net_due(invoice2)<>0 then raise exception 'Draft counted as debt'; end if;
 select * into invoice from public.invoices where id=invoice2;
 invoice:=public.post_invoice(invoice.id,invoice.version);
 select id into line_id from public.invoice_lines where invoice_id=invoice2;
 perform public.post_credit_note(invoice2,'Partial reduction',jsonb_build_array(jsonb_build_object('invoice_line_id',line_id,'quantity',0.5)));
 if app_private.invoice_net_due(invoice2)<>15 then raise exception 'Credit did not reduce debt'; end if;
 begin perform public.receive_invoice_payment(invoice2,16,'cash',null,gen_random_uuid()::text); raise exception 'Collection exceeded net due'; exception when check_violation then null; end;
 result:=public.branch_report(org);
 if (result->0->>'outstanding')::numeric<>15 then raise exception 'Report outstanding wrong: %',result; end if;

 -- Per-job review completes work; stale whole-order evidence cannot release reopened work.
 select * into job from public.jobs where repair_order_id=ro2;
 update public.jobs set status='qc' where id=job.id returning * into job;
 perform public.review_job_quality(job.id,job.version,'fail','Needs rework');
 update public.jobs set status='qc' where id=job.id returning * into job;
 perform public.review_job_quality(job.id,job.version,'pass','Reviewed after repair');
 update public.repair_orders set status='qc' where id=ro2 returning * into current_order;
 perform public.record_quality_check(ro2,null,'TEST','pass','Reviewed');
 current_order:=public.transition_repair_order(ro2,current_order.version,'ready',null);
 current_order:=public.transition_repair_order(ro2,current_order.version,'in_progress','Additional work');
 current_order:=public.transition_repair_order(ro2,current_order.version,'qc',null);
 begin perform public.transition_repair_order(ro2,current_order.version,'ready',null); raise exception 'Old quality evidence reused'; exception when check_violation then null; end;
 perform public.record_quality_check(ro2,null,'TEST','pass','Reviewed');
 perform public.record_quality_check(ro2,null,'TEST','fail','Issue detected');
 begin perform public.transition_repair_order(ro2,current_order.version,'ready',null); raise exception 'Earlier pass overrides latest fail'; exception when check_violation then null; end;

 -- Waitlist conversion is atomic, catalog-backed and safe to repeat.
 insert into public.vehicle_ownerships(organization_id,customer_id,vehicle_id,relationship,valid_from) values(org,customer,vehicle,'owner',current_date);
 insert into public.service_templates(organization_id,code,name_en) values(org,'BOOK','Booking service') returning id into template;
 insert into public.service_template_versions(organization_id,template_id,version_no,effective_from,status) values(org,template,1,current_date,'published') returning id into service;
 insert into public.service_template_tasks(organization_id,version_id,sequence,task_code,description_en,standard_minutes) values(org,service,1,'CHECK','Inspection',30);
 insert into public.appointment_waitlist(organization_id,branch_id,customer_id,vehicle_id,preferred_from,preferred_to,duration_minutes) values(org,branch,customer,vehicle,current_date+interval '1 day 9 hours',current_date+interval '1 day 12 hours',60) returning id into waitlist;
 begin perform public.book_waitlist_entry(waitlist,current_date+interval '1 day 8 hours',current_date+interval '1 day 10 hours',array[service]); raise exception 'Out-of-window booking accepted'; exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.appointments where organization_id=org) then raise exception 'Failed booking left appointment'; end if;
 booking:=public.book_waitlist_entry(waitlist,current_date+interval '1 day 9 hours',current_date+interval '1 day 10 hours',array[service]);
 if public.book_waitlist_entry(waitlist,current_date+interval '1 day 9 hours',current_date+interval '1 day 10 hours',array[service])<>booking then raise exception 'Waitlist retry duplicated'; end if;
 if not exists(select 1 from public.appointment_waitlist where id=waitlist and status='booked' and appointment_id=booking) or (select count(*) from public.appointment_service_items where appointment_id=booking)<>1 then raise exception 'Waitlist handoff incomplete'; end if;

 -- Order reservation, issue, return and duplicate issue accounting.
 insert into public.parts(organization_id,part_number,description_en) values(org,'TEST','Test part') returning id into part;
 insert into public.warehouses(organization_id,branch_id,code,name) values(org,branch,'TEST','Test warehouse') returning id into warehouse;
 insert into public.bins(organization_id,branch_id,warehouse_id,code) values(org,branch,warehouse,'TEST') returning id into bin;
 perform public.post_stock_movement(org,branch,part,null,null,bin,5,10,'receipt','test',ro2,gen_random_uuid()::text);
 select id into balance from public.stock_balances where part_id=part;
 stock:=public.manage_order_stock(ro2,'reserve',jsonb_build_object('balance_id',balance,'quantity',2,'key','reserve'));
 stock:=public.manage_order_stock(ro2,'issue',jsonb_build_object('id',stock->>'id','version',stock->>'version','key','issue'));
 perform public.manage_order_stock(ro2,'issue',jsonb_build_object('id',stock->>'id','version',1,'key','issue'));
 if (select on_hand from public.stock_balances where id=balance)<>3 or (select reserved from public.stock_balances where id=balance)<>0 then raise exception 'Stock issue accounting wrong'; end if;
 stock:=public.manage_order_stock(ro2,'return',jsonb_build_object('id',stock->>'id','version',stock->>'version','quantity',1,'key','return'));
 if (select on_hand from public.stock_balances where id=balance)<>4 then raise exception 'Stock return accounting wrong'; end if;
 begin perform public.manage_order_stock(ro2,'return',jsonb_build_object('id',stock->>'id','version',stock->>'version','quantity',2,'key','return-excess')); raise exception 'Excess stock return allowed'; exception when check_violation then null; end;
 begin
  update public.invoices set grand_total=21 where id=invoice.id;
  raise exception 'Posted commercial fields changed';
 exception when object_not_in_prerequisite_state then null; end;
end;
$$;
select 'Audit fix regressions passed; fixtures rolled back' as result;
rollback;
