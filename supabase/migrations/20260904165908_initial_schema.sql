-- IDstore initial database schema.
-- Multi-branch Volkswagen ID EV service-center platform.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app_private;
create schema if not exists audit;
create schema if not exists integration;

revoke all on schema app_private from public, anon;
revoke all on schema audit from public, anon, authenticated;
revoke all on schema integration from public, anon, authenticated;

create type public.app_role as enum ('admin', 'staff');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  tax_number text,
  base_currency char(3) not null default 'JOD',
  default_locale text not null default 'ar-JO',
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  legal_name text not null,
  display_name text not null,
  country_code char(2) not null default 'JO',
  admin_area text,
  city text not null,
  address_json jsonb not null default '{}'::jsonb,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text not null default 'Asia/Amman',
  currency char(3) not null default 'JOD',
  tax_registration text,
  phone text,
  email extensions.citext,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create table public.branch_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  capability_code text not null,
  valid_from date not null default current_date,
  valid_to date,
  status text not null default 'active' check (status in ('active', 'suspended', 'expired')),
  evidence_path text,
  created_at timestamptz not null default now(),
  unique (branch_id, capability_code, valid_from),
  check (valid_to is null or valid_to >= valid_from)
);

create table public.branch_service_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  area_name text not null,
  radius_km numeric(8,2),
  pickup_enabled boolean not null default false,
  mobile_service_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (branch_id, area_name),
  check (radius_km is null or radius_km > 0)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  locale text not null default 'ar-JO',
  phone text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  all_branches boolean not null default false,
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check (role = 'admin' or not all_branches)
);

create table public.membership_branches (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (membership_id, branch_id)
);

create table public.permissions (
  code text primary key,
  description text not null
);

create table public.membership_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete restrict,
  allowed boolean not null default true,
  limits_json jsonb not null default '{}'::jsonb,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (membership_id, permission_code)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  bucket text not null,
  object_path text not null,
  sha256 text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  classification text not null default 'confidential' check (classification in ('internal', 'confidential', 'restricted')),
  linked_type text not null,
  linked_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, object_path),
  unique (organization_id, sha256, linked_type, linked_id)
);

create table public.qualification_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  scope_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.technician_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  employee_no text,
  labor_grade text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, employee_no)
);

create table public.technician_qualifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  technician_id uuid not null references public.technician_profiles(id) on delete cascade,
  qualification_type_id uuid not null references public.qualification_types(id) on delete restrict,
  issuer text not null,
  certificate_reference text,
  valid_from date not null,
  valid_to date,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  evidence_attachment_id uuid references public.attachments(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (technician_id, qualification_type_id, valid_from),
  check (valid_to is null or valid_to >= valid_from)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_type text not null default 'individual' check (customer_type in ('individual', 'company')),
  display_name text not null,
  legal_name text,
  tax_number text,
  preferred_locale text not null default 'ar-JO',
  preferred_branch_id uuid references public.branches(id) on delete set null,
  notes text,
  status text not null default 'active' check (status in ('active', 'restricted', 'archived', 'anonymized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null check (kind in ('mobile', 'phone', 'email', 'whatsapp')),
  value text not null,
  normalized_value text not null,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index customer_contacts_one_primary
  on public.customer_contacts(customer_id, kind) where is_primary;
create index customer_contacts_lookup
  on public.customer_contacts(organization_id, normalized_value);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  address_type text not null default 'billing' check (address_type in ('billing', 'service', 'home', 'work')),
  country_code char(2) not null default 'JO',
  admin_area text,
  city text not null,
  address_line1 text not null,
  address_line2 text,
  postal_code text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  purpose text not null,
  channel text not null,
  state text not null check (state in ('granted', 'withdrawn')),
  policy_version text not null,
  source text not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null
);

create table public.customer_accounts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('pending', 'active', 'revoked')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (organization_id, customer_id, auth_user_id),
  unique (organization_id, auth_user_id)
);

create table public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  make text not null default 'Volkswagen',
  model_code text not null,
  name text not null,
  platform text,
  market text,
  valid_year_from smallint,
  valid_year_to smallint,
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, make, model_code, market)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  vin text,
  registration_no text,
  registration_country char(2) default 'JO',
  model_id uuid references public.vehicle_models(id) on delete set null,
  model_year smallint,
  trim text,
  battery_kwh numeric(6,2),
  battery_code text,
  software_version text,
  status text not null default 'active' check (status in ('active', 'restricted', 'quarantine', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  check (battery_kwh is null or battery_kwh > 0)
);

create unique index vehicles_org_vin_unique
  on public.vehicles(organization_id, vin) where vin is not null;
create index vehicles_registration_lookup
  on public.vehicles(organization_id, registration_no) where registration_no is not null;

create table public.vehicle_ownerships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  relationship text not null default 'owner' check (relationship in ('owner', 'driver', 'fleet_manager', 'authorized_contact')),
  valid_from date not null default current_date,
  valid_to date,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create index vehicle_ownerships_active
  on public.vehicle_ownerships(organization_id, vehicle_id, customer_id) where valid_to is null;

create table public.odometer_readings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  reading_km integer not null check (reading_km >= 0),
  source text not null,
  correction_reason text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null
);

