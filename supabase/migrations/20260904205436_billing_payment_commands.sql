-- Billing draft commands and hardened idempotent payment collection.

create or replace function app_private.take_document_number(
  p_organization_id uuid,
  p_branch_id uuid,
  p_document_type text,
  p_default_prefix text
)
returns table(series_id uuid, document_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := to_char(current_date, 'YYYY');
  v_series public.invoice_series%rowtype;
  v_prefix text := case
    when p_document_type = 'receipt' then regexp_replace(p_default_prefix, '-(GR|REC)-$', '-RC-')
    else p_default_prefix
  end;
begin
  if p_document_type not in ('invoice', 'credit_note', 'receipt', 'repair_order', 'purchase_order', 'stock_transfer') then
    raise exception 'Unsupported document type' using errcode = '22023';
  end if;

  insert into public.invoice_series (
    organization_id, branch_id, document_type, fiscal_period, prefix, next_number
  ) values (
    p_organization_id, p_branch_id, p_document_type, v_period, v_prefix, 1
  ) on conflict (branch_id, document_type, fiscal_period) do nothing;

  select * into v_series
  from public.invoice_series s
  where s.branch_id = p_branch_id
    and s.organization_id = p_organization_id
    and s.document_type = p_document_type
    and s.fiscal_period = v_period
  for update;
  if not found then
    raise exception 'Document series belongs to another organization' using errcode = '23514';
  end if;

  if p_document_type = 'receipt' and v_series.prefix <> v_prefix then
    update public.invoice_series set prefix = v_prefix where id = v_series.id;
    v_series.prefix := v_prefix;
  end if;
  update public.invoice_series set next_number = v_series.next_number + 1 where id = v_series.id;

  series_id := v_series.id;
  document_number := v_series.prefix || lpad(v_series.next_number::text, 5, '0');
  return next;
end;
$$;

create or replace function public.create_invoice_from_repair_order(
  p_repair_order_id uuid
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_branch public.branches%rowtype;
  v_customer public.customers%rowtype;
  v_organization public.organizations%rowtype;
  v_invoice public.invoices%rowtype;
begin
  select * into v_order from public.repair_orders where id = p_repair_order_id for update;
  if not found then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'invoice.post') then
    raise exception 'Not authorized to manage invoices for this branch' using errcode = '42501';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'Cancelled repair orders cannot be invoiced' using errcode = '23514';
  end if;
  if exists (select 1 from public.invoices i where i.repair_order_id = v_order.id) then
    raise exception 'This repair order already has an invoice' using errcode = '23505';
  end if;

  select * into strict v_branch from public.branches
  where id = v_order.branch_id and organization_id = v_order.organization_id and status = 'active';
  select * into strict v_customer from public.customers
  where id = v_order.customer_id and organization_id = v_order.organization_id;
  select * into strict v_organization from public.organizations where id = v_order.organization_id;

  insert into public.invoices (
    organization_id, branch_id, repair_order_id, customer_id, status, currency,
    seller_snapshot, buyer_snapshot, created_by
  ) values (
    v_order.organization_id, v_order.branch_id, v_order.id, v_order.customer_id, 'draft', v_branch.currency,
    jsonb_strip_nulls(jsonb_build_object(
      'organization_name', v_organization.legal_name,
      'organization_tax_number', v_organization.tax_number,
      'branch_name', v_branch.legal_name,
      'branch_tax_registration', v_branch.tax_registration,
      'country_code', v_branch.country_code,
      'city', v_branch.city,
      'address', v_branch.address_json,
      'phone', v_branch.phone,
      'email', v_branch.email
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'customer_name', coalesce(v_customer.legal_name, v_customer.display_name),
      'customer_tax_number', v_customer.tax_number,
      'customer_type', v_customer.customer_type,
      'mobile', (select c.value from public.customer_contacts c where c.customer_id = v_customer.id and c.kind = 'mobile' order by c.is_primary desc, c.created_at limit 1),
      'email', (select c.value from public.customer_contacts c where c.customer_id = v_customer.id and c.kind = 'email' order by c.is_primary desc, c.created_at limit 1)
    )),
    auth.uid()
  ) returning * into v_invoice;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_invoice.organization_id, auth.uid(), 'invoice.created', 'invoice', v_invoice.id,
    jsonb_build_object('repair_order_id', v_order.id, 'customer_id', v_order.customer_id)
  );
  return v_invoice;
end;
$$;

