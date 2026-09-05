-- Finance corrections, cash reconciliation, quality release, and advisory campaigns.

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  credit_note_id uuid not null references public.credit_notes(id) on delete restrict,
  amount numeric(18,3) not null check (amount > 0),
  reason text not null,
  provider_ref text,
  idempotency_key text not null,
  status text not null default 'recorded' check (status in ('pending','recorded','failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.quality_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_order_id uuid not null references public.repair_orders(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  checklist_version text not null,
  result text not null check (result in ('pass','fail')),
  notes text,
  signed_by uuid not null references auth.users(id) on delete restrict,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.service_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  source_reference text not null,
  status text not null default 'draft' check (status in ('draft','verified','retired')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check ((status = 'verified' and verified_at is not null and verified_by is not null) or status <> 'verified')
);

create table public.campaign_vehicle_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.service_campaigns(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  repair_order_id uuid references public.repair_orders(id) on delete restrict,
  match_basis text not null,
  status text not null default 'advisory' check (status in ('advisory','confirmed','completed','not_applicable')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, vehicle_id)
);

create index payment_refunds_payment_idx on public.payment_refunds(payment_id, created_at);
create index quality_checks_order_idx on public.quality_checks(repair_order_id, signed_at desc);
create index campaign_matches_vehicle_idx on public.campaign_vehicle_matches(vehicle_id, status);

create trigger assert_branch_organization before insert or update of organization_id, branch_id on public.payment_refunds for each row execute function app_private.assert_branch_organization();
create trigger assert_branch_organization before insert or update of organization_id, branch_id on public.quality_checks for each row execute function app_private.assert_branch_organization();
create trigger touch_service_campaigns_updated_at before update on public.service_campaigns for each row execute function app_private.touch_updated_at();
create trigger touch_campaign_vehicle_matches_updated_at before update on public.campaign_vehicle_matches for each row execute function app_private.touch_updated_at();

alter table public.payment_refunds enable row level security;
alter table public.quality_checks enable row level security;
alter table public.service_campaigns enable row level security;
alter table public.campaign_vehicle_matches enable row level security;
create policy payment_refunds_select on public.payment_refunds for select to authenticated using (app_private.has_branch_access(organization_id, branch_id));
create policy quality_checks_select on public.quality_checks for select to authenticated using (app_private.has_branch_access(organization_id, branch_id));
create policy service_campaigns_select on public.service_campaigns for select to authenticated using (app_private.is_member(organization_id));
create policy campaign_vehicle_matches_select on public.campaign_vehicle_matches for select to authenticated using (app_private.is_member(organization_id));
grant select on public.payment_refunds, public.quality_checks, public.service_campaigns, public.campaign_vehicle_matches to authenticated;

create or replace function app_private.protect_posted_invoice()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then raise exception 'Posted invoices are immutable; create a credit note' using errcode = '55000'; end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if (to_jsonb(new) - array['paid_total','status','updated_at','version']) <> (to_jsonb(old) - array['paid_total','status','updated_at','version']) then
      raise exception 'Posted invoice commercial fields are immutable' using errcode = '55000';
    end if;
    if new.paid_total < old.paid_total or new.paid_total > old.grand_total then raise exception 'Invalid paid total' using errcode = '23514'; end if;
    if new.status = 'credited' then
      if coalesce((select sum(c.grand_total) from public.credit_notes c where c.invoice_id = old.id),0) < old.grand_total then
        raise exception 'Invoice is not fully credited' using errcode = '23514';
      end if;
    elsif new.status <> (case when new.paid_total = new.grand_total then 'paid' when new.paid_total > 0 then 'partially_paid' else 'posted' end) then
      raise exception 'Invoice payment state does not match paid total' using errcode = '23514';
    end if;
  end if;
  return coalesce(new,old);
end; $$;

create or replace function public.post_credit_note(p_invoice_id uuid, p_reason text, p_lines jsonb)
returns public.credit_notes language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.invoices%rowtype; v_credit public.credit_notes%rowtype; v_line public.invoice_lines%rowtype;
  v_item jsonb; v_quantity numeric; v_credited numeric; v_line_total numeric; v_tax numeric;
  v_number text; v_subtotal numeric := 0; v_tax_total numeric := 0; v_total numeric := 0; v_branch_code text;
begin
  select * into strict v_invoice from public.invoices where id=p_invoice_id for update;
  if not app_private.has_permission(v_invoice.organization_id,v_invoice.branch_id,'invoice.post') then raise exception 'Not authorized to post credit notes' using errcode='42501'; end if;
  if v_invoice.status not in ('posted','partially_paid','paid') then raise exception 'Invoice cannot be credited in its current state' using errcode='22023'; end if;
  if nullif(trim(p_reason),'') is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)=0 then raise exception 'Credit reason and lines are required' using errcode='22023'; end if;
  select code into strict v_branch_code from public.branches where id=v_invoice.branch_id;
  select document_number into strict v_number from app_private.take_document_number(v_invoice.organization_id,v_invoice.branch_id,'credit_note',v_branch_code||'-CN-');
  insert into public.credit_notes(organization_id,branch_id,invoice_id,credit_number,reason,posted_by)
  values(v_invoice.organization_id,v_invoice.branch_id,v_invoice.id,v_number,trim(p_reason),auth.uid()) returning * into v_credit;
  for v_item in select value from jsonb_array_elements(p_lines) loop
    if not (v_item ? 'invoice_line_id' and v_item ? 'quantity') then raise exception 'Each credit line requires invoice_line_id and quantity' using errcode='22023'; end if;
    select * into strict v_line from public.invoice_lines where id=(v_item->>'invoice_line_id')::uuid and invoice_id=v_invoice.id for update;
    v_quantity := (v_item->>'quantity')::numeric;
    select coalesce(sum(cl.quantity),0) into v_credited from public.credit_note_lines cl join public.credit_notes cn on cn.id=cl.credit_note_id where cl.invoice_line_id=v_line.id;
    if v_quantity <= 0 or v_quantity > v_line.quantity-v_credited then raise exception 'Credit quantity exceeds the uncredited invoice quantity' using errcode='23514'; end if;
    v_line_total := round(v_line.line_total * v_quantity / v_line.quantity,3);
    v_tax := round(v_line.tax_amount * v_quantity / v_line.quantity,3);
    insert into public.credit_note_lines(organization_id,branch_id,credit_note_id,invoice_line_id,quantity,tax_amount,line_total)
    values(v_invoice.organization_id,v_invoice.branch_id,v_credit.id,v_line.id,v_quantity,v_tax,v_line_total);
    v_total := v_total + v_line_total; v_tax_total := v_tax_total + v_tax; v_subtotal := v_subtotal + v_line_total-v_tax;
  end loop;
  update public.credit_notes set subtotal=round(v_subtotal,3),tax_total=round(v_tax_total,3),grand_total=round(v_total,3),
    document_hash=encode(extensions.digest(concat_ws('|',id::text,credit_number,invoice_id::text,round(v_total,3)::text),'sha256'),'hex') where id=v_credit.id returning * into v_credit;
  if coalesce((select sum(grand_total) from public.credit_notes where invoice_id=v_invoice.id),0) >= v_invoice.grand_total then update public.invoices set status='credited' where id=v_invoice.id; end if;
  insert into integration.outbox_events(organization_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
  values(v_invoice.organization_id,'credit_note.posted','credit_note',v_credit.id,jsonb_build_object('credit_note_id',v_credit.id,'invoice_id',v_invoice.id),'credit_note.posted:'||v_credit.id::text);
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_invoice.organization_id,auth.uid(),'credit_note.posted','credit_note',v_credit.id,jsonb_build_object('invoice_id',v_invoice.id,'total',v_credit.grand_total));
  return v_credit;
end; $$;

create or replace function public.record_payment_refund(p_payment_id uuid,p_credit_note_id uuid,p_amount numeric,p_reason text,p_provider_ref text,p_idempotency_key text)
returns public.payment_refunds language plpgsql security definer set search_path = '' as $$
declare v_payment public.payments%rowtype; v_credit public.credit_notes%rowtype; v_refund public.payment_refunds%rowtype; v_payment_refunded numeric; v_credit_refunded numeric;
begin
  select * into v_refund from public.payment_refunds where organization_id=(select organization_id from public.payments where id=p_payment_id) and idempotency_key=p_idempotency_key;
  if found then return v_refund; end if;
  select * into strict v_payment from public.payments where id=p_payment_id for update;
  select * into strict v_credit from public.credit_notes where id=p_credit_note_id;
  if not app_private.has_permission(v_payment.organization_id,v_payment.branch_id,'payment.refund') then raise exception 'Not authorized to record refunds' using errcode='42501'; end if;
  if v_credit.organization_id<>v_payment.organization_id or v_credit.branch_id<>v_payment.branch_id or not exists(select 1 from public.payment_allocations a where a.payment_id=v_payment.id and a.invoice_id=v_credit.invoice_id) then raise exception 'Refund payment and credit note do not reconcile' using errcode='23514'; end if;
  if nullif(trim(p_reason),'') is null or nullif(trim(p_idempotency_key),'') is null or p_amount<=0 then raise exception 'Refund amount, reason and idempotency key are required' using errcode='22023'; end if;
  select coalesce(sum(amount),0) into v_payment_refunded from public.payment_refunds where payment_id=v_payment.id and status='recorded';
  select coalesce(sum(amount),0) into v_credit_refunded from public.payment_refunds where credit_note_id=v_credit.id and status='recorded';
  if p_amount>v_payment.amount-v_payment_refunded or p_amount>v_credit.grand_total-v_credit_refunded then raise exception 'Refund exceeds payment or credit-note balance' using errcode='23514'; end if;
  insert into public.payment_refunds(organization_id,branch_id,payment_id,credit_note_id,amount,reason,provider_ref,idempotency_key,status,created_by)
  values(v_payment.organization_id,v_payment.branch_id,v_payment.id,v_credit.id,p_amount,trim(p_reason),nullif(trim(p_provider_ref),''),trim(p_idempotency_key),'recorded',auth.uid()) returning * into v_refund;
  update public.payments set status=case when v_payment_refunded+p_amount=v_payment.amount then 'refunded' else 'partially_refunded' end where id=v_payment.id;
  insert into integration.outbox_events(organization_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key) values(v_payment.organization_id,'payment.refunded','payment_refund',v_refund.id,jsonb_build_object('refund_id',v_refund.id,'payment_id',v_payment.id),'payment.refunded:'||v_refund.id::text);
  return v_refund;
end; $$;

create or replace function public.open_cash_session(p_branch_id uuid,p_register_code text,p_opening_float numeric)
returns public.cash_sessions language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_session public.cash_sessions%rowtype;
begin
  select organization_id into strict v_org from public.branches where id=p_branch_id and status='active';
  if not app_private.has_permission(v_org,p_branch_id,'payment.receive') then raise exception 'Not authorized to open this register' using errcode='42501'; end if;
  if nullif(trim(p_register_code),'') is null or p_opening_float<0 then raise exception 'Register and non-negative opening float are required' using errcode='22023'; end if;
  insert into public.cash_sessions(organization_id,branch_id,staff_user_id,register_code,opening_float) values(v_org,p_branch_id,auth.uid(),upper(trim(p_register_code)),p_opening_float) returning * into v_session;
  return v_session;
end; $$;

create or replace function public.close_cash_session(p_session_id uuid,p_counted_close numeric)
returns public.cash_sessions language plpgsql security definer set search_path = '' as $$
declare v_session public.cash_sessions%rowtype; v_expected numeric;
begin
  select * into strict v_session from public.cash_sessions where id=p_session_id for update;
  if v_session.staff_user_id<>auth.uid() or not app_private.has_permission(v_session.organization_id,v_session.branch_id,'payment.receive') then raise exception 'Only the owning cashier can close this register' using errcode='42501'; end if;
  if v_session.status<>'open' or p_counted_close<0 then raise exception 'Open session and non-negative count are required' using errcode='22023'; end if;
  select v_session.opening_float + coalesce(sum(p.amount),0) - coalesce((select sum(r.amount) from public.payment_refunds r join public.payments rp on rp.id=r.payment_id where rp.method='cash' and rp.received_by=v_session.staff_user_id and r.branch_id=v_session.branch_id and r.created_at>=v_session.opened_at and r.status='recorded'),0)
  into v_expected from public.payments p where p.branch_id=v_session.branch_id and p.received_by=v_session.staff_user_id and p.method='cash' and p.received_at>=v_session.opened_at and p.status in ('received','partially_refunded','refunded');
  update public.cash_sessions set expected_close=round(v_expected,3),counted_close=round(p_counted_close,3),variance=round(p_counted_close-v_expected,3),status='closed',closed_at=now() where id=v_session.id returning * into v_session;
  return v_session;
end; $$;

create or replace function public.approve_cash_session(p_session_id uuid)
returns public.cash_sessions language plpgsql security definer set search_path = '' as $$
declare v_session public.cash_sessions%rowtype;
begin
  select * into strict v_session from public.cash_sessions where id=p_session_id for update;
  if not app_private.has_permission(v_session.organization_id,v_session.branch_id,'payment.refund') then raise exception 'Not authorized to approve cash variances' using errcode='42501'; end if;
  if v_session.status<>'closed' then raise exception 'Only a closed session can be approved' using errcode='22023'; end if;
  update public.cash_sessions set status='approved' where id=v_session.id returning * into v_session;
  return v_session;
end; $$;

create or replace function public.record_quality_check(p_repair_order_id uuid,p_job_id uuid,p_checklist_version text,p_result text,p_notes text)
returns public.quality_checks language plpgsql security definer set search_path = '' as $$
declare v_order public.repair_orders%rowtype; v_check public.quality_checks%rowtype;
begin
  select * into strict v_order from public.repair_orders where id=p_repair_order_id;
  if not app_private.has_permission(v_order.organization_id,v_order.branch_id,'repair_order.manage') then raise exception 'Not authorized to sign quality checks' using errcode='42501'; end if;
  if v_order.status not in ('qc','ready') or p_result not in ('pass','fail') or nullif(trim(p_checklist_version),'') is null then raise exception 'Quality check values or repair-order state are invalid' using errcode='22023'; end if;
  if p_job_id is not null and not exists(select 1 from public.jobs where id=p_job_id and repair_order_id=v_order.id) then raise exception 'Quality-check job does not belong to repair order' using errcode='23514'; end if;
  insert into public.quality_checks(organization_id,branch_id,repair_order_id,job_id,checklist_version,result,notes,signed_by) values(v_order.organization_id,v_order.branch_id,v_order.id,p_job_id,trim(p_checklist_version),p_result,nullif(trim(p_notes),''),auth.uid()) returning * into v_check;
  return v_check;
end; $$;

create or replace function public.create_service_campaign(p_organization_id uuid,p_code text,p_title text,p_description text,p_source_reference text)
returns public.service_campaigns language plpgsql security definer set search_path = '' as $$
declare v_campaign public.service_campaigns%rowtype;
begin
  if not app_private.has_permission(p_organization_id,null,'branch.manage') then raise exception 'Not authorized to manage campaigns' using errcode='42501'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_title),'') is null or nullif(trim(p_source_reference),'') is null then raise exception 'Campaign code, title and source reference are required' using errcode='22023'; end if;
  insert into public.service_campaigns(organization_id,code,title,description,source_reference,created_by) values(p_organization_id,upper(trim(p_code)),trim(p_title),nullif(trim(p_description),''),trim(p_source_reference),auth.uid()) returning * into v_campaign;
  return v_campaign;