create table public.tax_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  jurisdiction text not null,
  rate numeric(7,4) not null check (rate >= 0 and rate <= 100),
  external_code text,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (organization_id, code, effective_from),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.labor_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  description_ar text,
  description_en text not null,
  standard_minutes integer not null default 0 check (standard_minutes >= 0),
  default_price numeric(18,3) not null default 0 check (default_price >= 0),
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.service_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name_ar text,
  name_en text not null,
  market text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, code, market)
);

create table public.service_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_id uuid not null references public.service_templates(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  effective_from date not null,
  effective_to date,
  interval_months integer,
  interval_km integer,
  applicability_json jsonb not null default '{}'::jsonb,
  source_uri text,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  created_at timestamptz not null default now(),
  unique (template_id, version_no),
  check (effective_to is null or effective_to >= effective_from),
  check (interval_months is null or interval_months > 0),
  check (interval_km is null or interval_km > 0)
);

create table public.service_template_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  version_id uuid not null references public.service_template_versions(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  task_code text not null,
  description_ar text,
  description_en text not null,
  required_permission text,
  required_qualification_code text,
  standard_minutes integer not null default 0 check (standard_minutes >= 0),
  procedure_ref text,
  result_schema jsonb not null default '{}'::jsonb,
  unique (version_id, sequence)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  resource_type text not null check (resource_type in ('bay', 'lift', 'charger', 'diagnostic_device', 'loan_vehicle', 'other')),
  code text not null,
  name text not null,
  capabilities jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, code)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  promised_at timestamptz,
  channel text not null default 'staff',
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  check (end_at > start_at)
);

create index appointments_branch_schedule
  on public.appointments(branch_id, start_at, status);

create table public.resource_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  ro_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'checked_in', 'diagnosis', 'awaiting_approval', 'approved', 'in_progress', 'qc', 'ready', 'delivered', 'closed', 'cancelled', 'on_hold')),
  risk_state text not null default 'normal' check (risk_state in ('normal', 'restricted', 'quarantine', 'emergency_escalation')),
  odometer_km integer check (odometer_km >= 0),
  state_of_charge numeric(5,2) check (state_of_charge between 0 and 100),
  customer_concern text,
  opened_at timestamptz not null default now(),
  promised_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  unique (branch_id, ro_number)
);

create index repair_orders_wip
  on public.repair_orders(branch_id, status, promised_at);