create or replace function public.add_invoice_line(
  p_invoice_id uuid,
  p_expected_version bigint,
  p_line_type text,
  p_description text,
  p_quantity numeric,
  p_unit_price numeric,
  p_discount_amount numeric,
  p_tax_rate numeric
)
returns public.invoice_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_line public.invoice_lines%rowtype;
  v_base numeric(18,3);
  v_discount numeric(18,3);
  v_tax numeric(18,3);
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_invoice.organization_id, v_invoice.branch_id, 'invoice.post') then
    raise exception 'Not authorized to change this invoice' using errcode = '42501';
  end if;
  if v_invoice.status <> 'draft' then raise exception 'Only draft invoices can be changed' using errcode = '23514'; end if;
  if v_invoice.version <> p_expected_version then raise exception 'Invoice changed; refresh before adding a line' using errcode = '40001'; end if;
  if p_line_type not in ('labor', 'part', 'fee', 'discount', 'warranty', 'goodwill', 'text')
     or nullif(trim(p_description), '') is null or p_quantity is null or p_quantity <= 0
     or p_unit_price is null or p_unit_price < 0 or p_discount_amount is null or p_discount_amount < 0
     or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Invoice line values are invalid' using errcode = '22023';
  end if;

  v_base := round(p_quantity * p_unit_price, 3);
  v_discount := round(p_discount_amount, 3);
  if v_discount > v_base then raise exception 'Line discount exceeds its gross value' using errcode = '22023'; end if;
  v_tax := round((v_base - v_discount) * p_tax_rate / 100, 3);

  insert into public.invoice_lines (
    organization_id, branch_id, invoice_id, line_no, line_type, description_snapshot,
    quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total
  )
  select v_invoice.organization_id, v_invoice.branch_id, v_invoice.id,
         coalesce(max(l.line_no), 0) + 1, p_line_type, trim(p_description),
         p_quantity, p_unit_price, v_discount, p_tax_rate, v_tax, v_base - v_discount + v_tax
  from public.invoice_lines l where l.invoice_id = v_invoice.id
  returning * into v_line;

  update public.invoices i
  set subtotal = totals.subtotal,
      discount_total = totals.discount_total,
      tax_total = totals.tax_total,
      grand_total = totals.grand_total
  from (
    select round(sum(l.quantity * l.unit_price), 3) subtotal,
           round(sum(l.discount_amount), 3) discount_total,
           round(sum(l.tax_amount), 3) tax_total,
           round(sum(l.line_total), 3) grand_total
    from public.invoice_lines l where l.invoice_id = v_invoice.id
  ) totals
  where i.id = v_invoice.id;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_invoice.organization_id, auth.uid(), 'invoice.line_added', 'invoice', v_invoice.id,
    jsonb_build_object('line_id', v_line.id, 'line_type', p_line_type)
  );
  return v_line;
end;
$$;

create or replace function public.remove_invoice_line(
  p_invoice_line_id uuid,
  p_expected_version bigint
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.invoice_lines%rowtype;
  v_invoice public.invoices%rowtype;
begin
  select * into v_line from public.invoice_lines where id = p_invoice_line_id;
  if not found then raise exception 'Invoice line not found' using errcode = 'P0002'; end if;
  select * into strict v_invoice from public.invoices where id = v_line.invoice_id for update;
  if not app_private.has_permission(v_invoice.organization_id, v_invoice.branch_id, 'invoice.post') then
    raise exception 'Not authorized to change this invoice' using errcode = '42501';
  end if;
  if v_invoice.status <> 'draft' or v_invoice.version <> p_expected_version then
    raise exception 'Only the current draft invoice can be changed' using errcode = '40001';
  end if;

  delete from public.invoice_lines where id = v_line.id;
  update public.invoices i
  set subtotal = totals.subtotal,
      discount_total = totals.discount_total,
      tax_total = totals.tax_total,
      grand_total = totals.grand_total
  from (
    select coalesce(round(sum(l.quantity * l.unit_price), 3), 0) subtotal,
           coalesce(round(sum(l.discount_amount), 3), 0) discount_total,
           coalesce(round(sum(l.tax_amount), 3), 0) tax_total,
           coalesce(round(sum(l.line_total), 3), 0) grand_total
    from public.invoice_lines l where l.invoice_id = v_invoice.id
  ) totals
  where i.id = v_invoice.id
  returning * into v_invoice;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_invoice.organization_id, auth.uid(), 'invoice.line_removed', 'invoice', v_invoice.id,
    jsonb_build_object('line_id', v_line.id)
  );
  return v_invoice;
end;
$$;

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
  if p_amount is null or p_amount <= 0 or p_amount > (v_invoice.grand_total - v_invoice.paid_total) then
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

revoke all on function app_private.take_document_number(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_invoice_from_repair_order(uuid) from public, anon;
revoke all on function public.add_invoice_line(uuid, bigint, text, text, numeric, numeric, numeric, numeric) from public, anon;
revoke all on function public.remove_invoice_line(uuid, bigint) from public, anon;
revoke all on function public.receive_invoice_payment(uuid, numeric, text, text, text) from public, anon;

grant execute on function public.create_invoice_from_repair_order(uuid) to authenticated;
grant execute on function public.add_invoice_line(uuid, bigint, text, text, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.remove_invoice_line(uuid, bigint) to authenticated;
grant execute on function public.receive_invoice_payment(uuid, numeric, text, text, text) to authenticated;

comment on function public.create_invoice_from_repair_order is 'Creates one draft branch invoice with immutable seller and buyer identity snapshots.';
comment on function public.add_invoice_line is 'Adds and totals one line on the current draft invoice using optimistic concurrency.';
comment on function public.remove_invoice_line is 'Removes one line from the current draft invoice and recalculates totals.';
comment on function public.receive_invoice_payment is 'Creates an idempotent branch receipt, allocates it and advances invoice payment state.';