end; $$;

create or replace function public.transition_service_campaign(p_campaign_id uuid,p_to_status text)
returns public.service_campaigns language plpgsql security definer set search_path = '' as $$
declare v_campaign public.service_campaigns%rowtype;
begin
  select * into strict v_campaign from public.service_campaigns where id=p_campaign_id for update;
  if not app_private.has_permission(v_campaign.organization_id,null,'branch.manage') then raise exception 'Not authorized to verify campaigns' using errcode='42501'; end if;
  if not ((v_campaign.status='draft' and p_to_status='verified') or (v_campaign.status='verified' and p_to_status='retired')) then raise exception 'Invalid campaign transition' using errcode='22023'; end if;
  update public.service_campaigns set status=p_to_status,verified_at=case when p_to_status='verified' then now() else verified_at end,verified_by=case when p_to_status='verified' then auth.uid() else verified_by end where id=v_campaign.id returning * into v_campaign;
  return v_campaign;
end; $$;

create or replace function public.match_vehicle_campaign(p_campaign_id uuid,p_vehicle_id uuid,p_match_basis text)
returns public.campaign_vehicle_matches language plpgsql security definer set search_path = '' as $$
declare v_campaign public.service_campaigns%rowtype; v_vehicle public.vehicles%rowtype; v_match public.campaign_vehicle_matches%rowtype;
begin
  select * into strict v_campaign from public.service_campaigns where id=p_campaign_id;
  select * into strict v_vehicle from public.vehicles where id=p_vehicle_id;
  if v_vehicle.organization_id<>v_campaign.organization_id or not app_private.has_permission(v_campaign.organization_id,null,'crm.manage') then raise exception 'Campaign vehicle scope is invalid' using errcode='42501'; end if;
  if nullif(trim(p_match_basis),'') is null or v_campaign.status='retired' then raise exception 'Match basis is required for an active campaign' using errcode='22023'; end if;
  insert into public.campaign_vehicle_matches(organization_id,campaign_id,vehicle_id,match_basis,status,verified_at,verified_by)
  values(v_campaign.organization_id,v_campaign.id,v_vehicle.id,trim(p_match_basis),case when v_campaign.status='verified' then 'confirmed' else 'advisory' end,case when v_campaign.status='verified' then now() end,case when v_campaign.status='verified' then auth.uid() end)
  on conflict(campaign_id,vehicle_id) do update set match_basis=excluded.match_basis returning * into v_match;
  return v_match;
