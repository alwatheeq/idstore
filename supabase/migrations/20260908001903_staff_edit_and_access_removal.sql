create or replace function public.update_membership_access(
  p_membership_id uuid,
  p_role public.app_role,
  p_status text,
  p_branch_ids uuid[],
  p_permission_codes text[]
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.memberships%rowtype;
  v_branch_ids uuid[];
  v_permission_codes text[];
begin
  -- Serialize access changes before locking individual memberships.
  perform 1 from public.organizations where id=(select organization_id from public.memberships where id=p_membership_id) for update;
  select * into v_membership
  from public.memberships
  where id = p_membership_id
  for update;

  if not found then
    raise exception 'Staff membership not found' using errcode = 'P0002';
  end if;
  if not app_private.is_admin(v_membership.organization_id) then
    raise exception 'Only administrators can manage roles and permissions' using errcode = '42501';
  end if;
  if p_role is null or p_status is null or p_status not in ('active', 'suspended') then
    raise exception 'Choose a valid account status' using errcode = '22023';
  end if;
  if v_membership.user_id = auth.uid()
     and (p_role <> 'admin' or p_status <> 'active') then
    raise exception 'You cannot remove your own active administrator access' using errcode = '22023';
  end if;
  if v_membership.role = 'admin'
     and v_membership.status = 'active'
     and (p_role <> 'admin' or p_status <> 'active')
     and (
       select count(*) from public.memberships m
       where m.organization_id = v_membership.organization_id
         and m.role = 'admin'
         and m.status = 'active'
     ) <= 1 then
    raise exception 'At least one active administrator is required' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct requested.id) filter (where requested.id is not null), '{}'::uuid[])
  into v_branch_ids
  from unnest(coalesce(p_branch_ids, '{}'::uuid[])) requested(id);

  select coalesce(array_agg(distinct requested.code) filter (where requested.code is not null), '{}'::text[])
  into v_permission_codes
  from unnest(coalesce(p_permission_codes, '{}'::text[])) requested(code);

  if p_role = 'staff' and cardinality(v_branch_ids) = 0 then
    raise exception 'Staff must be assigned to at least one branch' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_branch_ids) requested(id)
    where not exists (
      select 1 from public.branches b
      where b.id = requested.id
        and b.organization_id = v_membership.organization_id
        and b.status = 'active'
    )
  ) then
    raise exception 'A selected branch is unavailable' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(v_permission_codes) requested(code)
    where not exists (select 1 from public.permissions p where p.code = requested.code)
  ) then
    raise exception 'An unknown permission was selected' using errcode = '23514';
  end if;

  update public.memberships
  set role = p_role,
      all_branches = p_role = 'admin',
      status = p_status
  where id = p_membership_id
  returning * into v_membership;

  -- Membership status is organization-scoped; do not suspend a shared identity.
  if p_status='active' then
    update public.profiles set status='active' where user_id=v_membership.user_id;
  end if;

  delete from public.membership_branches where membership_id = p_membership_id;
  delete from public.membership_permissions where membership_id = p_membership_id;

  if p_role = 'staff' then
    insert into public.membership_branches (organization_id, membership_id, branch_id)
    select v_membership.organization_id, p_membership_id, branch_id
    from unnest(v_branch_ids) requested(branch_id);

    insert into public.membership_permissions (
      organization_id, membership_id, permission_code, allowed, granted_by
    )
    select v_membership.organization_id, p_membership_id, permission_code, true, auth.uid()
    from unnest(v_permission_codes) requested(permission_code);
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_membership.organization_id, auth.uid(), 'membership.access_updated', 'public.memberships', p_membership_id,
    jsonb_build_object(
      'role', p_role,
      'status', p_status,
      'branches', case when p_role = 'admin' then to_jsonb('all'::text) else to_jsonb(v_branch_ids) end,
      'permissions', case when p_role = 'admin' then to_jsonb('all'::text) else to_jsonb(v_permission_codes) end
    )
  );

  return v_membership;