create table public.repair_order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_order_id uuid not null references public.repair_orders(id) on delete restrict,
  from_status text,
  to_status text not null,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_order_id uuid not null references public.repair_orders(id) on delete restrict,
  template_version_id uuid references public.service_template_versions(id) on delete set null,
  technician_id uuid references public.technician_profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  template_task_id uuid references public.service_template_tasks(id) on delete set null,
  sequence integer not null,
  result text check (result in ('pass', 'warn', 'fail', 'not_applicable')),
  measurement_json jsonb not null default '{}'::jsonb,
  finding_text text,
  customer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inspection_id, sequence)
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  inspection_item_id uuid not null references public.inspection_items(id) on delete restrict,
  severity text not null check (severity in ('green', 'amber', 'red', 'safety_stop')),
  status text not null default 'open' check (status in ('open', 'estimated', 'approved', 'declined', 'resolved', 'deferred')),
  recommended_operation_id uuid references public.labor_operations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.estimate_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_order_id uuid not null references public.repair_orders(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_approved', 'approved', 'declined', 'expired', 'superseded')),
  currency char(3) not null,
  subtotal numeric(18,3) not null default 0,
  discount_total numeric(18,3) not null default 0,
  tax_total numeric(18,3) not null default 0,
  grand_total numeric(18,3) not null default 0,
  document_hash text,
  expires_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repair_order_id, version_no),
  check (subtotal >= 0 and discount_total >= 0 and tax_total >= 0 and grand_total >= 0)
);

create table public.estimate_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  estimate_version_id uuid not null references public.estimate_versions(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  line_type text not null check (line_type in ('labor', 'part', 'fee', 'discount', 'warranty', 'goodwill', 'text')),
  source_id uuid,
  description_snapshot text not null,
  quantity numeric(18,3) not null default 1,
  unit_price numeric(18,3) not null default 0,
  discount_amount numeric(18,3) not null default 0,
  tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(18,3) not null default 0,
  line_total numeric(18,3) not null default 0,
  approval_group text,
  created_at timestamptz not null default now(),
  unique (estimate_version_id, line_no),
  check (quantity >= 0 and unit_price >= 0 and discount_amount >= 0 and tax_rate >= 0 and tax_amount >= 0)
);

create table public.estimate_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  estimate_version_id uuid not null references public.estimate_versions(id) on delete restrict,
  estimate_line_id uuid references public.estimate_lines(id) on delete restrict,
  decision text not null check (decision in ('approved', 'declined')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  channel text not null,
  evidence_json jsonb not null default '{}'::jsonb,
  decided_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_order_id uuid not null references public.repair_orders(id) on delete restrict,
  estimate_line_id uuid references public.estimate_lines(id) on delete set null,
  operation_code text,
  description_snapshot text not null,
  status text not null default 'planned' check (status in ('planned', 'ready', 'assigned', 'in_progress', 'paused', 'blocked', 'qc', 'completed', 'cancelled')),
  safety_class text not null default 'normal' check (safety_class in ('normal', 'ev_aware', 'hv_isolated', 'hv_battery_open')),
  required_qualification_code text,
  planned_minutes integer not null default 0 check (planned_minutes >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete cascade,
  technician_id uuid not null references public.technician_profiles(id) on delete restrict,
  assignment_kind text not null default 'primary' check (assignment_kind in ('primary', 'assistant', 'quality_control', 'safety_witness')),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz
);

create table public.labor_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  technician_id uuid not null references public.technician_profiles(id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz,
  pause_reason text,
  source text not null default 'timer',
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);

create unique index labor_entries_one_active
  on public.labor_entries(technician_id) where ended_at is null;

create table public.hv_work_permits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_order_id uuid not null references public.repair_orders(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  procedure_ref text not null,
  state text not null default 'draft' check (state in ('draft', 'risk_review', 'authorized', 'isolated', 'work_active', 'reenergization_check', 'closed', 'revoked')),
  risk_json jsonb not null default '{}'::jsonb,
  authorized_by uuid references auth.users(id) on delete set null,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id),
  check (valid_to is null or valid_from is null or valid_to > valid_from)
);

create table public.hv_permit_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  permit_id uuid not null references public.hv_work_permits(id) on delete restrict,
  check_code text not null,
  result text not null check (result in ('pass', 'fail', 'not_applicable')),
  actor_id uuid references auth.users(id) on delete set null,
  witness_id uuid references auth.users(id) on delete set null,
  tool_ref text,
  occurred_at timestamptz not null default now()
);

