-- Configurable, model-aware inspection check catalog with batch pass capture.

create table public.inspection_check_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  vehicle_model_id uuid references public.vehicle_models(id) on delete cascade,
  code text not null,
  category text not null check (category in ('identity', 'hv_battery', 'charging', 'exterior', 'tyres_brakes', 'underbody', 'cabin', 'electronics', 'road_test')),
  label_en text not null,
  label_ar text not null,
  is_required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 1 and 9999),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, vehicle_model_id, code),
  check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  check (length(trim(label_en)) between 3 and 160),
  check (length(trim(label_ar)) between 3 and 160),
  check (organization_id is not null or vehicle_model_id is null)
);

create index inspection_check_definitions_scope
  on public.inspection_check_definitions(organization_id, vehicle_model_id, active, sort_order);

alter table public.inspection_items
  add column check_definition_id uuid references public.inspection_check_definitions(id) on delete restrict;

create unique index inspection_items_definition_unique
  on public.inspection_items(inspection_id, check_definition_id)
  where check_definition_id is not null;

alter table public.inspection_check_definitions enable row level security;

create policy read_inspection_check_definitions
on public.inspection_check_definitions for select to authenticated
using (organization_id is null or app_private.is_member(organization_id));

revoke all on table public.inspection_check_definitions from anon, authenticated;
grant select on public.inspection_check_definitions to authenticated;

insert into public.inspection_check_definitions
  (organization_id, code, category, label_en, label_ar, is_required, sort_order)
values
  (null, 'IDENTITY_WARNINGS', 'identity', 'Warning lights and dashboard messages', 'أضواء التحذير ورسائل لوحة العدادات', true, 10),
  (null, 'IDENTITY_SERVICE_STATUS', 'identity', 'Service status and digital service record', 'حالة الصيانة وسجل الصيانة الرقمي', true, 20),
  (null, 'HV_BATTERY_SOH', 'hv_battery', 'High-voltage battery state of health', 'حالة صحة بطارية الجهد العالي', true, 100),
  (null, 'HV_COMPONENTS_VISUAL', 'hv_battery', 'High-voltage components and cables', 'مكونات وكابلات الجهد العالي', true, 110),
  (null, 'HV_BATTERY_ENCLOSURE', 'hv_battery', 'Battery enclosure and impact protection', 'غلاف البطارية والحماية من الصدمات', true, 120),
  (null, 'CHARGE_PORT', 'charging', 'Charging socket condition and cleanliness', 'حالة ونظافة مقبس الشحن', true, 200),
  (null, 'CHARGE_CABLE', 'charging', 'Charging cable, plug and presence', 'وجود وحالة كابل وقابس الشحن', true, 210),
  (null, 'EXTERIOR_LIGHTS', 'exterior', 'Exterior lights and indicators', 'المصابيح الخارجية وإشارات الانعطاف', true, 300),
  (null, 'GLASS_WIPERS', 'exterior', 'Glass, mirrors, washers and wipers', 'الزجاج والمرايا والغسالات والمساحات', true, 310),
  (null, 'BODY_CLOSURES', 'exterior', 'Bodywork, doors, tailgate and locks', 'هيكل المركبة والأبواب والباب الخلفي والأقفال', true, 320),
  (null, 'TYRE_CONDITION', 'tyres_brakes', 'Tyre condition, pressure and tread', 'حالة الإطارات وضغطها وعمق النقشة', true, 400),
  (null, 'WHEELS', 'tyres_brakes', 'Wheels, fasteners and visible damage', 'العجلات والمثبتات والأضرار الظاهرة', true, 410),
  (null, 'FRICTION_BRAKES', 'tyres_brakes', 'Brake discs, pads and corrosion', 'أقراص ووسادات الفرامل والتآكل', true, 420),
  (null, 'BRAKE_FLUID', 'tyres_brakes', 'Brake fluid condition and level', 'حالة ومستوى سائل الفرامل', true, 430),
  (null, 'UNDERBODY', 'underbody', 'Underbody, covers and visible leaks', 'أسفل المركبة والأغطية والتسربات الظاهرة', true, 500),
  (null, 'STEERING_SUSPENSION', 'underbody', 'Steering, suspension and drive components', 'مكونات التوجيه والتعليق ونظام الدفع', true, 510),
  (null, 'CABIN_SAFETY', 'cabin', 'Seat belts, horn and cabin safety equipment', 'أحزمة الأمان والبوق ومعدات سلامة المقصورة', true, 600),
  (null, 'CLIMATE_POLLEN', 'cabin', 'Climate operation and pollen filter status', 'تشغيل نظام المناخ وحالة فلتر المقصورة', true, 610),
  (null, 'DIAGNOSTIC_SCAN', 'electronics', 'Diagnostic scan and software status', 'الفحص التشخيصي وحالة البرمجيات', true, 700),
  (null, 'INFOTAINMENT_CONNECTIVITY', 'electronics', 'Infotainment, connectivity and controls', 'نظام المعلومات والترفيه والاتصال وأدوات التحكم', true, 710),
  (null, 'ROAD_TEST', 'road_test', 'Road test, braking, noise and vibration', 'اختبار الطريق والفرملة والضوضاء والاهتزاز', false, 800)
