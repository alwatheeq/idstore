-- Audit F01–F03: authorized replay, serialized credit refunds and net receivables.


create or replace function app_private.invoice_net_due(p_invoice_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
 select case when i.status in ('draft','void','credited') then 0 else greatest(0, i.grand_total-i.paid_total
 -coalesce((select sum(c.grand_total) from public.credit_notes c where c.invoice_id=i.id),0)
 +coalesce((select sum(r.amount) from public.payment_refunds r join public.credit_notes c on c.id=r.credit_note_id where c.invoice_id=i.id and r.status='recorded'),0)) end
 from public.invoices i where i.id=p_invoice_id;
$$;
revoke all on function app_private.invoice_net_due(uuid) from public, anon, authenticated;


create or replace function public.record_payment_refund(p_payment_id uuid,p_credit_note_id uuid,p_amount numeric,p_reason text,p_provider_ref text,p_idempotency_key text)
returns public.payment_refunds language plpgsql security definer set search_path = '' as $$
declare v_payment public.payments%rowtype; v_credit public.credit_notes%rowtype; v_refund public.payment_refunds%rowtype; v_payment_refunded numeric; v_credit_refunded numeric;
begin
  -- All refund paths serialize on the invoice, then credit, then payment.
  -- Collection/credit posting also lock the invoice before changing balances.
  perform 1 from public.invoices where id=(select invoice_id from public.credit_notes where id=p_credit_note_id) for update;
  select * into strict v_credit from public.credit_notes where id=p_credit_note_id for update;
  select * into strict v_payment from public.payments where id=p_payment_id for update;
  if not app_private.has_permission(v_payment.organization_id,v_payment.branch_id,'payment.refund') then raise exception 'Not authorized to record refunds' using errcode='42501'; end if;
  select * into v_refund from public.payment_refunds where organization_id=v_payment.organization_id and idempotency_key=trim(p_idempotency_key);
  if found then
    if v_refund.payment_id is distinct from p_payment_id or v_refund.credit_note_id is distinct from p_credit_note_id
      or v_refund.amount is distinct from p_amount or v_refund.reason is distinct from trim(p_reason)
      or v_refund.provider_ref is distinct from nullif(trim(p_provider_ref),'') then
      raise exception 'Refund reference belongs to a different request' using errcode='23505';
    end if;
    return v_refund;
  end if;
  if v_credit.organization_id<>v_payment.organization_id or v_credit.branch_id<>v_payment.branch_id or not exists(select 1 from public.payment_allocations a where a.payment_id=v_payment.id and a.invoice_id=v_credit.invoice_id) then raise exception 'Refund payment and credit note do not reconcile' using errcode='23514'; end if;
  if nullif(trim(p_reason),'') is null or nullif(trim(p_idempotency_key),'') is null or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,3) or p_amount<=0 then raise exception 'Refund amount, reason and idempotency key are required' using errcode='22023'; end if;
  select coalesce(sum(amount),0) into v_payment_refunded from public.payment_refunds where payment_id=v_payment.id and status='recorded';
  select coalesce(sum(amount),0) into v_credit_refunded from public.payment_refunds where credit_note_id=v_credit.id and status='recorded';
  if p_amount>v_payment.amount-v_payment_refunded or p_amount>v_credit.grand_total-v_credit_refunded then raise exception 'Refund exceeds payment or credit-note balance' using errcode='23514'; end if;
  if p_amount > (select greatest(0,i.paid_total-i.grand_total
      +coalesce((select sum(c.grand_total) from public.credit_notes c where c.invoice_id=i.id),0)
      -coalesce((select sum(r.amount) from public.payment_refunds r join public.credit_notes c on c.id=r.credit_note_id where c.invoice_id=i.id and r.status='recorded'),0))
      from public.invoices i where i.id=v_credit.invoice_id) then
    raise exception 'Refund exceeds the customer credit balance' using errcode='23514';
  end if;
  insert into public.payment_refunds(organization_id,branch_id,payment_id,credit_note_id,amount,reason,provider_ref,idempotency_key,status,created_by)
  values(v_payment.organization_id,v_payment.branch_id,v_payment.id,v_credit.id,p_amount,trim(p_reason),nullif(trim(p_provider_ref),''),trim(p_idempotency_key),'recorded',auth.uid()) returning * into v_refund;
  update public.payments set status=case when v_payment_refunded+p_amount=v_payment.amount then 'refunded' else 'partially_refunded' end where id=v_payment.id;
  insert into integration.outbox_events(organization_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key) values(v_payment.organization_id,'payment.refunded','payment_refund',v_refund.id,jsonb_build_object('refund_id',v_refund.id,'payment_id',v_payment.id),'payment.refunded:'||v_refund.id::text);
  return v_refund;
end; $$;