create table public.battery_health_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  repair_order_id uuid references public.repair_orders(id) on delete set null,
  measured_at timestamptz not null,
  soh_percent numeric(5,2) check (soh_percent between 0 and 100),
  usable_kwh numeric(8,3) check (usable_kwh >= 0),
  method text not null,
  tool text,
  conditions_json jsonb not null default '{}'::jsonb,
  attachment_id uuid references public.attachments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_order_id uuid not null references public.repair_orders(id) on delete restrict,
  technician_id uuid references public.technician_profiles(id) on delete set null,
  tool text not null,
  tool_version text,
  interface_serial text,
  external_ref text,
  started_at timestamptz not null,
  ended_at timestamptz,
  attachment_id uuid references public.attachments(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);

create table public.diagnostic_trouble_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  session_id uuid not null references public.diagnostic_sessions(id) on delete cascade,
  control_unit text not null,
  code text not null,
  description_snapshot text,
  before_status text,
  after_status text,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  tax_number text,
  phone text,
  email extensions.citext,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  part_number text not null,
  description_ar text,
  description_en text not null,
  unit text not null default 'ea',
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  tracking text not null default 'none' check (tracking in ('none', 'lot', 'serial')),
  hazardous_classification text,
  sale_price numeric(18,3) not null default 0 check (sale_price >= 0),
  status text not null default 'active' check (status in ('active', 'superseded', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, part_number)
);

create table public.part_supersessions (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  old_part_id uuid not null references public.parts(id) on delete restrict,
  new_part_id uuid not null references public.parts(id) on delete restrict,
  effective_at date not null,
  source text,
  primary key (old_part_id, new_part_id),
  check (old_part_id <> new_part_id)
);

create table public.supplier_parts (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete cascade,
  supplier_sku text,
  lead_days integer check (lead_days is null or lead_days >= 0),
  last_cost numeric(18,3) check (last_cost is null or last_cost >= 0),
  currency char(3),
  primary key (supplier_id, part_id)
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  code text not null,
  name text not null,
  valuation_method text not null default 'moving_average' check (valuation_method = 'moving_average'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (branch_id, code)
);

create table public.bins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  code text not null,
  bin_type text not null default 'storage' check (bin_type in ('storage', 'receiving', 'quarantine', 'returns', 'scrap', 'in_transit')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (warehouse_id, code)
);

create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  part_id uuid not null references public.parts(id) on delete restrict,
  supplier_lot text,
  serial_no text,
  expiry_date date,
  unit_cost numeric(18,3) not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, part_id, supplier_lot, serial_no)
);

create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  part_id uuid not null references public.parts(id) on delete restrict,
  bin_id uuid not null references public.bins(id) on delete restrict,
  lot_id uuid references public.stock_lots(id) on delete restrict,
  on_hand numeric(18,3) not null default 0 check (on_hand >= 0),
  reserved numeric(18,3) not null default 0 check (reserved >= 0 and reserved <= on_hand),
  average_cost numeric(18,3) not null default 0 check (average_cost >= 0),
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (part_id, bin_id, lot_id)
);

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  part_id uuid not null references public.parts(id) on delete restrict,
  bin_id uuid not null references public.bins(id) on delete restrict,
  lot_id uuid references public.stock_lots(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  quantity numeric(18,3) not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'issued', 'released', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  po_number text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'confirmed', 'partially_received', 'received', 'closed', 'cancelled')),
  currency char(3) not null,
  subtotal numeric(18,3) not null default 0,
  tax_total numeric(18,3) not null default 0,
  grand_total numeric(18,3) not null default 0,
  ordered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, po_number)
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  line_no integer not null,
  part_id uuid not null references public.parts(id) on delete restrict,
  ordered_quantity numeric(18,3) not null check (ordered_quantity > 0),
  received_quantity numeric(18,3) not null default 0 check (received_quantity >= 0),
  unit_cost numeric(18,3) not null check (unit_cost >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0),
  unique (purchase_order_id, line_no)
);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  receipt_number text not null,
  supplier_document_no text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed')),
  received_at timestamptz not null default now(),
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (branch_id, receipt_number)
);

