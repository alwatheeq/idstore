-- Repeatable smoke tests for critical command and tenant invariants.
-- The entire fixture is rolled back, so this is safe for a development/staging project.
-- Never run destructive or load tests against production.

begin;

do $$
declare
  v_admin uuid;
  v_org uuid;
  v_branch uuid;
  v_customer uuid;
  v_vehicle uuid;
  v_other_org uuid;
  v_other_vehicle uuid;
  v_contact_a uuid;
  v_contact_b uuid;
  v_ownership uuid;
  v_message_a uuid;
  v_message_b uuid;
  v_attachment_a uuid;
  v_attachment_b uuid;
  v_campaign uuid;
  v_match uuid;
  v_order uuid;
  v_order_version bigint;
  v_service_order uuid;
  v_intake_order uuid;
  v_appointments uuid[];
  v_appointment uuid;
  v_checkin uuid;
  v_waitlist uuid;
  v_service_version uuid;
  v_job uuid;
  v_job_version bigint;
  v_hv_job uuid;
  v_hv_permit uuid;
  v_hv_type uuid;
  v_hv_technician uuid;
  v_rework uuid;
  v_estimate uuid;
  v_supplement uuid;
  v_part uuid;
  v_related_part uuid;
  v_bin uuid;
  v_balance uuid;
  v_supplier uuid;
  v_po uuid;
  v_po_line uuid;
  v_receipt uuid;
  v_receipt_line uuid;
  v_supplier_invoice uuid;
  v_customer_invoice uuid;
  v_warehouse uuid;
  v_future timestamptz := date_trunc('day', now()) + interval '2 days 12 hours';
  v_status text;
  v_key text := 'test-' || gen_random_uuid()::text;