create or replace function public.receive_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_provider_ref text,
  p_idempotency_key text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment public.payments%rowtype;
  v_branch_code text;
  v_receipt_number text;
  v_new_paid numeric(18,3);
begin
  select * into strict v_invoice from public.invoices i where i.id = p_invoice_id for update;
  if not app_private.has_permission(v_invoice.organization_id, v_invoice.branch_id, 'payment.receive') then
    raise exception 'Not authorized to receive payments' using errcode = '42501';
  end if;
  if nullif(trim(p_idempotency_key), '') is null or length(p_idempotency_key) > 200 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;

  select * into v_payment from public.payments p
  where p.organization_id = v_invoice.organization_id and p.idempotency_key = p_idempotency_key;
  if found then
    if not exists (
      select 1 from public.payment_allocations a
      where a.payment_id = v_payment.id and a.invoice_id = v_invoice.id
    ) then raise exception 'Idempotency key belongs to another invoice' using errcode = '23505'; end if;
    return v_payment;
  end if;

  if v_invoice.status not in ('posted', 'partially_paid') then
    raise exception 'Invoice cannot receive a payment in its current state' using errcode = '22023';
  end if;
  if p_method not in ('cash', 'card', 'bank_transfer', 'payment_link', 'fleet_account', 'other') then
    raise exception 'Payment method is invalid' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,3) or p_amount > app_private.invoice_net_due(v_invoice.id) then
    raise exception 'Payment exceeds the outstanding invoice amount' using errcode = '23514';
  end if;

  select b.code into strict v_branch_code from public.branches b
  where b.id = v_invoice.branch_id and b.organization_id = v_invoice.organization_id;
  select d.document_number into strict v_receipt_number
  from app_private.take_document_number(
    v_invoice.organization_id, v_invoice.branch_id, 'receipt', v_branch_code || '-REC-'
  ) d;

  insert into public.payments (
    organization_id, branch_id, receipt_number, method, amount, currency,
    provider_ref, status, received_by, idempotency_key
  ) values (
    v_invoice.organization_id, v_invoice.branch_id, v_receipt_number, p_method, p_amount,
    v_invoice.currency, nullif(trim(p_provider_ref), ''), 'received', auth.uid(), p_idempotency_key
  ) returning * into v_payment;

  insert into public.payment_allocations (
    organization_id, branch_id, payment_id, invoice_id, amount
  ) values (
    v_invoice.organization_id, v_invoice.branch_id, v_payment.id, v_invoice.id, p_amount
  );

  v_new_paid := v_invoice.paid_total + p_amount;
  update public.invoices
  set paid_total = v_new_paid,
      status = case when v_new_paid = grand_total then 'paid' else 'partially_paid' end
  where id = v_invoice.id;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_invoice.organization_id, auth.uid(), 'payment.received', 'payment', v_payment.id,
    jsonb_build_object('invoice_id', v_invoice.id, 'amount', p_amount, 'method', p_method)
  );
  return v_payment;
end;
$$;

create or replace function public.portal_request_payment_link(p_invoice_id uuid)
returns public.portal_payment_requests language plpgsql security definer set search_path='' as $$ declare v_account public.customer_accounts%rowtype; v_invoice public.invoices%rowtype; v_due numeric; begin
 select * into v_account from public.customer_accounts where auth_user_id=auth.uid() and status='active' limit 1; if not found then raise exception 'Active customer portal account not found' using errcode='42501'; end if;
 select * into strict v_invoice from public.invoices where id=p_invoice_id and organization_id=v_account.organization_id and customer_id=v_account.customer_id and status in('posted','partially_paid') for update; v_due:=app_private.invoice_net_due(v_invoice.id); if v_due<=0 then raise exception 'Invoice has no payable balance' using errcode='22023'; end if;
 raise exception 'Payment links are not available yet. Contact the branch to arrange payment.' using errcode='55000';
end; $$;

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
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'invoice_number',i.invoice_number,'status',i.status,'currency',i.currency,'grand_total',i.grand_total,'paid_total',i.paid_total,'net_due',app_private.invoice_net_due(i.id),'posted_at',i.posted_at,'document_hash',i.document_hash) order by i.posted_at desc) from public.invoices i where i.customer_id=v_customer.id and i.organization_id=v_account.organization_id and i.status<>'draft'),'[]'::jsonb),
    'recommendations',coalesce((select jsonb_agg(jsonb_build_object('id',vr.id,'vehicle_id',vr.vehicle_id,'description',vr.description,'severity',vr.severity,'status',vr.status,'due_date',vr.due_date,'due_odometer_km',vr.due_odometer_km) order by vr.created_at desc) from public.vehicle_recommendations vr where vr.organization_id=v_account.organization_id and vr.vehicle_id in(select o.vehicle_id from public.vehicle_ownerships o where o.customer_id=v_customer.id and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>=current_date))),'[]'::jsonb)
  );
end; $$;