create table public.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  goods_receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete restrict,
  destination_bin_id uuid not null references public.bins(id) on delete restrict,
  lot_id uuid references public.stock_lots(id) on delete restrict,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_cost numeric(18,3) not null check (unit_cost >= 0)
);

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_branch_id uuid not null references public.branches(id) on delete restrict,
  destination_branch_id uuid not null references public.branches(id) on delete restrict,
  transfer_number text not null,
  status text not null default 'draft' check (status in ('draft', 'requested', 'approved', 'dispatched', 'partially_received', 'received', 'cancelled')),
  dispatched_at timestamptz,
  received_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, transfer_number),
  check (source_branch_id <> destination_branch_id)
);

create table public.stock_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete restrict,
  lot_id uuid references public.stock_lots(id) on delete restrict,
  source_bin_id uuid references public.bins(id) on delete restrict,
  destination_bin_id uuid references public.bins(id) on delete restrict,
  requested_quantity numeric(18,3) not null check (requested_quantity > 0),
  shipped_quantity numeric(18,3) not null default 0 check (shipped_quantity >= 0),
  received_quantity numeric(18,3) not null default 0 check (received_quantity >= 0),
  discrepancy_reason text
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  part_id uuid not null references public.parts(id) on delete restrict,
  lot_id uuid references public.stock_lots(id) on delete restrict,
  from_bin_id uuid references public.bins(id) on delete restrict,
  to_bin_id uuid references public.bins(id) on delete restrict,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_cost numeric(18,3) not null check (unit_cost >= 0),
  movement_type text not null check (movement_type in ('receipt', 'issue', 'return', 'transfer_out', 'transfer_in', 'adjustment_gain', 'adjustment_loss', 'supplier_return', 'scrap')),
  source_type text not null,
  source_id uuid not null,
  idempotency_key text not null,
  reversal_of uuid references public.stock_movements(id) on delete restrict,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  check (from_bin_id is not null or to_bin_id is not null),
  check (from_bin_id is null or to_bin_id is null or from_bin_id <> to_bin_id)
);

create index stock_movements_part_history
  on public.stock_movements(organization_id, part_id, posted_at desc);

create table public.job_parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  part_id uuid not null references public.parts(id) on delete restrict,
  requested_quantity numeric(18,3) not null default 0 check (requested_quantity >= 0),
  issued_quantity numeric(18,3) not null default 0 check (issued_quantity >= 0),
  returned_quantity numeric(18,3) not null default 0 check (returned_quantity >= 0 and returned_quantity <= issued_quantity),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, part_id)
);

create table public.invoice_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  document_type text not null check (document_type in ('invoice', 'credit_note', 'receipt', 'repair_order', 'purchase_order', 'stock_transfer')),
  fiscal_period text not null,
  prefix text not null default '',
  next_number bigint not null default 1 check (next_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, document_type, fiscal_period)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_order_id uuid references public.repair_orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_series_id uuid references public.invoice_series(id) on delete restrict,
  invoice_number text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'partially_paid', 'paid', 'credited')),
  currency char(3) not null,
  seller_snapshot jsonb not null default '{}'::jsonb,
  buyer_snapshot jsonb not null default '{}'::jsonb,
  subtotal numeric(18,3) not null default 0,
  discount_total numeric(18,3) not null default 0,
  tax_total numeric(18,3) not null default 0,
  grand_total numeric(18,3) not null default 0,
  paid_total numeric(18,3) not null default 0,
  document_hash text,
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  unique (branch_id, invoice_number),
  check (subtotal >= 0 and discount_total >= 0 and tax_total >= 0 and grand_total >= 0 and paid_total >= 0 and paid_total <= grand_total),
  check ((status = 'draft' and posted_at is null) or (status <> 'draft' and posted_at is not null))
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  line_no integer not null check (line_no > 0),
  line_type text not null check (line_type in ('labor', 'part', 'fee', 'discount', 'warranty', 'goodwill', 'text')),
  source_type text,
  source_id uuid,
  description_snapshot text not null,
  quantity numeric(18,3) not null,
  unit_price numeric(18,3) not null,
  discount_amount numeric(18,3) not null default 0,
  tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(18,3) not null default 0,
  line_total numeric(18,3) not null,
  created_at timestamptz not null default now(),
  unique (invoice_id, line_no)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  receipt_number text not null,
  method text not null check (method in ('cash', 'card', 'bank_transfer', 'payment_link', 'fleet_account', 'other')),
  amount numeric(18,3) not null check (amount > 0),
  currency char(3) not null,
  provider_ref text,
  status text not null default 'received' check (status in ('pending', 'received', 'failed', 'refunded', 'partially_refunded')),
  received_at timestamptz not null default now(),
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (branch_id, receipt_number),
  unique nulls not distinct (organization_id, method, provider_ref)
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(18,3) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  credit_number text not null,
  reason text not null,
  subtotal numeric(18,3) not null default 0,
  tax_total numeric(18,3) not null default 0,
  grand_total numeric(18,3) not null default 0,
  document_hash text,
  posted_at timestamptz not null default now(),
  posted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (branch_id, credit_number)
);

