-- Customer identities are separate from Admin/Staff memberships. Curated RPCs
-- avoid granting customer Auth users direct access to internal table columns.

create or replace function public.provision_customer_portal(p_customer_id uuid,p_auth_user_id uuid)
returns public.customer_accounts language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers%rowtype; v_account public.customer_accounts%rowtype;
begin
  select * into strict v_customer from public.customers where id=p_customer_id;
  if not app_private.is_admin(v_customer.organization_id) then raise exception 'Only administrators can provision customer portal access' using errcode='42501'; end if;
  if v_customer.status<>'active' or not exists(select 1 from auth.users where id=p_auth_user_id) then raise exception 'Active customer and Auth identity are required' using errcode='23514'; end if;
  insert into public.customer_accounts(organization_id,customer_id,auth_user_id,status,verified_at)
  values(v_customer.organization_id,v_customer.id,p_auth_user_id,'active',now())
  on conflict(organization_id,auth_user_id) do update set customer_id=excluded.customer_id,status='active',verified_at=now()
  returning * into v_account;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_customer.organization_id,auth.uid(),'customer_portal.provisioned','customer',v_customer.id,jsonb_build_object('portal_user_id',p_auth_user_id));
  return v_account;
end; $$;

create or replace function public.portal_identity()
returns table(organization_id uuid,customer_id uuid,display_name text,preferred_locale text)
language sql stable security definer set search_path = '' as $$
  select a.organization_id,a.customer_id,c.display_name,c.preferred_locale
  from public.customer_accounts a join public.customers c on c.id=a.customer_id and c.organization_id=a.organization_id
  where a.auth_user_id=auth.uid() and a.status='active' and c.status='active' limit 1
$$;

create or replace function public.portal_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_account public.customer_accounts%rowtype; v_customer public.customers%rowtype;
begin
  select * into v_account from public.customer_accounts where auth_user_id=auth.uid() and status='active' limit 1;
  if not found then raise exception 'Active customer portal account not found' using errcode='42501'; end if;
  select * into strict v_customer from public.customers where id=v_account.customer_id and status='active';
  return jsonb_build_object(
    'customer',jsonb_build_object('display_name',v_customer.display_name,'preferred_locale',v_customer.preferred_locale),
    'vehicles',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'vin',v.vin,'registration_no',v.registration_no,'model_year',v.model_year,'model',m.name,'status',v.status) order by v.created_at desc) from public.vehicle_ownerships o join public.vehicles v on v.id=o.vehicle_id left join public.vehicle_models m on m.id=v.model_id where o.customer_id=v_customer.id and o.organization_id=v_account.organization_id and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>=current_date)),'[]'::jsonb),
    'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'start_at',a.start_at,'end_at',a.end_at,'status',a.status,'channel',a.channel,'branch',b.display_name,'city',b.city,'vehicle_id',a.vehicle_id) order by a.start_at desc) from public.appointments a join public.branches b on b.id=a.branch_id where a.customer_id=v_customer.id and a.organization_id=v_account.organization_id),'[]'::jsonb),
    'repair_orders',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'ro_number',r.ro_number,'status',r.status,'opened_at',r.opened_at,'promised_at',r.promised_at,'vehicle_id',r.vehicle_id,'branch',b.display_name,'city',b.city) order by r.opened_at desc) from public.repair_orders r join public.branches b on b.id=r.branch_id where r.customer_id=v_customer.id and r.organization_id=v_account.organization_id),'[]'::jsonb),
    'estimates',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'repair_order_id',e.repair_order_id,'version_no',e.version_no,'status',e.status,'currency',e.currency,'grand_total',e.grand_total,'expires_at',e.expires_at,'document_hash',e.document_hash,'lines',(select coalesce(jsonb_agg(jsonb_build_object('line_no',l.line_no,'description',l.description_snapshot,'quantity',l.quantity,'unit_price',l.unit_price,'tax_amount',l.tax_amount,'line_total',l.line_total) order by l.line_no),'[]'::jsonb) from public.estimate_lines l where l.estimate_version_id=e.id)) order by e.created_at desc) from public.estimate_versions e join public.repair_orders r on r.id=e.repair_order_id where r.customer_id=v_customer.id and e.organization_id=v_account.organization_id and e.status<>'draft'),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'invoice_number',i.invoice_number,'status',i.status,'currency',i.currency,'grand_total',i.grand_total,'paid_total',i.paid_total,'posted_at',i.posted_at,'document_hash',i.document_hash) order by i.posted_at desc) from public.invoices i where i.customer_id=v_customer.id and i.organization_id=v_account.organization_id and i.status<>'draft'),'[]'::jsonb),
    'recommendations',coalesce((select jsonb_agg(jsonb_build_object('id',vr.id,'vehicle_id',vr.vehicle_id,'description',vr.description,'severity',vr.severity,'status',vr.status,'due_date',vr.due_date,'due_odometer_km',vr.due_odometer_km) order by vr.created_at desc) from public.vehicle_recommendations vr where vr.organization_id=v_account.organization_id and vr.vehicle_id in(select o.vehicle_id from public.vehicle_ownerships o where o.customer_id=v_customer.id and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>=current_date))),'[]'::jsonb)
  );
