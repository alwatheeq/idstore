-- Remove the generated finding before its still-editable inspection check.

create or replace function public.remove_inspection_item(p_inspection_item_id uuid)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inspection_items%rowtype;
  v_inspection public.inspections%rowtype;
begin
  select * into v_item from public.inspection_items where id = p_inspection_item_id;
  if not found then raise exception 'Inspection item not found' using errcode = 'P0002'; end if;
  select * into strict v_inspection from public.inspections where id = v_item.inspection_id for update;
  if not app_private.has_permission(v_inspection.organization_id, v_inspection.branch_id, 'inspection.perform') then
    raise exception 'Not authorized to update this inspection' using errcode = '42501';
  end if;
  if v_inspection.status <> 'in_progress' then raise exception 'Completed inspections are immutable' using errcode = '23514'; end if;

  delete from public.findings where inspection_item_id = v_item.id;
  delete from public.inspection_items where id = v_item.id;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_inspection.organization_id, auth.uid(), 'inspection.item_removed', 'inspection', v_inspection.id, jsonb_build_object('item_id', v_item.id));
  return v_inspection;
end;
$$;

revoke all on function public.remove_inspection_item(uuid) from public, anon, authenticated;
grant execute on function public.remove_inspection_item(uuid) to authenticated;
comment on function public.remove_inspection_item is 'Removes an editable inspection check and its generated finding without downgrading an established safety state.';
