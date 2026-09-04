-- Focused indexes for high-frequency workshop, CRM, inventory and billing paths.
-- Low-selectivity or rarely deleted configuration foreign keys are intentionally
-- left for query-plan-driven tuning after production traffic is available.

create index memberships_user_active
  on public.memberships(user_id, status, organization_id);
create index membership_branches_branch
  on public.membership_branches(branch_id, membership_id);

create index customers_org_status
  on public.customers(organization_id, status, updated_at desc);
create index customer_accounts_auth_user
  on public.customer_accounts(auth_user_id, status);
create index vehicles_model
  on public.vehicles(model_id) where model_id is not null;
create index vehicle_ownerships_customer_active
  on public.vehicle_ownerships(customer_id, vehicle_id) where valid_to is null;
create index odometer_readings_vehicle_time
  on public.odometer_readings(vehicle_id, recorded_at desc);

create index resource_bookings_resource_time
  on public.resource_bookings(resource_id, starts_at, ends_at)
  where status = 'active';
create index resource_bookings_appointment
  on public.resource_bookings(appointment_id) where appointment_id is not null;

create index repair_orders_customer_history
  on public.repair_orders(customer_id, opened_at desc);
create index repair_orders_vehicle_history
  on public.repair_orders(vehicle_id, opened_at desc);
create index repair_orders_appointment
  on public.repair_orders(appointment_id) where appointment_id is not null;
create index repair_order_events_timeline
  on public.repair_order_events(repair_order_id, occurred_at);
create index inspections_repair_order
  on public.inspections(repair_order_id, created_at desc);
create index estimate_approvals_version
  on public.estimate_approvals(estimate_version_id, decided_at desc);
create index jobs_repair_order_status
  on public.jobs(repair_order_id, status);
create index job_assignments_technician_active
  on public.job_assignments(technician_id, assigned_at)
  where unassigned_at is null;
create index labor_entries_job_time
  on public.labor_entries(job_id, started_at desc);
create index hv_work_permits_repair_order
  on public.hv_work_permits(repair_order_id, created_at desc);
create index battery_health_vehicle_time
  on public.battery_health_reports(vehicle_id, measured_at desc);
create index diagnostic_sessions_repair_order
  on public.diagnostic_sessions(repair_order_id, started_at desc);
create index diagnostic_trouble_codes_session
  on public.diagnostic_trouble_codes(session_id);

create index stock_balances_branch_part
  on public.stock_balances(branch_id, part_id);
create index stock_reservations_job_status
  on public.stock_reservations(job_id, status);
create index stock_reservations_part_status
  on public.stock_reservations(part_id, status);
create index purchase_orders_supplier_status
  on public.purchase_orders(supplier_id, status, ordered_at desc);
create index goods_receipts_purchase_order
  on public.goods_receipts(purchase_order_id, received_at desc);
create index stock_transfers_source_status
  on public.stock_transfers(source_branch_id, status, created_at desc);
create index stock_transfers_destination_status
  on public.stock_transfers(destination_branch_id, status, created_at desc);
create index stock_movements_from_bin
  on public.stock_movements(from_bin_id, posted_at desc) where from_bin_id is not null;
create index stock_movements_to_bin
  on public.stock_movements(to_bin_id, posted_at desc) where to_bin_id is not null;

create index invoices_repair_order
  on public.invoices(repair_order_id) where repair_order_id is not null;
create index invoices_customer_history
  on public.invoices(customer_id, posted_at desc);
create index invoices_branch_status
  on public.invoices(branch_id, status, posted_at desc);
create index payment_allocations_invoice
  on public.payment_allocations(invoice_id, created_at);
create index credit_notes_invoice
  on public.credit_notes(invoice_id, created_at desc);

create index messages_customer_time
  on public.messages(customer_id, created_at desc);
create index messages_delivery_queue
  on public.messages(organization_id, status, created_at)
  where status in ('queued', 'sending');
create index e_invoice_submissions_state
  on integration.e_invoice_submissions(state, next_attempt_at, created_at)
  where state in ('queued', 'retry_wait');
create index audit_events_actor_time
  on audit.events(actor_id, occurred_at desc) where actor_id is not null;
