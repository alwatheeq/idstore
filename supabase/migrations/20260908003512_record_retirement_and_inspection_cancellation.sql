create or replace function app_private.retire_catalog_service(p_organization_id uuid,p_version_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_version public.service_template_versions%rowtype;
begin
  if auth.uid() is null or not app_private.is_admin(p_organization_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Enter a reason between 3 and 500 characters.' using errcode='22023'; end if;
  perform 1 from public.service_templates where id=(select template_id from public.service_template_versions where id=p_version_id and organization_id=p_organization_id) for update;
  select * into v_version from public.service_template_versions where id=p_version_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  if v_version.status='retired' or exists(select 1 from public.service_template_versions where template_id=v_version.template_id and version_no>v_version.version_no and status<>'retired') then
    raise exception 'This record changed. Refresh the page and try again.' using errcode='40001';
  end if;
  update public.service_template_versions set status='retired' where template_id=v_version.template_id and organization_id=p_organization_id and status<>'retired';
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata)
    values(p_organization_id,auth.uid(),'service.retired','service_template',v_version.template_id,jsonb_build_object('reason',p_reason,'version_id',p_version_id));
end;
$$;
create or replace function public.retire_catalog_service(p_organization_id uuid,p_version_id uuid,p_reason text)
returns void language sql security invoker set search_path='' as $$ select app_private.retire_catalog_service(p_organization_id,p_version_id,p_reason); $$;
revoke all on function app_private.retire_catalog_service(uuid,uuid,text),public.retire_catalog_service(uuid,uuid,text) from public,anon;
grant execute on function app_private.retire_catalog_service(uuid,uuid,text),public.retire_catalog_service(uuid,uuid,text) to authenticated;

create or replace function app_private.cancel_inspection_record(p_organization_id uuid,p_inspection_id uuid,p_updated_at timestamptz,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_inspection public.inspections%rowtype; v_order public.repair_orders%rowtype;
begin
  if auth.uid() is null or not app_private.is_admin(p_organization_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Enter a reason between 3 and 500 characters.' using errcode='22023'; end if;
  select * into v_order from public.repair_orders where id=(select repair_order_id from public.inspections where id=p_inspection_id and organization_id=p_organization_id) for update;
  select * into v_inspection from public.inspections where id=p_inspection_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  if p_updated_at is null or v_inspection.updated_at<>p_updated_at then raise exception 'This record changed. Refresh the page and try again.' using errcode='40001'; end if;
  if v_inspection.status not in ('draft','in_progress') or v_order.status in ('delivered','closed') then
    raise exception 'Completed inspections cannot be cancelled. Record a new inspection or retest instead.' using errcode='22023';
  end if;
  update public.inspections set status='cancelled',updated_at=clock_timestamp() where id=p_inspection_id;
  insert into audit.events(organization_id,branch_id,actor_id,action,entity_type,entity_id,metadata)
    values(p_organization_id,v_inspection.branch_id,auth.uid(),'inspection.cancelled','inspection',p_inspection_id,jsonb_build_object('reason',p_reason));
end;
$$;
create or replace function public.cancel_inspection_record(p_organization_id uuid,p_inspection_id uuid,p_updated_at timestamptz,p_reason text)
returns void language sql security invoker set search_path='' as $$ select app_private.cancel_inspection_record(p_organization_id,p_inspection_id,p_updated_at,p_reason); $$;
revoke all on function app_private.cancel_inspection_record(uuid,uuid,timestamptz,text),public.cancel_inspection_record(uuid,uuid,timestamptz,text) from public,anon;
grant execute on function app_private.cancel_inspection_record(uuid,uuid,timestamptz,text),public.cancel_inspection_record(uuid,uuid,timestamptz,text) to authenticated;
