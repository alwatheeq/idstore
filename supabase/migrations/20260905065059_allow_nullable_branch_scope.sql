-- Organization-wide records may intentionally omit branch_id. When a branch is
-- present, continue enforcing that it belongs to the row's organization.

create or replace function app_private.assert_branch_organization()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = new.branch_id and b.organization_id = new.organization_id
  ) then
    raise exception 'Branch does not belong to organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function app_private.assert_branch_organization() from public, anon, authenticated;