end; $$;

create or replace function public.transition_campaign_vehicle_match(p_match_id uuid,p_to_status text,p_repair_order_id uuid)
returns public.campaign_vehicle_matches language plpgsql security definer set search_path = '' as $$
declare v_match public.campaign_vehicle_matches%rowtype;
begin
  select * into strict v_match from public.campaign_vehicle_matches where id=p_match_id for update;
  if not app_private.has_permission(v_match.organization_id,null,'crm.manage') then raise exception 'Not authorized to update campaign matches' using errcode='42501'; end if;
  if p_to_status not in ('confirmed','completed','not_applicable') then raise exception 'Invalid campaign-match state' using errcode='22023'; end if;
  if p_to_status='completed' and (p_repair_order_id is null or not exists(select 1 from public.repair_orders where id=p_repair_order_id and vehicle_id=v_match.vehicle_id and organization_id=v_match.organization_id)) then raise exception 'Completed campaign work requires a repair order for this vehicle' using errcode='23514'; end if;
  update public.campaign_vehicle_matches set status=p_to_status,repair_order_id=case when p_to_status='completed' then p_repair_order_id else repair_order_id end,verified_at=case when p_to_status='confirmed' then now() else verified_at end,verified_by=case when p_to_status='confirmed' then auth.uid() else verified_by end where id=v_match.id returning * into v_match;
  return v_match;