on conflict do nothing;

create or replace function public.create_inspection_check_definition(
  p_organization_id uuid,
  p_vehicle_model_id uuid,
  p_code text,
  p_category text,
  p_label_en text,
  p_label_ar text,
  p_is_required boolean,
  p_sort_order integer
)
returns public.inspection_check_definitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_definition public.inspection_check_definitions%rowtype;
begin
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id and m.user_id = auth.uid()
      and m.role = 'admin' and m.status = 'active'
  ) then
    raise exception 'Only an administrator can manage inspection checks' using errcode = '42501';
  end if;
  if p_vehicle_model_id is not null and not exists (
    select 1 from public.vehicle_models vm
    where vm.id = p_vehicle_model_id and (vm.organization_id is null or vm.organization_id = p_organization_id)
  ) then
    raise exception 'Vehicle model is not available to this organization' using errcode = '22023';
  end if;
  if upper(trim(coalesce(p_code, ''))) !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
     or p_category not in ('identity', 'hv_battery', 'charging', 'exterior', 'tyres_brakes', 'underbody', 'cabin', 'electronics', 'road_test')
     or length(trim(coalesce(p_label_en, ''))) not between 3 and 160
     or length(trim(coalesce(p_label_ar, ''))) not between 3 and 160
     or p_sort_order not between 1 and 9999 then
    raise exception 'Inspection check details are invalid' using errcode = '22023';
  end if;

  insert into public.inspection_check_definitions (
    organization_id, vehicle_model_id, code, category, label_en, label_ar,
    is_required, active, sort_order, created_by
  ) values (
    p_organization_id, p_vehicle_model_id, upper(trim(p_code)), p_category,
    trim(p_label_en), trim(p_label_ar), coalesce(p_is_required, false), true,
    p_sort_order, auth.uid()
  ) returning * into v_definition;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'inspection.check_definition_created', 'inspection_check_definition', v_definition.id,
    jsonb_build_object('code', v_definition.code, 'vehicle_model_id', v_definition.vehicle_model_id, 'required', v_definition.is_required));
  return v_definition;
end;
$$;