begin
  select m.user_id, m.organization_id
    into v_admin, v_org
  from public.memberships m
  where m.role = 'admin' and m.status = 'active'
  order by m.created_at
  limit 1;

  if v_admin is null then
    raise exception 'Transactional tests require one active Admin membership';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select b.id into v_branch
  from public.branches b
  where b.organization_id = v_org and b.status = 'active'
  order by b.created_at
  limit 1;

  if v_branch is null then
    insert into public.branches (
      organization_id, code, legal_name, display_name, city
    ) values (
      v_org, 'TEST-' || left(v_key, 8), 'Test Branch', 'Test Branch', 'Amman'
    ) returning id into v_branch;
  end if;

  insert into public.customers (
    organization_id, display_name, preferred_branch_id
  ) values (
    v_org, 'Transactional Test Customer', v_branch
  ) returning id into v_customer;

  insert into public.vehicles (
    organization_id, registration_no, model_year
  ) values (
    v_org, upper(left(replace(v_key, '-', ''), 12)), 2026
  ) returning id into v_vehicle;

  insert into public.vehicle_ownerships (
    organization_id, vehicle_id, customer_id, verified_at, verified_by
  ) values (
    v_org, v_vehicle, v_customer, now(), v_admin
  );

  select id into v_contact_a
  from public.add_customer_contact(
    v_customer, 'mobile', '+962790000000', '+962790000000', true
  );
  select id into v_contact_b
  from public.add_customer_contact(
    v_customer, 'mobile', '+962790000000', '+962790000000', true
  );

  if v_contact_a <> v_contact_b then
    raise exception 'Customer contact retry was not idempotent';
  end if;

  perform public.record_customer_consent(
    v_customer, 'service_updates', 'sms', 'granted', 'test-v1', 'transactional-test'
  );
  perform public.record_customer_consent(
    v_customer, 'service_updates', 'sms', 'withdrawn', 'test-v1', 'transactional-test'
  );

  if (select count(*) from public.consents where customer_id = v_customer) <> 2 then
    raise exception 'Consent history is not append-only';
  end if;

  perform public.add_customer_address(
    v_customer, 'service', 'JO', 'Amman', 'Amman', 'Test Street 1', '', '', true
  );
  perform public.add_customer_address(
    v_customer, 'service', 'JO', 'Amman', 'Amman', 'Test Street 2', '', '', true
  );
  if (select count(*) from public.customer_addresses where customer_id = v_customer and address_type = 'service' and is_primary) <> 1 then
    raise exception 'Customer address primary selection is inconsistent';
  end if;

  if not exists (
    select 1 from public.find_customer_duplicates(v_org, null, '+962790000000', null)
    where customer_id = v_customer and 'contact' = any(match_reasons)
  ) then
    raise exception 'Customer duplicate search did not find a shared contact';
  end if;

  select status into v_status from public.transition_customer_status(v_customer, 'restricted', 'transactional privacy hold');
  if v_status <> 'restricted' then raise exception 'Customer restriction did not apply'; end if;
  perform public.transition_customer_status(v_customer, 'active', 'transactional hold released');

  perform public.update_vehicle_profile(
    v_vehicle, v_branch, 'APP310', 'connected', '3.7', current_date - 30,
    current_date - 30, current_date + 700, 100000
  );
  if not exists (select 1 from public.vehicles where id = v_vehicle and drive_unit = 'APP310' and connectivity_status = 'connected') then
    raise exception 'Vehicle profile update did not persist';
  end if;

  select id into v_ownership from public.add_vehicle_ownership(
    v_vehicle, v_branch, v_customer, 'driver', current_date, true
  );
  perform public.end_vehicle_ownership(v_ownership, v_branch, current_date, 'transactional relationship end');
  if not exists (select 1 from public.vehicle_ownerships where id = v_ownership and valid_to = current_date) then
    raise exception 'Ownership period did not close';
  end if;

  perform public.record_odometer_reading(v_vehicle, v_branch, 1000, 'transactional-test', '');
  begin
    perform public.record_odometer_reading(v_vehicle, v_branch, 900, 'transactional-test', '');
    raise exception 'Odometer regression unexpectedly succeeded without a reason';
  exception when sqlstate '42501' then null;
  end;
  perform public.record_odometer_reading(v_vehicle, v_branch, 900, 'correction', 'instrument replacement test');

  select id into v_message_a
  from public.queue_customer_message(
    v_customer, v_branch, 'SERVICE_UPDATE', 1, 'sms', v_key || '-message'
  );
  select id into v_message_b
  from public.queue_customer_message(
    v_customer, v_branch, 'SERVICE_UPDATE', 1, 'sms', v_key || '-message'
  );

  if v_message_a <> v_message_b
     or (select count(*) from integration.outbox_events where aggregate_id = v_message_a) <> 1 then
    raise exception 'Message/outbox retry was not idempotent';
  end if;

  select id into v_attachment_a
  from public.register_attachment(
    v_org,
    null,
    'vehicle-media',
    v_org::text || '/vehicle/' || v_vehicle::text || '/inspection.jpg',
    repeat('a', 64),
    'image/jpeg',
    1024,
    'confidential',
    'vehicle',
    v_vehicle
  );
  select id into v_attachment_b
  from public.register_attachment(
    v_org,
    null,
    'vehicle-media',
    v_org::text || '/vehicle/' || v_vehicle::text || '/inspection-retry.jpg',
    repeat('a', 64),
    'image/jpeg',
    1024,
    'confidential',
    'vehicle',
    v_vehicle
  );

  if v_attachment_a <> v_attachment_b then
    raise exception 'Evidence retry was not idempotent';
  end if;

  insert into public.organizations (legal_name, display_name)
  values ('Other Test Organization', 'Other Test Organization')
  returning id into v_other_org;

  insert into public.vehicles (organization_id, registration_no)
  values (v_other_org, 'OTHER-' || left(v_key, 8))
  returning id into v_other_vehicle;

  begin
    perform public.register_attachment(
      v_org,
      null,
      'vehicle-media',
      v_org::text || '/vehicle/' || v_other_vehicle::text || '/invalid.jpg',
      repeat('b', 64),
      'image/jpeg',
      1024,
      'confidential',
      'vehicle',
      v_other_vehicle
    );
    raise exception 'Cross-tenant evidence registration unexpectedly succeeded';
  exception
    when sqlstate '23514' then null;
  end;

  select id into v_campaign
  from public.create_service_campaign(
    v_org,
    'TEST-' || left(replace(v_key, '-', ''), 10),
    'Transactional Test Campaign',
    'Rollback-only campaign fixture',
    'authorized-test-source'
  );
  select id, status into v_match, v_status
  from public.match_vehicle_campaign(v_campaign, v_vehicle, 'VIN/model test rule');

  if v_status <> 'advisory' then
    raise exception 'Unverified campaign match was not advisory';
  end if;

  perform public.transition_service_campaign(v_campaign, 'verified');
  select status into v_status
  from public.transition_campaign_vehicle_match(v_match, 'confirmed', null);

  if v_status <> 'confirmed' then
    raise exception 'Verified campaign match was not confirmable';
  end if;

  insert into public.repair_orders (
    organization_id,
    branch_id,
    ro_number,
    customer_id,
    vehicle_id,
    status,
    created_by
  ) values (
    v_org,
    v_branch,
    'RO-' || left(replace(v_key, '-', ''), 12),
    v_customer,
    v_vehicle,
    'qc',
    v_admin
  ) returning id, version into v_order, v_order_version;

  begin
    perform public.transition_repair_order(v_order, v_order_version, 'ready', 'test release');
    raise exception 'QC release unexpectedly succeeded without a passing check';
  exception
    when sqlstate '23514' then null;
  end;

  perform public.record_quality_check(v_order, null, 'test-v1', 'pass', 'rollback-only test');
  select status into v_status
  from public.transition_repair_order(v_order, v_order_version, 'ready', 'test release');

  if v_status <> 'ready' then
    raise exception 'Passing QC did not release the repair order';
  end if;

  -- Advanced scheduling, waitlist and guided check-in.
  select id into v_service_version from public.create_service_template(v_org,'TEST-SERVICE-'||left(replace(v_key,'-',''),8),'Transactional service','خدمة اختبار','JO',current_date,12,15000,'TEST-SOURCE','{"model_codes":[]}'::jsonb);
  begin
    perform public.add_service_template_task(v_service_version,'TEST-HV-INVALID','Invalid HV task','',30,'','','','{"capture":"confirmation","safety_class":"hv_isolated"}'::jsonb);
    raise exception 'HV catalog task unexpectedly accepted without a qualification code';
  exception when sqlstate '23514' then null;
  end;
  perform public.add_service_template_task(v_service_version,'TEST-CHECK','Transactional catalog check','فحص اختبار',30,'','','TEST-PROCEDURE','{"capture":"confirmation"}'::jsonb);
  perform public.publish_service_template_version(v_service_version);
  perform public.upsert_branch_operating_hour(v_branch, extract(dow from (v_future at time zone 'Asia/Amman'))::integer, '00:00', '23:59', false);
  delete from public.branch_holidays where branch_id=v_branch and holiday_date=(v_future at time zone 'Asia/Amman')::date;
  begin
    perform public.create_catalog_appointments(v_org,v_branch,v_customer,v_vehicle,v_future,v_future+interval '1 hour',null,'transactional appointment','workshop','customer_dropoff',null,null,array[]::uuid[],1);
    raise exception 'Catalog appointment unexpectedly accepted an empty service list';
  exception when sqlstate '22023' then null;
  end;
  select public.create_catalog_appointments(v_org,v_branch,v_customer,v_vehicle,v_future,v_future+interval '1 hour',null,'transactional appointment','workshop','customer_dropoff',null,null,array[v_service_version],2) into v_appointments;
  v_appointment:=v_appointments[1];
  if array_length(v_appointments,1)<>2 then raise exception 'Recurring appointment series was not created'; end if;
  if (select count(*) from public.appointment_service_items where appointment_id=any(v_appointments))<>2 then raise exception 'Catalog services were not snapshotted for every recurring appointment'; end if;
  if not exists(select 1 from public.appointment_service_items where appointment_id=v_appointment and template_version_id=v_service_version and planned_minutes=30 and jsonb_array_length(snapshot_json->'tasks')=1) then raise exception 'Appointment service snapshot is incomplete'; end if;
  select id into v_waitlist from public.create_waitlist_entry(v_branch,v_customer,v_vehicle,v_future+interval '20 days',v_future+interval '21 days',60,'workshop','customer_dropoff',3,'transactional waitlist');
  if v_waitlist is null then raise exception 'Waitlist entry was not created'; end if;
  select version into v_order_version from public.appointments where id=v_appointment;
  perform public.transition_appointment(v_appointment,v_order_version,'confirmed');
  select version into v_order_version from public.appointments where id=v_appointment;
  select id into v_checkin from public.complete_vehicle_checkin(v_appointment,v_order_version,1100,80,2,'["charging cable"]'::jsonb,'[]'::jsonb,true,true,true,'Transactional Customer','[{"zone":"front","condition":"clear"}]'::jsonb,'');
  if v_checkin is null or not exists(select 1 from public.appointments where id=v_appointment and status='checked_in') then raise exception 'Guided check-in did not complete'; end if;
  select id into v_intake_order from public.open_repair_order_from_checkin(v_appointment);
  if not exists(select 1 from public.repair_orders where id=v_intake_order and appointment_id=v_appointment and odometer_km=1100 and state_of_charge=80 and customer_concern like 'Booked services:%') then raise exception 'Checked-in appointment did not create a linked repair order from signed evidence'; end if;
  if not exists(select 1 from public.jobs where repair_order_id=v_intake_order and operation_code='TEST-CHECK' and description_snapshot='Transactional catalog check' and status='ready' and safety_class='ev_aware' and planned_minutes=30) then raise exception 'Catalog task was not instantiated as a ready workshop job'; end if;
  begin
    perform public.open_repair_order_from_checkin(v_appointment);
    raise exception 'A duplicate repair order was opened for one appointment';
  exception when sqlstate '23505' then null;
  end;

  -- Grouped estimate approvals, supplements, workshop narrative and rework.
  insert into public.repair_orders(organization_id,branch_id,ro_number,customer_id,vehicle_id,status,created_by) values(v_org,v_branch,'SVC-'||left(replace(v_key,'-',''),12),v_customer,v_vehicle,'diagnosis',v_admin) returning id into v_service_order;

  -- Structured high-voltage evidence and fail-closed safety gates.
  insert into public.branch_capabilities(organization_id,branch_id,capability_code,valid_from,status,evidence_path)
  values(v_org,v_branch,'HV_SERVICE',current_date,'active','rollback-only test')
  on conflict (branch_id,capability_code,valid_from) do update set status='active'
  ;
  insert into public.qualification_types(organization_id,code,name,scope_json)
  values(v_org,'TEST-HV','Transactional HV qualification','{"scope":"rollback-only"}'::jsonb)
  on conflict (organization_id,code) do update set name=excluded.name
  returning id into v_hv_type;
  insert into public.technician_profiles(organization_id,user_id,employee_no,labor_grade,active)
  values(v_org,v_admin,'TEST-HV-ADMIN','HV test technician',true)
  on conflict (organization_id,user_id) do update set active=true
  returning id into v_hv_technician;
  insert into public.technician_qualifications(organization_id,technician_id,qualification_type_id,issuer,certificate_reference,valid_from,valid_to,verified_at,verified_by)
  values(v_org,v_hv_technician,v_hv_type,'Transactional test','ROLLBACK',current_date,current_date+30,now(),v_admin)
  on conflict (technician_id,qualification_type_id,valid_from) do update set verified_at=excluded.verified_at, verified_by=excluded.verified_by
  ;
  select id into v_hv_job from public.create_job(v_service_order,'Transactional HV isolation','TEST-HV-ISO','hv_isolated','TEST-HV',60);
  select id into v_hv_permit from public.create_hv_work_permit(v_hv_job,'TEST-PROCEDURE','{"hazards":"stored energy","controls":"rollback-only"}'::jsonb,now()-interval '5 minutes',now()+interval '4 hours');
  perform public.record_hv_permit_evidence(v_hv_permit,'scope_review','pass',null,'',null,'',null,'','','[]'::jsonb,'Scope confirmed against test procedure');
  perform public.record_hv_permit_evidence(v_hv_permit,'emergency_plan','pass',null,'',null,'',null,'','','[]'::jsonb,'Emergency contacts and response path confirmed');
  perform public.transition_hv_work_permit(v_hv_permit,'risk_review');
  perform public.transition_hv_work_permit(v_hv_permit,'authorized');
  begin
    perform public.record_hv_permit_evidence(v_hv_permit,'vehicle_secured','pass',null,'',null,'',null,'','','[]'::jsonb,'');
    raise exception 'Vehicle-secured check unexpectedly passed without PPE evidence';
  exception when sqlstate '22023' then null;
  end;
  perform public.record_hv_permit_evidence(v_hv_permit,'vehicle_secured','pass',null,'',null,'',null,'','','["insulated_gloves","face_shield"]'::jsonb,'');
  perform public.record_hv_permit_evidence(v_hv_permit,'ignition_disabled','pass',null,'',null,'',null,'','','[]'::jsonb,'');
  perform public.record_hv_permit_evidence(v_hv_permit,'lockout_tagout','pass',null,'',null,'',null,'LOCK-TEST','KEY-TEST','[]'::jsonb,'');
  begin
    perform public.record_hv_permit_evidence(v_hv_permit,'absence_of_voltage','pass',null,'METER-TEST',0,'V',current_date+30,'','','[]'::jsonb,'');
    raise exception 'Absence-of-voltage check unexpectedly passed without an independent witness';
  exception when sqlstate '22023' then null;
  end;
  if not exists(select 1 from public.hv_permit_checks where permit_id=v_hv_permit and check_code='lockout_tagout' and lock_identifier='LOCK-TEST' and disconnect_key_reference='KEY-TEST') then
    raise exception 'Structured lockout evidence was not retained';
  end if;

  select id into v_estimate from public.create_estimate_from_repair_order(v_service_order);
  perform public.add_estimate_line(v_estimate,'labor','Transactional diagnosis',1,50,0,16,'Diagnosis',null);
  perform public.send_estimate(v_estimate,7);
  select id into v_estimate from public.record_estimate_group_decision(v_estimate,'Diagnosis','approved','Transactional Customer','portal','approved in rollback test');
  select id into v_supplement from public.create_supplementary_estimate(v_estimate,'Additional part found');
  if v_supplement is null then raise exception 'Supplementary estimate was not created'; end if;
  insert into public.jobs(organization_id,branch_id,repair_order_id,description_snapshot,status,safety_class,planned_minutes) values(v_org,v_branch,v_service_order,'Transactional workshop job','in_progress','ev_aware',60) returning id,version into v_job,v_job_version;
  insert into public.labor_entries(organization_id,branch_id,job_id,technician_id,started_at) select v_org,v_branch,v_job,tp.id,now()-interval '5 minutes' from public.technician_profiles tp where tp.organization_id=v_org limit 1;
  perform public.record_job_narrative(v_job,'Connector contamination','Cleaned and verified connector');
  select version into v_job_version from public.jobs where id=v_job;
  perform public.interrupt_job(v_job,v_job_version,'pause','Awaiting verification');
  select version into v_job_version from public.jobs where id=v_job;
  perform public.resume_job(v_job,v_job_version);
  update public.jobs set status='completed' where id=v_job;
  select id into v_rework from public.create_rework_job(v_job,'rework','Verification repeat');
  if v_rework is null then raise exception 'Rework job was not created'; end if;

  -- Catalog governance, immutable disposition and supplier three-way matching.
  select id into v_warehouse from public.warehouses where branch_id=v_branch and status='active' limit 1;
  if v_warehouse is null then
    insert into public.warehouses(organization_id,branch_id,code,name) values(v_org,v_branch,'TEST-WH','Transactional warehouse') returning id into v_warehouse;
    insert into public.bins(organization_id,branch_id,warehouse_id,code,bin_type) values(v_org,v_branch,v_warehouse,'STORAGE','storage');
  end if;
  select id into v_part from public.create_part(v_org,v_branch,'TEST-'||left(replace(v_key,'-',''),8),'Transactional part','ea','none',12);
  select id into v_related_part from public.create_part(v_org,v_branch,'ALT-'||left(replace(v_key,'-',''),8),'Transactional alternative','ea','none',10);
  perform public.configure_part_catalog(v_part,'UN3480','1234567890123','ean13',v_related_part,'alternative','approved rollback source');
  select id into v_bin from public.bins where branch_id=v_branch and bin_type='storage' and status='active' limit 1;
  perform public.post_stock_movement(v_org,v_branch,v_part,null,null,v_bin,5,4,'receipt','transactional',gen_random_uuid(),v_key||'-stock');
  select id into v_balance from public.stock_balances where part_id=v_part and bin_id=v_bin and lot_id is null;
  perform public.record_inventory_disposition(v_balance,1,'scrap','Damaged during rollback test','',v_key||'-scrap');
  if not exists(select 1 from public.inventory_dispositions where part_id=v_part and quantity=1) then raise exception 'Inventory disposition was not recorded'; end if;
  select id into v_supplier from public.create_supplier(v_org,'Transactional Supplier','','','');
  insert into public.purchase_orders(organization_id,branch_id,supplier_id,po_number,status,currency,subtotal,tax_total,grand_total,created_by) values(v_org,v_branch,v_supplier,'PO-'||left(replace(v_key,'-',''),10),'received','JOD',20,0,20,v_admin) returning id into v_po;
  insert into public.purchase_order_lines(organization_id,branch_id,purchase_order_id,line_no,part_id,ordered_quantity,received_quantity,unit_cost,tax_rate) values(v_org,v_branch,v_po,1,v_part,5,5,4,0) returning id into v_po_line;
  insert into public.goods_receipts(organization_id,branch_id,purchase_order_id,receipt_number,status,received_by) values(v_org,v_branch,v_po,'GR-'||left(replace(v_key,'-',''),10),'posted',v_admin) returning id into v_receipt;
  insert into public.goods_receipt_lines(organization_id,branch_id,goods_receipt_id,purchase_order_line_id,destination_bin_id,quantity,unit_cost) values(v_org,v_branch,v_receipt,v_po_line,v_bin,5,4) returning id into v_receipt_line;
  select id into v_supplier_invoice from public.record_supplier_invoice(v_po,'SI-'||left(replace(v_key,'-',''),10),current_date,2,jsonb_build_array(jsonb_build_object('purchase_order_line_id',v_po_line,'quantity',5,'unit_cost',4)),'matched rollback invoice');
  if not exists(select 1 from public.supplier_invoices where id=v_supplier_invoice and match_status='matched') then raise exception 'Supplier invoice did not three-way match'; end if;

  -- Customer portal self-service and secured document rendering.
  perform public.provision_customer_portal(v_customer,v_admin);
  perform public.portal_update_consent('appointment_reminders','sms','granted');
  perform public.portal_request_appointment(v_branch,v_vehicle,v_future+interval '30 days',v_future+interval '31 days',60,'workshop','wait_on_site','portal rollback request');
  insert into public.invoices(organization_id,branch_id,repair_order_id,customer_id,invoice_number,status,currency,subtotal,tax_total,grand_total,paid_total,seller_snapshot,buyer_snapshot,posted_at,document_hash,created_by) values(v_org,v_branch,v_service_order,v_customer,'INV-'||left(replace(v_key,'-',''),10),'posted','JOD',10,0,10,0,'{}','{}',now(),repeat('c',64),v_admin) returning id into v_customer_invoice;
  perform public.portal_request_payment_link(v_customer_invoice);
  if (public.portal_document('invoice',v_customer_invoice)->>'number') is null then raise exception 'Portal document rendering failed'; end if;

  raise notice 'IDstore transactional workflow tests passed';
end;
$$;

rollback;
