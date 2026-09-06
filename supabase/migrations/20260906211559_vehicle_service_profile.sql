-- Additive independent-workshop API. Existing factory-warranty history and
-- update_vehicle_profile remain untouched for compatibility with older clients.
create function public.update_vehicle_service_profile(
  p_vehicle_id uuid,
  p_branch_id uuid,
  p_drive_unit text,
  p_connectivity_status text,
  p_software_version text,
  p_first_registration_date date,
  p_color text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_color text := nullif(trim(p_color), '');
begin
  if auth.uid() is null then
    raise exception 'Not authorized to manage this vehicle' using errcode = '42501';
  end if;
  select * into strict v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if not app_private.has_permission(v_vehicle.organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to manage this vehicle' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = v_vehicle.organization_id and b.status = 'active'
  ) or p_connectivity_status is null
    or p_connectivity_status not in ('unknown', 'connected', 'disconnected', 'not_supported')
    or (v_color is not null and char_length(v_color) > 80) then
    raise exception 'Vehicle profile details are invalid' using errcode = '22023';
  end if;

  -- Deliberately omit all warranty columns. Saving a service profile must never
  -- clear historical coverage, even when no warranty inputs exist in the UI.
  update public.vehicles set
    primary_branch_id = p_branch_id,
    drive_unit = nullif(trim(p_drive_unit), ''),
    connectivity_status = p_connectivity_status,
    software_version = nullif(trim(p_software_version), ''),
    first_registration_date = p_first_registration_date,
    color = v_color,
    updated_at = now()
  where id = v_vehicle.id;

  insert into audit.events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_vehicle.organization_id, auth.uid(), 'vehicle.service_profile_updated', 'vehicle', v_vehicle.id,
    jsonb_build_object('branch_id', p_branch_id, 'primary_branch_id', p_branch_id,
      'connectivity_status', p_connectivity_status, 'color', v_color));
  return v_vehicle.id;
end;
$$;

revoke all on function public.update_vehicle_service_profile(uuid, uuid, text, text, text, date, text) from public, anon;
grant execute on function public.update_vehicle_service_profile(uuid, uuid, text, text, text, date, text) to authenticated;

-- Rollback (after reverting the app caller): drop only this new function.
-- No data restoration is necessary: this migration modifies no vehicle records.
