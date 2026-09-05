-- Private evidence registration and provider-neutral communication queue.

create policy storage_delete_unregistered_member
on storage.objects for delete to authenticated
using (
  bucket_id in ('vehicle-media', 'diagnostics', 'documents')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and app_private.is_member(((storage.foldername(name))[1])::uuid)
  and not exists (select 1 from public.attachments a where a.bucket = bucket_id and a.object_path = name)
);

create or replace function public.register_attachment(
  p_organization_id uuid, p_branch_id uuid, p_bucket text, p_object_path text,
  p_sha256 text, p_mime_type text, p_size_bytes bigint, p_classification text,
  p_linked_type text, p_linked_id uuid
)
returns public.attachments
language plpgsql security definer set search_path = ''
as $$
declare
  v_attachment public.attachments%rowtype;
  v_expected_org uuid;
  v_expected_branch uuid;
  v_permission text;
begin
  case p_linked_type
    when 'vehicle' then
      select organization_id, null::uuid, 'crm.manage' into v_expected_org, v_expected_branch, v_permission from public.vehicles where id = p_linked_id;
    when 'repair_order' then
      select organization_id, branch_id, 'repair_order.manage' into v_expected_org, v_expected_branch, v_permission from public.repair_orders where id = p_linked_id;
    when 'inspection' then
      select organization_id, branch_id, 'inspection.perform' into v_expected_org, v_expected_branch, v_permission from public.inspections where id = p_linked_id;
    when 'diagnostic_session' then
      select organization_id, branch_id, 'job.perform' into v_expected_org, v_expected_branch, v_permission from public.diagnostic_sessions where id = p_linked_id;
    when 'battery_health_report' then
      select organization_id, branch_id, 'job.perform' into v_expected_org, v_expected_branch, v_permission from public.battery_health_reports where id = p_linked_id;
    when 'invoice' then
      select organization_id, branch_id, 'invoice.post' into v_expected_org, v_expected_branch, v_permission from public.invoices where id = p_linked_id;
    else raise exception 'Attachment target type is unsupported' using errcode = '22023';
  end case;
  if v_expected_org is null then raise exception 'Attachment target not found' using errcode = 'P0002'; end if;
  if v_expected_org <> p_organization_id or v_expected_branch is distinct from p_branch_id then
    raise exception 'Attachment tenant or branch does not match its target' using errcode = '23514';
  end if;
  if not app_private.has_permission(v_expected_org, v_expected_branch, v_permission) then
    raise exception 'Not authorized to attach evidence to this record' using errcode = '42501';
  end if;
  if p_classification not in ('internal','confidential','restricted')
     or p_bucket not in ('vehicle-media','diagnostics','documents')
     or (p_bucket = 'diagnostics' and p_linked_type not in ('diagnostic_session','battery_health_report'))
     or (p_bucket = 'vehicle-media' and p_linked_type not in ('vehicle','repair_order','inspection'))
     or (p_bucket = 'documents' and p_linked_type <> 'invoice')
     or p_object_path not like p_organization_id::text || '/' || p_linked_type || '/' || p_linked_id::text || '/%'
     or p_sha256 !~ '^[0-9a-f]{64}$' or p_size_bytes < 1 or p_size_bytes > 52428800
     or p_mime_type not in ('application/pdf','application/json','application/octet-stream','text/plain','image/jpeg','image/png','image/webp') then
    raise exception 'Attachment bucket, path, digest, type, size or classification is invalid' using errcode = '22023';
  end if;
  select * into v_attachment from public.attachments where organization_id = p_organization_id and sha256 = p_sha256
    and linked_type = p_linked_type and linked_id = p_linked_id;
  if found then return v_attachment; end if;
  insert into public.attachments (organization_id, branch_id, bucket, object_path, sha256, mime_type, size_bytes, classification, linked_type, linked_id, created_by)
  values (p_organization_id, p_branch_id, p_bucket, p_object_path, lower(p_sha256), p_mime_type, p_size_bytes, p_classification, p_linked_type, p_linked_id, auth.uid())
  returning * into v_attachment;
  if p_linked_type = 'diagnostic_session' then update public.diagnostic_sessions set attachment_id = v_attachment.id where id = p_linked_id and attachment_id is null; end if;
  if p_linked_type = 'battery_health_report' then update public.battery_health_reports set attachment_id = v_attachment.id where id = p_linked_id and attachment_id is null; end if;
  return v_attachment;
end;
$$;

create or replace function public.queue_customer_message(
  p_customer_id uuid, p_branch_id uuid, p_template_code text, p_template_version integer,
  p_channel text, p_dedupe_key text
)
returns public.messages
language plpgsql security definer set search_path = ''
as $$
declare v_customer public.customers%rowtype; v_message public.messages%rowtype;
begin
  select * into v_customer from public.customers where id = p_customer_id and status = 'active';
  if not found then raise exception 'Active customer not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_customer.organization_id, p_branch_id, 'crm.manage') then
    raise exception 'Not authorized to queue customer communications' using errcode = '42501';
  end if;
  if p_branch_id is not null and not exists (select 1 from public.branches where id=p_branch_id and organization_id=v_customer.organization_id) then
    raise exception 'Message branch does not belong to customer organization' using errcode = '23514';
  end if;
  if p_channel not in ('email','sms','whatsapp','push') or nullif(trim(p_template_code),'') is null
     or p_template_version < 1 or nullif(trim(p_dedupe_key),'') is null then
    raise exception 'Message template, version, channel or dedupe key is invalid' using errcode = '22023';
  end if;
  select * into v_message from public.messages where organization_id=v_customer.organization_id and dedupe_key=trim(p_dedupe_key);
  if found then return v_message; end if;
  insert into public.messages (organization_id, branch_id, customer_id, template_code, template_version, channel, dedupe_key)
  values (v_customer.organization_id, p_branch_id, v_customer.id, upper(trim(p_template_code)), p_template_version, p_channel, trim(p_dedupe_key))
  returning * into v_message;
  insert into integration.outbox_events (organization_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
  values (v_customer.organization_id,'message.queued','message',v_message.id,jsonb_build_object('message_id',v_message.id,'channel',v_message.channel),'message:'||v_message.id::text);
  return v_message;
end;
$$;

revoke all on function public.register_attachment(uuid,uuid,text,text,text,text,bigint,text,text,uuid) from public,anon,authenticated;
revoke all on function public.queue_customer_message(uuid,uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.register_attachment(uuid,uuid,text,text,text,text,bigint,text,text,uuid) to authenticated;
grant execute on function public.queue_customer_message(uuid,uuid,text,integer,text,text) to authenticated;
