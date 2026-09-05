-- Cover tenant and branch foreign keys used by appointment service policy checks.

create index appointment_service_items_branch
  on public.appointment_service_items(branch_id, appointment_id);
create index appointment_service_items_organization
  on public.appointment_service_items(organization_id, appointment_id);