create table public.credit_note_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  credit_note_id uuid not null references public.credit_notes(id) on delete restrict,
  invoice_line_id uuid not null references public.invoice_lines(id) on delete restrict,
  quantity numeric(18,3) not null check (quantity > 0),
  tax_amount numeric(18,3) not null default 0,
  line_total numeric(18,3) not null,
  created_at timestamptz not null default now()
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  register_code text not null,
  opening_float numeric(18,3) not null default 0,
  expected_close numeric(18,3),
  counted_close numeric(18,3),
  variance numeric(18,3),
  status text not null default 'open' check (status in ('open', 'closed', 'approved')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index cash_sessions_one_open
  on public.cash_sessions(branch_id, staff_user_id, register_code) where status = 'open';

create table public.vehicle_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  finding_id uuid references public.findings(id) on delete set null,
  description text not null,
  severity text not null check (severity in ('amber', 'red', 'safety_stop')),
  status text not null default 'open' check (status in ('open', 'scheduled', 'completed', 'dismissed')),
  due_date date,
  due_odometer_km integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table integration.connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'error')),
  secret_ref text,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table integration.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (organization_id, idempotency_key)
);

create index outbox_events_pending
  on integration.outbox_events(created_at) where published_at is null;

create table integration.e_invoice_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  provider text not null,
  schema_version text not null,
  payload_hash text not null,
  attempt integer not null default 1 check (attempt > 0),
  state text not null default 'queued' check (state in ('queued', 'validating', 'submitted', 'accepted', 'rejected', 'retry_wait', 'failed')),
  external_id text,
  response_code text,
  response_summary text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, provider, payload_hash, attempt)
);

create table integration.webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  provider text not null,
  external_event_id text not null,
  signature_valid boolean not null,
  payload_path text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_event_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  template_code text not null,
  template_version integer not null,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'push')),
  dedupe_key text not null,
  provider_ref text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed', 'suppressed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);

create table audit.events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_hash text,
  after_hash text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_events_org_time
  on audit.events(organization_id, occurred_at desc);

-- Authorization helpers live outside exposed schemas. They validate the authenticated
-- user and are the only security-definer functions callable by authenticated clients.
create or replace function app_private.is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function app_private.is_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
      and m.status = 'active'
  );
$$;

create or replace function app_private.has_branch_access(p_organization_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        (m.role = 'admin' and m.all_branches)
        or exists (
          select 1 from public.membership_branches mb
          where mb.membership_id = m.id and mb.branch_id = p_branch_id
        )
      )
  );
$$;

create or replace function app_private.has_permission(
  p_organization_id uuid,
  p_branch_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role = 'admin'
        or exists (
          select 1
          from public.membership_permissions mp
          where mp.membership_id = m.id
            and mp.permission_code = p_permission_code
            and mp.allowed
        )
      )
      and (
        p_branch_id is null
        or (m.role = 'admin' and m.all_branches)
        or exists (
          select 1 from public.membership_branches mb
          where mb.membership_id = m.id and mb.branch_id = p_branch_id
        )
      )
  );
