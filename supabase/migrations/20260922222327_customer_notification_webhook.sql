-- Admin-managed customer notification transport. No payment/fiscal events are dispatched.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table integration.customer_webhooks (
 organization_id uuid primary key references public.organizations(id),
 endpoint text not null, signing_secret text not null, enabled boolean not null default false,
 version bigint not null default 1, updated_at timestamptz not null default now()
);
create table integration.notification_deliveries (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 event_id uuid unique references integration.outbox_events(id),
 is_test boolean not null default false, state text not null default 'pending' check(state in ('pending','sending','accepted','retry','failed','suppressed')),
 attempts integer not null default 0, request_id bigint, config_version bigint,
 status_code integer, error_code text, next_attempt_at timestamptz not null default now(),
 attempted_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(),
 check((event_id is null)=is_test)
);
create index notification_delivery_due on integration.notification_deliveries(state,next_attempt_at);
alter table integration.customer_webhooks enable row level security;
alter table integration.notification_deliveries enable row level security;
revoke all on integration.customer_webhooks,integration.notification_deliveries from public,anon,authenticated;
-- Transport headers and response bodies are private, including on newly installed pg_net.
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke execute on all functions in schema net from public,anon,authenticated;

create function app_private.valid_notification_webhook(p_url text) returns boolean
language sql immutable set search_path='' as $$
 select p_url is not null and length(p_url)<=2048
 and p_url ~ '^https://([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(:443)?(/[^[:space:]#]*)?$'
 and lower(split_part(split_part(substr(p_url,9),'/',1),':',1)) !~ '(^|\.)(localhost|local|internal|test|invalid|example|onion)$';
$$;
revoke all on function app_private.valid_notification_webhook(text) from public,anon,authenticated;

create function public.save_notification_webhook(p_organization_id uuid,p_endpoint text,p_secret text,p_enabled boolean,p_version bigint)
returns void language plpgsql security definer set search_path='' as $$
declare current_config integration.customer_webhooks%rowtype; secret text;
begin
 if not app_private.is_admin(p_organization_id) then raise exception 'Only administrators can configure customer notifications' using errcode='42501'; end if;
 -- Serialize the first save as well as subsequent edits.
 perform 1 from public.organizations where id=p_organization_id for update;
 select * into current_config from integration.customer_webhooks where organization_id=p_organization_id for update;
 if coalesce(current_config.version,0) is distinct from p_version then raise exception 'Settings changed; refresh first' using errcode='40001'; end if;
 if not app_private.valid_notification_webhook(trim(p_endpoint)) or p_enabled is null then raise exception 'Use a public HTTPS webhook URL on port 443, without credentials or fragments.' using errcode='22023'; end if;
 secret:=coalesce(nullif(trim(p_secret),''),current_config.signing_secret);
 if secret is null or length(secret)<32 or length(secret)>256 then raise exception 'Enter a signing secret between 32 and 256 characters.' using errcode='22023'; end if;
 insert into integration.customer_webhooks(organization_id,endpoint,signing_secret,enabled)
 values(p_organization_id,trim(p_endpoint),secret,p_enabled)
 on conflict(organization_id) do update set endpoint=excluded.endpoint,signing_secret=excluded.signing_secret,enabled=excluded.enabled,version=integration.customer_webhooks.version+1,updated_at=clock_timestamp();
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(p_organization_id,auth.uid(),'notifications.webhook_saved','organization',p_organization_id,jsonb_build_object('enabled',p_enabled));
end; $$;

