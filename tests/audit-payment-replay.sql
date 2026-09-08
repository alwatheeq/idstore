-- Synthetic invoice/payment fixtures only. No provider calls; all rows roll back.
begin;
do $$
declare
 org uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid();
 actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); customer uuid; vehicle uuid; model uuid; ro uuid;
 invoice public.invoices%rowtype; payment public.payments%rowtype; replay public.payments%rowtype;
 key text:=gen_random_uuid()::text;
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
 begin
  update public.invoices set grand_total=21 where id=invoice.id;
  raise exception 'Posted commercial fields changed';
 exception when object_not_in_prerequisite_state then null; end;
end;
$$;
select 'Invoice version, posting/outbox, payment replay, balance and tenant tests passed; fixtures rolled back' as result;
rollback;