$$;

revoke all on all functions in schema app_private from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_member(uuid) to authenticated;
grant execute on function app_private.is_admin(uuid) to authenticated;
grant execute on function app_private.has_branch_access(uuid, uuid) to authenticated;
grant execute on function app_private.has_permission(uuid, uuid, text) to authenticated;

-- Automatic updated_at and optimistic version maintenance.
create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'version' then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select table_schema, table_name
    from information_schema.columns
    where table_schema in ('public', 'integration')
      and column_name = 'updated_at'
  loop
    execute format(
      'create trigger %I before update on %I.%I for each row execute function app_private.touch_updated_at()',
      'touch_' || r.table_name || '_updated_at', r.table_schema, r.table_name
    );
  end loop;
end;
$$;

-- Audit immutable/commercial/safety changes by hash without duplicating sensitive rows.
create or replace function audit.log_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_org uuid;
  v_id uuid;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_org := coalesce((v_new->>'organization_id')::uuid, (v_old->>'organization_id')::uuid);
  v_id := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);

  insert into audit.events (
    organization_id, actor_id, action, entity_type, entity_id, before_hash, after_hash
  ) values (
    v_org,
    (select auth.uid()),
    lower(tg_op),
    tg_table_schema || '.' || tg_table_name,
    v_id,
    case when v_old is null then null else encode(extensions.digest(convert_to(v_old::text, 'UTF8'), 'sha256'), 'hex') end,
    case when v_new is null then null else encode(extensions.digest(convert_to(v_new::text, 'UTF8'), 'sha256'), 'hex') end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function audit.log_row_change() from public, anon, authenticated;

create trigger audit_invoices
after insert or update or delete on public.invoices
for each row execute function audit.log_row_change();
create trigger audit_payments
after insert or update or delete on public.payments
for each row execute function audit.log_row_change();
create trigger audit_stock_movements
after insert or update or delete on public.stock_movements
for each row execute function audit.log_row_change();
create trigger audit_hv_work_permits
after insert or update or delete on public.hv_work_permits
for each row execute function audit.log_row_change();
create trigger audit_memberships
after insert or update or delete on public.memberships
for each row execute function audit.log_row_change();

-- Prevent mutation of posted financial and stock records.
create or replace function app_private.prevent_posted_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'posted records are immutable; create a reversal or credit note';
end;
$$;

create trigger stock_movements_immutable
before update or delete on public.stock_movements
for each row execute function app_private.prevent_posted_mutation();

create or replace function app_private.prevent_posted_invoice_line_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.invoices i
    where i.id = old.invoice_id and i.status <> 'draft'
  ) then
    raise exception 'posted invoice lines are immutable; create a credit note';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function app_private.prevent_posted_invoice_line_mutation() from public, anon, authenticated;

create trigger invoice_lines_immutable
before update or delete on public.invoice_lines
for each row execute function app_private.prevent_posted_invoice_line_mutation();

-- RLS is enabled for every exposed table. Read policies distinguish organization-wide
-- catalogs from branch-operational rows. Writes are intentionally RPC/server-only for v1.
do $$
declare
  r record;
  v_using text;
begin
  for r in
    select t.table_name,
      exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'organization_id'
      ) as has_org,
      exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'branch_id'
      ) as has_branch
    from information_schema.tables t
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', r.table_name);

    if r.table_name = 'organizations' then
      v_using := 'app_private.is_member(id)';
    elsif r.table_name = 'branches' then
      v_using := 'app_private.has_branch_access(organization_id, id)';
    elsif r.table_name = 'profiles' then
      v_using := 'user_id = (select auth.uid())';
    elsif r.table_name = 'permissions' then
      v_using := 'true';
    elsif r.has_org and r.has_branch then
      v_using := 'app_private.has_branch_access(organization_id, branch_id)';
    elsif r.has_org then
      v_using := 'organization_id is null or app_private.is_member(organization_id)';
    else
      continue;
    end if;

    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      'read_' || r.table_name, r.table_name, v_using
    );
  end loop;
