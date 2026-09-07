alter table public.repair_orders add column order_type text not null default 'maintenance' check(order_type in ('maintenance','bodyshop'));
alter table public.service_templates add column work_order_type text not null default 'maintenance' check(work_order_type in ('maintenance','bodyshop'));
create table public.work_order_service_choices (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 branch_id uuid not null references public.branches(id),
 repair_order_id uuid not null references public.repair_orders(id),
 inspection_id uuid not null references public.inspections(id),
 service_version_id uuid not null references public.service_template_versions(id),
 service_code text not null, description_en text not null, description_ar text,
 note text, selected_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(inspection_id,service_version_id)
);
create index work_order_service_choices_order on public.work_order_service_choices(repair_order_id);
create index work_order_service_choices_org_branch on public.work_order_service_choices(organization_id,branch_id);
create index work_order_service_choices_version on public.work_order_service_choices(service_version_id);
create index work_order_service_choices_actor on public.work_order_service_choices(selected_by);
alter table public.work_order_service_choices enable row level security;
revoke all on public.work_order_service_choices from anon, authenticated;
grant select on public.work_order_service_choices to authenticated;
create policy read_work_order_service_choices on public.work_order_service_choices for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));

create function app_private.create_workshop_order(
 p_organization_id uuid, p_branch_id uuid, p_customer_id uuid, p_vehicle_id uuid,
 p_order_type text, p_odometer_km integer, p_state_of_charge numeric, p_customer_concern text, p_promised_at timestamptz
) returns public.repair_orders language plpgsql security definer set search_path='' as $$
declare r public.repair_orders%rowtype;
begin
 if auth.uid() is null or not app_private.has_permission(p_organization_id,p_branch_id,'repair_order.manage') then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_order_type is null or p_order_type not in ('maintenance','bodyshop') then raise exception 'Choose Maintenance or Bodyshop' using errcode='22023'; end if;
 r := public.create_repair_order(p_organization_id,p_branch_id,p_customer_id,p_vehicle_id,null,p_odometer_km,p_state_of_charge,p_customer_concern,p_promised_at);
 update public.repair_orders set order_type=p_order_type where id=r.id returning * into r;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(r.organization_id,auth.uid(),'work_order.type_selected','repair_order',r.id,jsonb_build_object('order_type',p_order_type));
 return r;
end $$;
create function public.create_workshop_order(
 p_organization_id uuid, p_branch_id uuid, p_customer_id uuid, p_vehicle_id uuid,
 p_order_type text, p_odometer_km integer default null, p_state_of_charge numeric default null, p_customer_concern text default null, p_promised_at timestamptz default null
) returns public.repair_orders language sql security invoker set search_path='' as $$
 select app_private.create_workshop_order(p_organization_id,p_branch_id,p_customer_id,p_vehicle_id,p_order_type,p_odometer_km,p_state_of_charge,p_customer_concern,p_promised_at);
$$;
revoke all on function app_private.create_workshop_order(uuid,uuid,uuid,uuid,text,integer,numeric,text,timestamptz) from public,anon;
revoke all on function public.create_workshop_order(uuid,uuid,uuid,uuid,text,integer,numeric,text,timestamptz) from public,anon;
grant execute on function app_private.create_workshop_order(uuid,uuid,uuid,uuid,text,integer,numeric,text,timestamptz) to authenticated;
grant execute on function public.create_workshop_order(uuid,uuid,uuid,uuid,text,integer,numeric,text,timestamptz) to authenticated;