end; $$;

create or replace function public.portal_record_estimate_decision(p_estimate_id uuid,p_decision text,p_evidence_note text)
returns public.estimate_versions language plpgsql security definer set search_path = '' as $$
declare v_account public.customer_accounts%rowtype; v_customer public.customers%rowtype; v_estimate public.estimate_versions%rowtype; v_order public.repair_orders%rowtype; v_to text;
begin
  select * into v_account from public.customer_accounts where auth_user_id=auth.uid() and status='active' limit 1;
  if not found then raise exception 'Active customer portal account not found' using errcode='42501'; end if;
  select * into strict v_customer from public.customers where id=v_account.customer_id and status='active';
  select e.* into strict v_estimate from public.estimate_versions e join public.repair_orders r on r.id=e.repair_order_id where e.id=p_estimate_id and e.organization_id=v_account.organization_id and r.customer_id=v_account.customer_id for update of e;
  if v_estimate.status<>'sent' or p_decision not in ('approved','declined') or (v_estimate.expires_at is not null and v_estimate.expires_at<now()) then raise exception 'Estimate is not awaiting a valid decision' using errcode='22023'; end if;
  insert into public.estimate_approvals(organization_id,branch_id,estimate_version_id,decision,actor_name,channel,evidence_json)
  values(v_estimate.organization_id,v_estimate.branch_id,v_estimate.id,p_decision,v_customer.display_name,'portal',jsonb_strip_nulls(jsonb_build_object('note',nullif(trim(p_evidence_note),''),'portal_user_id',auth.uid())));
  update public.estimate_versions set status=p_decision where id=v_estimate.id returning * into v_estimate;
  update public.findings f set status=p_decision where f.id in(select l.source_id from public.estimate_lines l where l.estimate_version_id=v_estimate.id and l.source_id is not null);
  select * into strict v_order from public.repair_orders where id=v_estimate.repair_order_id for update;
  if v_order.status='awaiting_approval' then v_to:=case when p_decision='approved' then 'approved' else 'diagnosis' end; update public.repair_orders set status=v_to where id=v_order.id; insert into public.repair_order_events(organization_id,branch_id,repair_order_id,from_status,to_status,reason,actor_id) values(v_order.organization_id,v_order.branch_id,v_order.id,'awaiting_approval',v_to,'Customer '||p_decision||' estimate in portal',auth.uid()); end if;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_estimate.organization_id,auth.uid(),'estimate.'||p_decision,'estimate',v_estimate.id,jsonb_build_object('channel','portal','customer_id',v_customer.id));
  return v_estimate;
end; $$;

revoke all on function public.provision_customer_portal(uuid,uuid) from public,anon,authenticated;
revoke all on function public.portal_identity() from public,anon,authenticated;
revoke all on function public.portal_dashboard() from public,anon,authenticated;
revoke all on function public.portal_record_estimate_decision(uuid,text,text) from public,anon,authenticated;
grant execute on function public.provision_customer_portal(uuid,uuid) to authenticated;
grant execute on function public.portal_identity() to authenticated;
grant execute on function public.portal_dashboard() to authenticated;
grant execute on function public.portal_record_estimate_decision(uuid,text,text) to authenticated;