create function public.notification_webhook_settings(p_organization_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.is_admin(p_organization_id) then raise exception 'Only administrators can view webhook settings' using errcode='42501'; end if;
 return jsonb_build_object('config',coalesce((select jsonb_build_object('endpoint',endpoint,'enabled',enabled,'version',version,'secret_configured',true) from integration.customer_webhooks where organization_id=p_organization_id),jsonb_build_object('endpoint','','enabled',false,'version',0,'secret_configured',false)),
 'deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc) from (select id,is_test,state,attempts,status_code,error_code,created_at,attempted_at,completed_at,config_version from integration.notification_deliveries where organization_id=p_organization_id order by created_at desc,id desc limit 25) d),'[]'::jsonb));
end; $$;

create function public.notification_webhook_status(p_organization_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.is_member(p_organization_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 return exists(select 1 from integration.customer_webhooks where organization_id=p_organization_id and enabled);
end; $$;

create function public.test_notification_webhook(p_organization_id uuid,p_version bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare config integration.customer_webhooks%rowtype; delivery uuid;
begin
 if not app_private.is_admin(p_organization_id) then raise exception 'Only administrators can test notifications' using errcode='42501'; end if;
 select * into strict config from integration.customer_webhooks where organization_id=p_organization_id for update;
 if config.version is distinct from p_version then raise exception 'Settings changed; refresh first' using errcode='40001'; end if;
 if exists(select 1 from integration.notification_deliveries where organization_id=p_organization_id and is_test and created_at>clock_timestamp()-interval '1 minute') then raise exception 'Wait one minute before sending another test.' using errcode='22023'; end if;
 insert into integration.notification_deliveries(organization_id,is_test,config_version) values(p_organization_id,true,config.version) returning id into delivery;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id) values(p_organization_id,auth.uid(),'notifications.test_requested','notification_delivery',delivery);
 return delivery;
end; $$;

create function public.retry_notification_webhook(p_delivery_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare d integration.notification_deliveries%rowtype;
begin
 select * into strict d from integration.notification_deliveries where id=p_delivery_id for update;
 if not app_private.is_admin(d.organization_id) then raise exception 'Only administrators can retry notifications' using errcode='42501'; end if;
 if d.state<>'failed' or d.is_test then raise exception 'Only failed customer notifications can be retried.' using errcode='22023'; end if;
 update integration.notification_deliveries set state='retry',attempts=0,next_attempt_at=clock_timestamp(),error_code=null,request_id=null where id=d.id;
 update public.messages set status='queued' where id=(select aggregate_id from integration.outbox_events where id=d.event_id) and status='failed';
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id) values(d.organization_id,auth.uid(),'notifications.retry_requested','notification_delivery',d.id);
end; $$;

create function app_private.dispatch_customer_notifications() returns void
language plpgsql security definer set search_path='' as $$
declare d integration.notification_deliveries%rowtype; c integration.customer_webhooks%rowtype; e integration.outbox_events%rowtype;
 m public.messages%rowtype; response record; body jsonb; stamp text; request bigint; recipient text; v_purpose text; consent text; customer_name text;
begin
 if not pg_try_advisory_xact_lock(824137520) then return; end if;
 -- Acknowledgment means accepted by the webhook, not delivered to the customer.
 for d in select * from integration.notification_deliveries where state='sending' order by attempted_at limit 100 for update skip locked loop
  select status_code,timed_out,error_msg into response from net._http_response where id=d.request_id;
  if not found and d.attempted_at>clock_timestamp()-interval '2 minutes' then continue; end if;
  if response.status_code between 200 and 299 and not coalesce(response.timed_out,false) and response.error_msg is null then
   update integration.notification_deliveries set state='accepted',status_code=response.status_code,error_code=null,completed_at=clock_timestamp() where id=d.id;
   if d.event_id is not null then
    update integration.outbox_events set published_at=clock_timestamp() where id=d.event_id;
    update public.messages set status='sent',sent_at=clock_timestamp(),provider_ref='webhook:'||d.id::text where id=(select aggregate_id from integration.outbox_events where id=d.event_id) and status='queued';
   end if;
  else
   update integration.notification_deliveries set state=case when attempts>=5 then 'failed' else 'retry' end,status_code=response.status_code,
    error_code=case when response.status_code is not null then 'http_error' else 'network_or_timeout' end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,60*power(2,attempts-1)::integer)) where id=d.id;
   if d.attempts>=5 and d.event_id is not null then update public.messages set status='failed' where id=(select aggregate_id from integration.outbox_events where id=d.event_id) and status='queued'; end if;
  end if;
 end loop;
 -- Strict event allowlist: financial events never enter this transport.
 insert into integration.notification_deliveries(organization_id,event_id)
 select ev.organization_id,ev.id from integration.outbox_events ev join integration.customer_webhooks cfg on cfg.organization_id=ev.organization_id and cfg.enabled
 join public.messages msg on msg.id=ev.aggregate_id and msg.organization_id=ev.organization_id and msg.status='queued'
 where ev.event_type='message.queued' and ev.aggregate_type='message' and ev.published_at is null and not exists(select 1 from integration.notification_deliveries nd where nd.event_id=ev.id)
 order by ev.created_at limit 100 on conflict(event_id) do nothing;
 for d in select dd.* from integration.notification_deliveries dd join integration.customer_webhooks cfg using(organization_id)
 where dd.state in ('pending','retry') and dd.next_attempt_at<=clock_timestamp() and (cfg.enabled or dd.is_test)
 order by dd.next_attempt_at,dd.id limit 50 for update of dd skip locked loop
  select * into strict c from integration.customer_webhooks where organization_id=d.organization_id for share;
  if not c.enabled and not d.is_test then continue; end if;
  if d.is_test then
   if c.version is distinct from d.config_version then update integration.notification_deliveries set state='failed',error_code='settings_changed' where id=d.id; continue; end if;
   body:=jsonb_build_object('schema_version',1,'event_id',d.id,'event_type','notification.test','organization_id',d.organization_id,'created_at',d.created_at,'data',jsonb_build_object('message','IDstore webhook test'));
  else
   select * into strict e from integration.outbox_events where id=d.event_id;
   if e.event_type<>'message.queued' or e.aggregate_type<>'message' then raise exception 'Invalid notification event'; end if;
   select * into strict m from public.messages where id=e.aggregate_id and organization_id=d.organization_id for update;
   if m.status<>'queued' then update integration.notification_deliveries set state='suppressed',error_code='message_not_queued' where id=d.id; continue; end if;
   select display_name into customer_name from public.customers where id=m.customer_id and organization_id=d.organization_id and status='active';
   v_purpose:=case when m.template_code='APPOINTMENT_REMINDER' then 'appointment_reminders' else 'service_updates' end;
   select state into consent from public.consents where customer_id=m.customer_id and organization_id=d.organization_id and channel=m.channel and public.consents.purpose=v_purpose order by recorded_at desc,id desc limit 1;
   if customer_name is null or consent is distinct from 'granted' then
    update integration.notification_deliveries set state='suppressed',error_code='customer_or_consent' where id=d.id;
    update public.messages set status='suppressed' where id=m.id; continue;
   end if;
   select normalized_value into recipient from public.customer_contacts where customer_id=m.customer_id and organization_id=d.organization_id
    and kind=case m.channel when 'sms' then 'mobile' when 'email' then 'email' when 'whatsapp' then 'whatsapp' else 'unsupported' end order by is_primary desc,created_at desc,id limit 1;
   if recipient is null or m.template_code not in ('APPOINTMENT_CONFIRMATION','APPOINTMENT_REMINDER','ESTIMATE_READY','VEHICLE_READY','INVOICE_ISSUED','SERVICE_FOLLOW_UP') then
    update integration.notification_deliveries set state='failed',error_code='recipient_or_template' where id=d.id;
    update public.messages set status='failed' where id=m.id; continue;
   end if;
   body:=jsonb_build_object('schema_version',1,'event_id',e.id,'event_type','message.queued','organization_id',d.organization_id,'created_at',e.created_at,
    'data',jsonb_build_object('message_id',m.id,'customer_id',m.customer_id,'customer_name',customer_name,'branch_id',m.branch_id,'channel',m.channel,'recipient',recipient,'template_code',m.template_code,'template_version',m.template_version,'reference',m.dedupe_key));
  end if;
  stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;
  request:=net.http_post(url:=c.endpoint,body:=body,headers:=jsonb_build_object('Content-Type','application/json','X-IDstore-Event-ID',body->>'event_id','X-IDstore-Timestamp',stamp,'X-IDstore-Signature','sha256='||encode(extensions.hmac(convert_to(stamp||'.'||body::text,'UTF8'),convert_to(c.signing_secret,'UTF8'),'sha256'),'hex')),timeout_milliseconds:=10000);
  update integration.notification_deliveries set state='sending',attempts=attempts+1,request_id=request,config_version=c.version,attempted_at=clock_timestamp(),status_code=null,error_code=null where id=d.id;
 end loop;
end; $$;
revoke all on function app_private.dispatch_customer_notifications() from public,anon,authenticated;
revoke all on function public.save_notification_webhook(uuid,text,text,boolean,bigint),public.notification_webhook_settings(uuid),public.notification_webhook_status(uuid),public.test_notification_webhook(uuid,bigint),public.retry_notification_webhook(uuid) from public,anon;
grant execute on function public.save_notification_webhook(uuid,text,text,boolean,bigint),public.notification_webhook_settings(uuid),public.notification_webhook_status(uuid),public.test_notification_webhook(uuid,bigint),public.retry_notification_webhook(uuid) to authenticated;
select cron.schedule('idstore-customer-notifications','* * * * *','select app_private.dispatch_customer_notifications()');