end; $$;

-- A passed quality check is required for release from QC.
create or replace function public.transition_repair_order(p_repair_order_id uuid,p_expected_version bigint,p_to_status text,p_reason text default null)
returns public.repair_orders language plpgsql security definer set search_path = '' as $$
declare v_order public.repair_orders%rowtype; v_from_status text; v_allowed boolean;
begin
  select * into strict v_order from public.repair_orders where id=p_repair_order_id for update;
  if not app_private.has_permission(v_order.organization_id,v_order.branch_id,'repair_order.manage') then raise exception 'Not authorized to progress repair orders' using errcode='42501'; end if;
  if v_order.version<>p_expected_version then raise exception 'Repair order was changed by another user' using errcode='40001'; end if;
  v_from_status:=v_order.status;
  v_allowed:=case v_order.status when 'draft' then p_to_status in ('checked_in','cancelled') when 'checked_in' then p_to_status in ('diagnosis','on_hold','cancelled') when 'diagnosis' then p_to_status in ('awaiting_approval','approved','on_hold','cancelled') when 'awaiting_approval' then p_to_status in ('approved','diagnosis','on_hold','cancelled') when 'approved' then p_to_status in ('in_progress','on_hold','cancelled') when 'in_progress' then p_to_status in ('qc','on_hold') when 'qc' then p_to_status in ('ready','in_progress') when 'ready' then p_to_status in ('delivered','in_progress') when 'delivered' then p_to_status='closed' when 'on_hold' then p_to_status in ('diagnosis','awaiting_approval','approved','in_progress','cancelled') else false end;
  if not v_allowed then raise exception 'Invalid repair order transition: % to %',v_order.status,p_to_status using errcode='22023'; end if;
  if v_order.risk_state in ('quarantine','emergency_escalation') and p_to_status in ('ready','delivered','closed') then raise exception 'Safety hold must be cleared before handover' using errcode='23514'; end if;
  if v_order.status='qc' and p_to_status='ready' and not exists(select 1 from public.quality_checks q where q.repair_order_id=v_order.id and q.result='pass' and not exists(select 1 from public.quality_checks q2 where q2.repair_order_id=q.repair_order_id and q2.signed_at>q.signed_at and q2.result='fail')) then raise exception 'A current passing quality check is required before release' using errcode='23514'; end if;
  update public.repair_orders set status=p_to_status,closed_at=case when p_to_status='closed' then now() else closed_at end where id=p_repair_order_id returning * into v_order;
  insert into public.repair_order_events(organization_id,branch_id,repair_order_id,from_status,to_status,reason,actor_id) values(v_order.organization_id,v_order.branch_id,v_order.id,v_from_status,p_to_status,p_reason,auth.uid());
  return v_order;
end; $$;

do $$ declare r regprocedure; begin
  foreach r in array array[
    'public.post_credit_note(uuid,text,jsonb)'::regprocedure,
    'public.record_payment_refund(uuid,uuid,numeric,text,text,text)'::regprocedure,
    'public.open_cash_session(uuid,text,numeric)'::regprocedure,
    'public.close_cash_session(uuid,numeric)'::regprocedure,
    'public.approve_cash_session(uuid)'::regprocedure,
    'public.record_quality_check(uuid,uuid,text,text,text)'::regprocedure,
    'public.create_service_campaign(uuid,text,text,text,text)'::regprocedure,
    'public.transition_service_campaign(uuid,text)'::regprocedure,
    'public.match_vehicle_campaign(uuid,uuid,text)'::regprocedure,
    'public.transition_campaign_vehicle_match(uuid,text,uuid)'::regprocedure
  ] loop execute format('revoke all on function %s from public, anon, authenticated',r); execute format('grant execute on function %s to authenticated',r); end loop;
end $$;
