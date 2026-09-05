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

  raise notice 'IDstore transactional workflow tests passed';
end;
$$;

rollback;