end;
$$;


create function app_private.manage_staff(
 p_organization_id uuid, p_membership_id uuid, p_action text, p_details jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare m public.memberships%rowtype; display text; new_role public.app_role; new_status text; branches uuid[]; permissions text[]; tech boolean;
begin
 perform 1 from public.organizations where id=p_organization_id for update;
 if auth.uid() is null or not app_private.is_admin(p_organization_id) then raise exception 'Only administrators can manage staff.' using errcode='42501'; end if;
 select * into m from public.memberships where id=p_membership_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Staff membership not found' using errcode='P0002'; end if;
 if p_action='delete' then
  if m.user_id=auth.uid() then raise exception 'You cannot delete your own account.' using errcode='22023'; end if;
  if m.role='admin' and m.status='active' and (select count(*) from public.memberships where organization_id=p_organization_id and role='admin' and status='active')<=1 then raise exception 'At least one active administrator is required' using errcode='22023'; end if;
  if m.status='revoked' then return; end if;
  update public.memberships set status='revoked',all_branches=false where id=m.id;
  delete from public.membership_branches where membership_id=m.id;
  delete from public.membership_permissions where membership_id=m.id;
  update public.technician_profiles set active=false where organization_id=p_organization_id and user_id=m.user_id;
 elsif p_action='edit' then
  display:=nullif(trim(p_details->>'displayName'),'');
  if display is null or length(display)>160 or length(coalesce(p_details->>'employeeNo',''))>80 or length(coalesce(p_details->>'laborGrade',''))>80
   or coalesce(p_details->>'role','') not in ('admin','staff') or coalesce(p_details->>'status','') not in ('active','suspended') then
   raise exception 'Enter valid staff details.' using errcode='22023';
  end if;
  new_role:=(p_details->>'role')::public.app_role; new_status:=p_details->>'status';
  select coalesce(array_agg(value::uuid),'{}') into branches from jsonb_array_elements_text(coalesce(p_details->'branchIds','[]'));
  select coalesce(array_agg(value),'{}') into permissions from jsonb_array_elements_text(coalesce(p_details->'permissionCodes','[]')) where value<>'hv_permit.authorize';
  perform public.update_membership_access(m.id,new_role,new_status,case when new_role='admin' then '{}'::uuid[] else branches end,case when new_role='admin' then '{}'::text[] else permissions end);
  update public.profiles set display_name=display where user_id=m.user_id;
  tech:=coalesce((p_details->>'isTechnician')::boolean,false);
  if tech or exists(select 1 from public.technician_profiles where organization_id=p_organization_id and user_id=m.user_id) then
   insert into public.technician_profiles(organization_id,user_id,employee_no,labor_grade,active)
   values(p_organization_id,m.user_id,nullif(trim(p_details->>'employeeNo'),''),nullif(trim(p_details->>'laborGrade'),''),tech and new_status='active')
   on conflict(organization_id,user_id) do update set employee_no=excluded.employee_no,labor_grade=excluded.labor_grade,active=excluded.active;
  end if;
 else raise exception 'Invalid staff action.' using errcode='22023';
 end if;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(p_organization_id,auth.uid(),'staff.'||p_action,'membership',m.id,jsonb_build_object('user_id',m.user_id,'previous_role',m.role,'previous_status',m.status));
end $$;
create function public.manage_staff(p_organization_id uuid,p_membership_id uuid,p_action text,p_details jsonb default '{}')
returns void language sql security invoker set search_path='' as $$ select app_private.manage_staff(p_organization_id,p_membership_id,p_action,p_details); $$;
revoke all on function app_private.manage_staff(uuid,uuid,text,jsonb) from public,anon;
revoke all on function public.manage_staff(uuid,uuid,text,jsonb) from public,anon;
grant execute on function app_private.manage_staff(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.manage_staff(uuid,uuid,text,jsonb) to authenticated;
