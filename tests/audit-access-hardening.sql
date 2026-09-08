-- Synthetic fixtures only. Exercises actual authenticated/anon RLS roles.
-- No messages or payment-provider calls. All changes roll back.
begin;
do $$
declare
 org uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid();
 portal_user uuid:=gen_random_uuid(); other_portal uuid:=gen_random_uuid();
 customer uuid; other_customer uuid; model uuid; vehicle uuid; ro uuid; invoice public.invoices%rowtype;
 own_request uuid; own_invoice uuid; visible_count integer; options jsonb;
begin
 insert into auth.users(id) values(staff),(portal_user),(other_portal);
 insert into public.profiles(user_id,display_name) values(staff,'ACL test staff') on conflict(user_id) do nothing;
 insert into public.organizations(id,legal_name,display_name) values(org,'ACL hardening synthetic test','ACL hardening synthetic test');
 insert into public.branches(id,organization_id,code,legal_name,display_name,city) values(branch,org,'ACL','ACL test','ACL test','Amman');
 insert into public.memberships(organization_id,user_id,role) values(org,staff,'admin');
 insert into public.customers(organization_id,display_name) values(org,'ACL customer') returning id into customer;
 insert into public.customers(organization_id,display_name) values(org,'ACL other customer') returning id into other_customer;
 insert into public.customer_accounts(organization_id,customer_id,auth_user_id) values(org,customer,portal_user),(org,other_customer,other_portal);
 insert into public.vehicle_models(organization_id,model_code,name) values(org,'ACL','ACL test') returning id into model;
 insert into public.vehicles(organization_id,registration_no,model_id) values(org,'ACL',model) returning id into vehicle;
 insert into public.repair_orders(organization_id,branch_id,ro_number,customer_id,vehicle_id) values(org,branch,'ACL-1',customer,vehicle) returning id into ro;
 perform set_config('request.jwt.claim.sub',staff::text,true);
 invoice:=public.create_invoice_from_repair_order(ro);
 own_invoice:=invoice.id;
 insert into public.portal_payment_requests(organization_id,branch_id,customer_id,invoice_id,amount,currency,requested_by)
 values(org,branch,customer,invoice.id,10,'JOD',portal_user) returning id into own_request;
 insert into public.repair_orders(organization_id,branch_id,ro_number,customer_id,vehicle_id) values(org,branch,'ACL-2',other_customer,vehicle) returning id into ro;
 invoice:=public.create_invoice_from_repair_order(ro);
 insert into public.portal_payment_requests(organization_id,branch_id,customer_id,invoice_id,amount,currency,requested_by)
 values(org,branch,other_customer,invoice.id,10,'JOD',other_portal);

 execute 'set local role authenticated';
 select count(*) into visible_count from public.portal_payment_requests where organization_id=org;
 if visible_count<>2 then raise exception 'Authorized staff lost access'; end if;
 perform set_config('request.jwt.claim.sub',portal_user::text,true);
 select count(*) into visible_count from public.portal_payment_requests where organization_id=org;
 -- customer_accounts is staff-RLS scoped. The portal intentionally reads via
 -- its identity-checked RPC, not direct table access (unchanged by hardening).
 if visible_count<>0 then raise exception 'Portal gained unexpected direct table access'; end if;
 options:=public.portal_service_options();
 if jsonb_array_length(options->'payment_requests')<>1 or options->'payment_requests'->0->>'invoice_id'<>own_invoice::text then raise exception 'Portal RPC ownership scope changed'; end if;
 perform set_config('request.jwt.claim.sub',other_portal::text,true);
 select count(*) into visible_count from public.portal_payment_requests where organization_id=org;
 if visible_count<>0 then raise exception 'Other portal gained direct table access'; end if;
 options:=public.portal_service_options();
 if jsonb_array_length(options->'payment_requests')<>1 or options->'payment_requests'->0->>'invoice_id'=own_invoice::text then raise exception 'Other portal RPC can read wrong customer'; end if;
 execute 'reset role';
 update public.customer_accounts set status='revoked' where auth_user_id=portal_user;
 perform set_config('request.jwt.claim.sub',portal_user::text,true);
 execute 'set local role authenticated';
 select count(*) into visible_count from public.portal_payment_requests where organization_id=org;
 if visible_count<>0 then raise exception 'Revoked portal retained access'; end if;
 begin
  perform public.portal_service_options();
  raise exception 'Revoked portal retained RPC access';
 exception when insufficient_privilege then null; end;
 execute 'set local role anon';
 begin
  perform 1 from public.portal_payment_requests limit 1;
  raise exception 'Anonymous table access still granted';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
end;
$$;
select 'Authenticated staff, portal ownership/revocation and anonymous-denial RLS tests passed; fixtures rolled back' as result;
rollback;
