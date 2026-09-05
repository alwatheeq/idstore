-- Auditable CRM contact and communication-consent maintenance.
create or replace function public.add_customer_contact(p_customer_id uuid,p_kind text,p_value text,p_normalized_value text,p_is_primary boolean)
returns public.customer_contacts language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers%rowtype; v_contact public.customer_contacts%rowtype;
begin
  select * into strict v_customer from public.customers where id=p_customer_id;
  if not app_private.has_permission(v_customer.organization_id,v_customer.preferred_branch_id,'crm.manage') then raise exception 'Not authorized to manage this customer' using errcode='42501'; end if;
  if v_customer.status<>'active' or p_kind not in ('mobile','phone','email','whatsapp') or nullif(trim(p_value),'') is null or nullif(trim(p_normalized_value),'') is null then raise exception 'Contact details are invalid' using errcode='22023'; end if;
  select * into v_contact from public.customer_contacts where organization_id=v_customer.organization_id and customer_id=v_customer.id and kind=p_kind and normalized_value=trim(p_normalized_value);
  if found then return v_contact; end if;
  if p_is_primary then update public.customer_contacts set is_primary=false where customer_id=v_customer.id and kind=p_kind and is_primary; end if;
  insert into public.customer_contacts(organization_id,customer_id,kind,value,normalized_value,is_primary) values(v_customer.organization_id,v_customer.id,p_kind,trim(p_value),trim(p_normalized_value),p_is_primary) returning * into v_contact;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_customer.organization_id,auth.uid(),'customer.contact_added','customer',v_customer.id,jsonb_build_object('kind',p_kind,'contact_id',v_contact.id));
  return v_contact;
end; $$;

create or replace function public.record_customer_consent(p_customer_id uuid,p_purpose text,p_channel text,p_state text,p_policy_version text,p_source text)
returns public.consents language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers%rowtype; v_consent public.consents%rowtype;
begin
  select * into strict v_customer from public.customers where id=p_customer_id;
  if not app_private.has_permission(v_customer.organization_id,v_customer.preferred_branch_id,'crm.manage') then raise exception 'Not authorized to record consent' using errcode='42501'; end if;
  if p_state not in ('granted','withdrawn') or p_channel not in ('email','sms','whatsapp','push','phone') or nullif(trim(p_purpose),'') is null or nullif(trim(p_policy_version),'') is null or nullif(trim(p_source),'') is null then raise exception 'Consent evidence is incomplete' using errcode='22023'; end if;
  insert into public.consents(organization_id,customer_id,purpose,channel,state,policy_version,source,recorded_by) values(v_customer.organization_id,v_customer.id,trim(p_purpose),p_channel,p_state,trim(p_policy_version),trim(p_source),auth.uid()) returning * into v_consent;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_customer.organization_id,auth.uid(),'customer.consent_'||p_state,'customer',v_customer.id,jsonb_build_object('purpose',p_purpose,'channel',p_channel,'policy_version',p_policy_version));
  return v_consent;
end; $$;

revoke all on function public.add_customer_contact(uuid,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.record_customer_consent(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.add_customer_contact(uuid,text,text,text,boolean) to authenticated;
grant execute on function public.record_customer_consent(uuid,text,text,text,text,text) to authenticated;