create or replace function public.add_inspection_catalog_items(p_inspection_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_model_id uuid;
  v_entry jsonb;
  v_definition public.inspection_check_definitions%rowtype;
  v_result text;
  v_sequence integer;
  v_added integer := 0;
begin
  select * into v_inspection
  from public.inspections i
  where i.id = p_inspection_id
  for update;
  if not found then raise exception 'Inspection not found' using errcode = 'P0002'; end if;
  select v.model_id into strict v_model_id
  from public.repair_orders r
  join public.vehicles v on v.id = r.vehicle_id
  where r.id = v_inspection.repair_order_id;
  if not app_private.has_permission(v_inspection.organization_id, v_inspection.branch_id, 'inspection.perform') then
    raise exception 'Not authorized to update this inspection' using errcode = '42501';
  end if;
  if v_inspection.status <> 'in_progress' then raise exception 'Only an active inspection can be changed' using errcode = '23514'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Choose between 1 and 50 inspection checks' using errcode = '22023';
  end if;

  select coalesce(max(i.sequence), 0) into v_sequence
  from public.inspection_items i where i.inspection_id = v_inspection.id;

  for v_entry in select value from jsonb_array_elements(p_items)
  loop
    v_result := v_entry->>'result';
    if v_result not in ('pass', 'not_applicable') then
      raise exception 'The checklist matrix accepts pass or not applicable results only' using errcode = '22023';
    end if;
    select * into v_definition
    from public.inspection_check_definitions d
    where d.id = (v_entry->>'definition_id')::uuid
      and d.active
      and (d.organization_id is null or d.organization_id = v_inspection.organization_id)
      and (d.vehicle_model_id is null or d.vehicle_model_id = v_model_id);
    if not found then raise exception 'Inspection check is not applicable to this vehicle' using errcode = '22023'; end if;

    v_sequence := v_sequence + 1;
    insert into public.inspection_items (
      organization_id, branch_id, inspection_id, check_definition_id,
      sequence, result, measurement_json
    ) values (
      v_inspection.organization_id, v_inspection.branch_id, v_inspection.id, v_definition.id,
      v_sequence, v_result, jsonb_build_object('check', v_definition.label_en, 'check_ar', v_definition.label_ar, 'category', v_definition.category)
    ) on conflict (inspection_id, check_definition_id) where check_definition_id is not null do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;

  if v_added = 0 then raise exception 'All selected checks are already recorded' using errcode = '23505'; end if;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_inspection.organization_id, auth.uid(), 'inspection.items_added', 'inspection', v_inspection.id,
    jsonb_build_object('count', v_added, 'source', 'check_matrix'));
  return v_added;
end;
$$;

create or replace function public.complete_inspection(p_inspection_id uuid)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_order public.repair_orders%rowtype;
  v_model_id uuid;
begin
  select * into v_inspection from public.inspections where id = p_inspection_id for update;
  if not found then raise exception 'Inspection not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_inspection.organization_id, v_inspection.branch_id, 'inspection.perform') then
    raise exception 'Not authorized to complete this inspection' using errcode = '42501';
  end if;
  if v_inspection.status <> 'in_progress' then raise exception 'Only an active inspection can be completed' using errcode = '23514'; end if;
  if not exists (select 1 from public.inspection_items i where i.inspection_id = v_inspection.id) then
    raise exception 'Add at least one completed check before finishing the inspection' using errcode = '23514';
  end if;

  select * into strict v_order
  from public.repair_orders r
  where r.id = v_inspection.repair_order_id
  for update;
  select v.model_id into strict v_model_id
  from public.vehicles v
  where v.id = v_order.vehicle_id;

  if exists (
    select 1 from public.inspection_check_definitions d
    where d.active and d.is_required
      and (d.organization_id is null or d.organization_id = v_inspection.organization_id)
      and (d.vehicle_model_id is null or d.vehicle_model_id = v_model_id)
      and not exists (
        select 1 from public.inspection_items ii
        where ii.inspection_id = v_inspection.id and ii.check_definition_id = d.id
      )
  ) then
    raise exception 'Complete all required inspection checks before locking the inspection' using errcode = '23514';
  end if;

  update public.inspections set status = 'completed', completed_at = now()
  where id = v_inspection.id returning * into v_inspection;
  if v_order.status = 'checked_in' then
    update public.repair_orders set status = 'diagnosis' where id = v_order.id;
    insert into public.repair_order_events (
      organization_id, branch_id, repair_order_id, from_status, to_status, reason, actor_id
    ) values (
      v_order.organization_id, v_order.branch_id, v_order.id, 'checked_in', 'diagnosis', 'Vehicle inspection completed', auth.uid()
    );
  end if;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_inspection.organization_id, auth.uid(), 'inspection.completed', 'inspection', v_inspection.id,
    jsonb_build_object('repair_order_id', v_inspection.repair_order_id));
  return v_inspection;
end;
$$;

revoke all on function public.create_inspection_check_definition(uuid, uuid, text, text, text, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.add_inspection_catalog_items(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.complete_inspection(uuid) from public, anon, authenticated;
grant execute on function public.create_inspection_check_definition(uuid, uuid, text, text, text, text, boolean, integer) to authenticated;
grant execute on function public.add_inspection_catalog_items(uuid, jsonb) to authenticated;
grant execute on function public.complete_inspection(uuid) to authenticated;

comment on table public.inspection_check_definitions is 'Global and organization-defined inspection checks, optionally scoped to one vehicle model.';
comment on function public.add_inspection_catalog_items is 'Adds multiple catalog checks transactionally after validating inspection permission and vehicle applicability.';
