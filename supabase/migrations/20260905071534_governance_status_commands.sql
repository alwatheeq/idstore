-- Redacted operational visibility for private integration and audit schemas.
create or replace function public.integration_overview(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.has_permission(p_organization_id,null,'integration.manage') then raise exception 'Not authorized to view integrations' using errcode='42501'; end if;
  return jsonb_build_object(
    'connections',coalesce((select jsonb_agg(jsonb_build_object('provider',c.provider,'status',c.status,'configured',c.secret_ref is not null,'updated_at',c.updated_at) order by c.provider) from integration.connections c where c.organization_id=p_organization_id),'[]'::jsonb),
    'outbox',coalesce((select jsonb_agg(jsonb_build_object('event_type',x.event_type,'pending',x.pending,'oldest_at',x.oldest_at) order by x.event_type) from (select event_type,count(*) filter(where published_at is null) pending,min(created_at) filter(where published_at is null) oldest_at from integration.outbox_events where organization_id=p_organization_id group by event_type) x),'[]'::jsonb),
    'e_invoice',coalesce((select jsonb_agg(jsonb_build_object('state',x.state,'count',x.count) order by x.state) from (select state,count(*) count from integration.e_invoice_submissions where organization_id=p_organization_id group by state) x),'[]'::jsonb),
    'invalid_webhooks',(select count(*) from integration.webhook_inbox where organization_id=p_organization_id and not signature_valid)
  );
end; $$;

create or replace function public.audit_recent(p_organization_id uuid,p_limit integer default 100)
returns table(id bigint,action text,entity_type text,entity_id uuid,actor_name text,occurred_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.has_permission(p_organization_id,null,'audit.read') then raise exception 'Not authorized to read audit history' using errcode='42501'; end if;
  return query select e.id,e.action,e.entity_type,e.entity_id,p.display_name,e.occurred_at from audit.events e left join public.profiles p on p.user_id=e.actor_id where e.organization_id=p_organization_id order by e.occurred_at desc limit least(greatest(coalesce(p_limit,100),1),500);
end; $$;
revoke all on function public.integration_overview(uuid) from public,anon,authenticated;
revoke all on function public.audit_recent(uuid,integer) from public,anon,authenticated;
grant execute on function public.integration_overview(uuid) to authenticated;
grant execute on function public.audit_recent(uuid,integer) to authenticated;
