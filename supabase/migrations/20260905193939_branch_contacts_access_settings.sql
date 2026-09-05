-- Branch-owned contact channels and an audited administrator access command.

alter table public.branches
  add column if not exists whatsapp text;

comment on column public.branches.whatsapp is
  'Branch-owned WhatsApp contact number displayed independently from the voice phone.';

drop function if exists public.create_branch(uuid, text, text, text, text, text, text, text, text, boolean);

create function public.create_branch(
  p_organization_id uuid,
  p_code text,
  p_legal_name text,
  p_display_name text,
  p_city text,
  p_address_line1 text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_email text default null,
  p_tax_registration text default null,
  p_hv_capable boolean default false
)
returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches%rowtype;
  v_code text := upper(trim(p_code));
begin
  if not app_private.is_admin(p_organization_id) then
    raise exception 'Not authorized to manage branches' using errcode = '42501';
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,15}$'
     or nullif(trim(p_legal_name), '') is null
     or nullif(trim(p_display_name), '') is null
     or nullif(trim(p_city), '') is null then
    raise exception 'Branch code, legal name, display name and city are required' using errcode = '22023';
  end if;

  insert into public.branches (
    organization_id, code, legal_name, display_name, city, address_json,
    phone, whatsapp, email, tax_registration, country_code, timezone, currency, status
  ) values (
    p_organization_id, v_code, trim(p_legal_name), trim(p_display_name), trim(p_city),
    case when nullif(trim(p_address_line1), '') is null then '{}'::jsonb
         else jsonb_build_object('line1', trim(p_address_line1)) end,
    nullif(trim(p_phone), ''), nullif(trim(p_whatsapp), ''), nullif(trim(p_email), ''),
    nullif(trim(p_tax_registration), ''), 'JO', 'Asia/Amman', 'JOD', 'active'
  ) returning * into v_branch;

  insert into public.warehouses (organization_id, branch_id, code, name)
  values (p_organization_id, v_branch.id, 'MAIN', v_branch.display_name || ' Main');

  if p_hv_capable then
    insert into public.branch_capabilities (
      organization_id, branch_id, capability_code, status
    ) values (
      p_organization_id, v_branch.id, 'HV_SERVICE', 'active'
    );
  end if;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'insert', 'public.branches', v_branch.id,
    jsonb_build_object('code', v_branch.code, 'city', v_branch.city)
  );

  return v_branch;
end;
$$;

create function public.update_branch_contacts(
  p_branch_id uuid,
  p_address_line1 text,
  p_phone text,
  p_whatsapp text,
  p_email text
)
returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches%rowtype;
begin
  select * into v_branch
  from public.branches
  where id = p_branch_id
  for update;

  if not found then
    raise exception 'Branch not found' using errcode = 'P0002';
  end if;
  if not app_private.is_admin(v_branch.organization_id) then
    raise exception 'Only administrators can update branch contacts' using errcode = '42501';
  end if;

  update public.branches
  set address_json = jsonb_strip_nulls(
        coalesce(address_json, '{}'::jsonb)
        || jsonb_build_object('line1', nullif(trim(p_address_line1), ''))
      ),
      phone = nullif(trim(p_phone), ''),
      whatsapp = nullif(trim(p_whatsapp), ''),
      email = nullif(trim(p_email), '')
  where id = p_branch_id
  returning * into v_branch;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_branch.organization_id, auth.uid(), 'branch.contacts_updated', 'public.branches', v_branch.id,
    jsonb_build_object('fields', jsonb_build_array('address', 'phone', 'whatsapp', 'email'))
  );

  return v_branch;
end;
$$;

create function public.update_membership_access(
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
  if p_status not in ('active', 'suspended') then
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

  update public.profiles
  set status = case when p_status = 'active' then 'active' else 'suspended' end
  where user_id = v_membership.user_id;

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

revoke all on function public.create_branch(uuid, text, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.update_branch_contacts(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_membership_access(uuid, public.app_role, text, uuid[], text[]) from public, anon, authenticated;

grant execute on function public.create_branch(uuid, text, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.update_branch_contacts(uuid, text, text, text, text) to authenticated;
grant execute on function public.update_membership_access(uuid, public.app_role, text, uuid[], text[]) to authenticated;