end;
$$;

-- Users may maintain only their own non-authorization profile fields.
create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (user_id = (select auth.uid()));

create policy profiles_update_self
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert (user_id, display_name, locale, phone, status) on public.profiles to authenticated;
grant update (display_name, locale, phone) on public.profiles to authenticated;

-- Static permission catalog. Admin implicitly has every capability.
insert into public.permissions (code, description) values
  ('branch.manage', 'Manage branches, resources and opening configuration'),
  ('staff.manage', 'Invite Staff and assign branch/capability access'),
  ('crm.manage', 'Create and update customers, contacts and vehicles'),
  ('appointments.manage', 'Create and manage appointments'),
  ('repair_order.manage', 'Create and progress repair orders'),
  ('inspection.perform', 'Perform and complete inspections'),
  ('estimate.manage', 'Create and send estimates'),
  ('estimate.override_price', 'Override estimate pricing within assigned limits'),
  ('workshop.dispatch', 'Assign and dispatch workshop jobs'),
  ('job.perform', 'Record work, time, diagnostics and parts requests'),
  ('hv_permit.authorize', 'Authorize high-voltage work permits when qualified'),
  ('inventory.manage', 'Manage parts, stock and counts'),
  ('purchasing.manage', 'Manage suppliers, purchase orders and receipts'),
  ('invoice.post', 'Post invoices and credit notes'),
  ('payment.receive', 'Receive and allocate payments'),
  ('payment.refund', 'Refund payments within assigned limits'),
  ('report.operations.read', 'Read operational reports'),
  ('report.finance.read', 'Read financial reports'),
  ('integration.manage', 'Configure external integrations'),
  ('audit.read', 'Read audit history')
on conflict (code) do update set description = excluded.description;

-- Global VW ID model catalog. Organizations can add market-specific variants later.
insert into public.vehicle_models (organization_id, make, model_code, name, platform, market) values
  (null, 'Volkswagen', 'ID3', 'ID.3', 'MEB', null),
  (null, 'Volkswagen', 'ID4', 'ID.4', 'MEB', null),
  (null, 'Volkswagen', 'ID5', 'ID.5', 'MEB', null),
  (null, 'Volkswagen', 'ID6', 'ID.6', 'MEB', 'CN'),
  (null, 'Volkswagen', 'ID7', 'ID.7', 'MEB', null),
  (null, 'Volkswagen', 'IDBUZZ', 'ID. Buzz', 'MEB', null)
on conflict do nothing;

-- Private storage buckets. Application uploads create immutable object paths.
insert into storage.buckets (id, name, public, file_size_limit) values
  ('vehicle-media', 'vehicle-media', false, 52428800),
  ('diagnostics', 'diagnostics', false, 52428800),
  ('documents', 'documents', false, 52428800),
  ('qualification-evidence', 'qualification-evidence', false, 20971520),
  ('integration-payloads', 'integration-payloads', false, 52428800)
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit;

create policy storage_read_member
on storage.objects for select to authenticated
using (
  bucket_id in ('vehicle-media', 'diagnostics', 'documents')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and app_private.is_member(((storage.foldername(name))[1])::uuid)
);

create policy storage_insert_member
on storage.objects for insert to authenticated
with check (
  bucket_id in ('vehicle-media', 'diagnostics', 'documents')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and app_private.is_member(((storage.foldername(name))[1])::uuid)
);

create policy storage_read_qualification_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'qualification-evidence'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and app_private.is_admin(((storage.foldername(name))[1])::uuid)
);

create policy storage_insert_qualification_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'qualification-evidence'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and app_private.is_admin(((storage.foldername(name))[1])::uuid)
);

comment on schema app_private is 'Non-exposed authorization and invariant helpers.';
comment on schema audit is 'Append-only security and business audit records.';
comment on schema integration is 'Server-only integration state, outbox and webhook inbox.';
comment on table public.stock_movements is 'Immutable stock ledger; correct with compensating movements.';
comment on table public.invoices is 'Drafts may change; posted invoices are immutable and corrected with credit notes.';