create function app_private.save_workshop_service(
 p_organization_id uuid,p_template_id uuid,p_name text,p_name_ar text,p_order_type text,p_price numeric,p_minutes integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.service_templates%rowtype; v public.service_template_versions%rowtype; code text;
begin
 if auth.uid() is null or not app_private.is_admin(p_organization_id) then raise exception 'Only administrators can define services' using errcode='42501'; end if;
 if nullif(trim(p_name),'') is null or length(trim(p_name))>160 or length(coalesce(p_name_ar,''))>160
 or p_order_type is null or p_order_type not in ('maintenance','bodyshop')
 or (p_price is not null and (p_price<0 or p_price>999999.999 or p_price<>round(p_price,3)))
 or (p_minutes is not null and (p_minutes<1 or p_minutes>1440)) then raise exception 'Invalid service details' using errcode='22023'; end if;
 if p_template_id is null then
  code := case when p_order_type='bodyshop' then 'BDY-' else 'MNT-' end || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  v := public.create_service_template(p_organization_id,code,trim(p_name),trim(coalesce(p_name_ar,'')),'',current_date,null,null,'workshop:admin-defined-service',
    jsonb_build_object('entry_mode','simple','model_codes',jsonb_build_array(),'service_pricing',jsonb_build_object('currency','JOD','customer_price',p_price)));
  update public.service_templates set work_order_type=p_order_type where id=v.template_id;
 else
  select * into t from public.service_templates where id=p_template_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Service not found' using errcode='P0002'; end if;
  if t.work_order_type<>p_order_type then raise exception 'Service type cannot change; create a separate service' using errcode='23514'; end if;
  code := t.code;
  update public.service_templates set name_en=trim(p_name),name_ar=trim(coalesce(p_name_ar,'')) where id=t.id;
  insert into public.service_template_versions(organization_id,template_id,version_no,effective_from,source_uri,status,applicability_json)
  select p_organization_id,t.id,coalesce(max(version_no),0)+1,current_date,'workshop:admin-defined-service','draft',
   jsonb_build_object('entry_mode','simple','model_codes',jsonb_build_array(),'service_pricing',jsonb_build_object('currency','JOD','customer_price',p_price))
  from public.service_template_versions where template_id=t.id returning * into v;
 end if;
 perform public.add_service_template_task(v.id,code,trim(p_name),trim(coalesce(p_name_ar,'')),coalesce(p_minutes,0),'','','',jsonb_build_object('capture','confirmation','safety_class','normal'));
 perform public.publish_service_template_version(v.id);
 return v.id;
end $$;
create function public.save_workshop_service(p_organization_id uuid,p_template_id uuid,p_name text,p_name_ar text,p_order_type text,p_price numeric,p_minutes integer)
returns uuid language sql security invoker set search_path='' as $$
 select app_private.save_workshop_service(p_organization_id,p_template_id,p_name,p_name_ar,p_order_type,p_price,p_minutes);
$$;
revoke all on function app_private.save_workshop_service(uuid,uuid,text,text,text,numeric,integer) from public,anon;
revoke all on function public.save_workshop_service(uuid,uuid,text,text,text,numeric,integer) from public,anon;
grant execute on function app_private.save_workshop_service(uuid,uuid,text,text,text,numeric,integer) to authenticated;
grant execute on function public.save_workshop_service(uuid,uuid,text,text,text,numeric,integer) to authenticated;

create function app_private.select_inspection_services(p_inspection_id uuid,p_service_ids uuid[],p_note text)
returns integer language plpgsql security definer set search_path='' as $$
declare i public.inspections%rowtype; r public.repair_orders%rowtype; n integer; selected_count integer;
begin
 select * into i from public.inspections where id=p_inspection_id for update;
 if auth.uid() is null or not found or not app_private.has_permission(i.organization_id,i.branch_id,'inspection.perform')
  or not (app_private.is_admin(i.organization_id) or exists(select 1 from public.technician_profiles t where t.id=i.technician_id and t.organization_id=i.organization_id and t.user_id=auth.uid() and t.active))
 then raise exception 'Only the assigned technician or administrator can select services' using errcode='42501'; end if;
 select * into strict r from public.repair_orders where id=i.repair_order_id for update;
 if i.status<>'completed' then raise exception 'Complete the inspection checklist before selecting services' using errcode='23514'; end if;
 if r.status in ('delivered','closed','cancelled') then raise exception 'This order is read-only.' using errcode='23514'; end if;
 if p_service_ids is null or array_position(p_service_ids,null) is not null or cardinality(p_service_ids)<1 or cardinality(p_service_ids)>100 or length(coalesce(p_note,''))>2000 then raise exception 'Select between 1 and 100 services' using errcode='22023'; end if;
 select count(distinct id) into selected_count from unnest(p_service_ids) id;
 select count(*) into n from public.service_template_versions v join public.service_templates t on t.id=v.template_id
 where v.id=any(p_service_ids) and v.organization_id=i.organization_id and t.organization_id=i.organization_id
 and v.status='published' and v.effective_from<=current_date and (v.effective_to is null or v.effective_to>=current_date)
 and t.work_order_type=r.order_type
 and not exists(select 1 from public.service_template_tasks task where task.version_id=v.id and coalesce(task.result_schema->>'safety_class','normal') like 'hv_%');
 if n<>selected_count then raise exception 'Choose active services matching this work order type' using errcode='23514'; end if;
 insert into public.work_order_service_choices(organization_id,branch_id,repair_order_id,inspection_id,service_version_id,service_code,description_en,description_ar,note,selected_by)
 select i.organization_id,i.branch_id,r.id,i.id,v.id,t.code,t.name_en,t.name_ar,nullif(trim(p_note),''),auth.uid()
 from public.service_template_versions v join public.service_templates t on t.id=v.template_id where v.id=any(p_service_ids)
 on conflict(inspection_id,service_version_id) do nothing;
 get diagnostics n=row_count;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(i.organization_id,auth.uid(),'inspection.services_selected','repair_order',r.id,jsonb_build_object('inspection_id',i.id,'service_ids',p_service_ids,'added',n));
 return n;
end $$;
create function public.select_inspection_services(p_inspection_id uuid,p_service_ids uuid[],p_note text default null)
returns integer language sql security invoker set search_path='' as $$ select app_private.select_inspection_services(p_inspection_id,p_service_ids,p_note); $$;
revoke all on function app_private.select_inspection_services(uuid,uuid[],text) from public,anon;
revoke all on function public.select_inspection_services(uuid,uuid[],text) from public,anon;
grant execute on function app_private.select_inspection_services(uuid,uuid[],text) to authenticated;
grant execute on function public.select_inspection_services(uuid,uuid[],text) to authenticated;
