-- Secure application commands and cross-tenant invariants.
-- Direct writes remain unavailable to authenticated clients; these narrow RPCs
-- validate organization, branch, permission, state transition and idempotency.

create or replace function app_private.has_branch_access(p_organization_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role = 'admin'
        or exists (
          select 1 from public.membership_branches mb
          where mb.membership_id = m.id and mb.branch_id = p_branch_id
        )
      )
  );
$$;

create or replace function app_private.has_permission(
  p_organization_id uuid,
  p_branch_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role = 'admin'
        or exists (
          select 1
          from public.membership_permissions mp
          where mp.membership_id = m.id
            and mp.permission_code = p_permission_code
            and mp.allowed
        )
      )
      and (
        p_branch_id is null
        or m.role = 'admin'
        or exists (
          select 1 from public.membership_branches mb
          where mb.membership_id = m.id and mb.branch_id = p_branch_id
        )
      )
  );
$$;

create or replace function app_private.assert_branch_organization()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.branches b
    where b.id = new.branch_id and b.organization_id = new.organization_id
  ) then
    raise exception 'Branch does not belong to organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select t.table_name
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = t.table_schema and c.table_name = t.table_name and c.column_name = 'organization_id'
      )
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = t.table_schema and c.table_name = t.table_name and c.column_name = 'branch_id'
      )
  loop
    execute format(
      'create trigger assert_branch_organization before insert or update of organization_id, branch_id on public.%I for each row execute function app_private.assert_branch_organization()',
      r.table_name
    );
  end loop;
end;
$$;

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
begin
  if p_document_type not in ('invoice', 'credit_note', 'receipt', 'repair_order', 'purchase_order', 'stock_transfer') then
    raise exception 'Unsupported document type' using errcode = '22023';
  end if;

  insert into public.invoice_series (
    organization_id, branch_id, document_type, fiscal_period, prefix, next_number
  ) values (
    p_organization_id, p_branch_id, p_document_type, v_period, p_default_prefix, 1
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

  update public.invoice_series
  set next_number = v_series.next_number + 1
  where id = v_series.id;

  series_id := v_series.id;
  document_number := v_series.prefix || lpad(v_series.next_number::text, 5, '0');
  return next;
end;
$$;

create or replace function public.create_repair_order(
  p_organization_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_appointment_id uuid default null,
  p_odometer_km integer default null,
  p_state_of_charge numeric default null,
  p_customer_concern text default null,
  p_promised_at timestamptz default null
)
returns public.repair_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch_code text;
  v_number text;
  v_order public.repair_orders%rowtype;
begin
  if not app_private.has_permission(p_organization_id, p_branch_id, 'repair_order.manage') then
    raise exception 'Not authorized to create repair orders' using errcode = '42501';
  end if;

  select b.code into strict v_branch_code
  from public.branches b
  where b.id = p_branch_id and b.organization_id = p_organization_id and b.status = 'active';

  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.organization_id = p_organization_id) then
    raise exception 'Customer does not belong to organization' using errcode = '23514';
  end if;
  if not exists (select 1 from public.vehicles v where v.id = p_vehicle_id and v.organization_id = p_organization_id) then
    raise exception 'Vehicle does not belong to organization' using errcode = '23514';
  end if;
  if p_appointment_id is not null and not exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id and a.organization_id = p_organization_id and a.branch_id = p_branch_id
  ) then
    raise exception 'Appointment does not belong to branch' using errcode = '23514';
  end if;

  select d.document_number into strict v_number
  from app_private.take_document_number(
    p_organization_id, p_branch_id, 'repair_order', v_branch_code || '-RO-'
  ) d;

  insert into public.repair_orders (
    organization_id, branch_id, ro_number, customer_id, vehicle_id, appointment_id,
    status, odometer_km, state_of_charge, customer_concern, promised_at, created_by
  ) values (
    p_organization_id, p_branch_id, v_number, p_customer_id, p_vehicle_id, p_appointment_id,
    'checked_in', p_odometer_km, p_state_of_charge, p_customer_concern, p_promised_at, auth.uid()
  ) returning * into v_order;

  insert into public.repair_order_events (
    organization_id, branch_id, repair_order_id, from_status, to_status, actor_id
  ) values (
    p_organization_id, p_branch_id, v_order.id, null, 'checked_in', auth.uid()
  );

  return v_order;
end;
$$;

create or replace function public.transition_repair_order(
  p_repair_order_id uuid,
  p_expected_version bigint,
  p_to_status text,
  p_reason text default null
)
returns public.repair_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_from_status text;
  v_allowed boolean;
begin
  select * into strict v_order
  from public.repair_orders r where r.id = p_repair_order_id for update;

  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'repair_order.manage') then
    raise exception 'Not authorized to progress repair orders' using errcode = '42501';
  end if;
  if v_order.version <> p_expected_version then
    raise exception 'Repair order was changed by another user' using errcode = '40001';
  end if;

  v_from_status := v_order.status;

  v_allowed := case v_order.status
    when 'draft' then p_to_status in ('checked_in', 'cancelled')
    when 'checked_in' then p_to_status in ('diagnosis', 'on_hold', 'cancelled')
    when 'diagnosis' then p_to_status in ('awaiting_approval', 'approved', 'on_hold', 'cancelled')
    when 'awaiting_approval' then p_to_status in ('approved', 'diagnosis', 'on_hold', 'cancelled')
    when 'approved' then p_to_status in ('in_progress', 'on_hold', 'cancelled')
    when 'in_progress' then p_to_status in ('qc', 'on_hold')
    when 'qc' then p_to_status in ('ready', 'in_progress')
    when 'ready' then p_to_status in ('delivered', 'in_progress')
    when 'delivered' then p_to_status = 'closed'
    when 'on_hold' then p_to_status in ('diagnosis', 'awaiting_approval', 'approved', 'in_progress', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'Invalid repair order transition: % to %', v_order.status, p_to_status using errcode = '22023';
  end if;
  if v_order.risk_state in ('quarantine', 'emergency_escalation') and p_to_status in ('ready', 'delivered', 'closed') then
    raise exception 'Safety hold must be cleared before handover' using errcode = '23514';
  end if;

  update public.repair_orders
  set status = p_to_status,
      closed_at = case when p_to_status = 'closed' then now() else closed_at end
  where id = p_repair_order_id
  returning * into v_order;

  insert into public.repair_order_events (
    organization_id, branch_id, repair_order_id, from_status, to_status, reason, actor_id
  ) values (
    v_order.organization_id, v_order.branch_id, v_order.id,
    v_from_status, p_to_status, p_reason, auth.uid()
  );

  return v_order;
end;
$$;

create or replace function public.post_stock_movement(
  p_organization_id uuid,
  p_branch_id uuid,
  p_part_id uuid,
  p_lot_id uuid,
  p_from_bin_id uuid,
  p_to_bin_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_movement_type text,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_movement public.stock_movements%rowtype;
  v_balance public.stock_balances%rowtype;
begin
  if not app_private.has_permission(p_organization_id, p_branch_id, 'inventory.manage') then
    raise exception 'Not authorized to post stock movements' using errcode = '42501';
  end if;
  if p_quantity <= 0 or p_unit_cost < 0 or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Invalid stock movement quantity, cost or idempotency key' using errcode = '22023';
  end if;

  select * into v_movement from public.stock_movements m
  where m.organization_id = p_organization_id and m.idempotency_key = p_idempotency_key;
  if found then return v_movement; end if;

  if not exists (select 1 from public.parts p where p.id = p_part_id and p.organization_id = p_organization_id) then
    raise exception 'Part does not belong to organization' using errcode = '23514';
  end if;
  if p_lot_id is not null and not exists (
    select 1 from public.stock_lots l where l.id = p_lot_id and l.organization_id = p_organization_id and l.part_id = p_part_id
  ) then
    raise exception 'Lot does not belong to part' using errcode = '23514';
  end if;
  if p_from_bin_id is not null and not exists (
    select 1 from public.bins b where b.id = p_from_bin_id and b.organization_id = p_organization_id and b.branch_id = p_branch_id
  ) then raise exception 'Source bin does not belong to branch' using errcode = '23514'; end if;
  if p_to_bin_id is not null and not exists (
    select 1 from public.bins b where b.id = p_to_bin_id and b.organization_id = p_organization_id and b.branch_id = p_branch_id
  ) then raise exception 'Destination bin does not belong to branch' using errcode = '23514'; end if;

  if p_from_bin_id is not null then
    select * into v_balance from public.stock_balances b
    where b.part_id = p_part_id and b.bin_id = p_from_bin_id and b.lot_id is not distinct from p_lot_id
    for update;
    if not found or (v_balance.on_hand - v_balance.reserved) < p_quantity then
      raise exception 'Insufficient available stock' using errcode = '23514';
    end if;
    update public.stock_balances set on_hand = on_hand - p_quantity
    where id = v_balance.id;
  end if;

  if p_to_bin_id is not null then
    insert into public.stock_balances (
      organization_id, branch_id, part_id, bin_id, lot_id, on_hand, reserved, average_cost
    ) values (
      p_organization_id, p_branch_id, p_part_id, p_to_bin_id, p_lot_id, p_quantity, 0, p_unit_cost
    ) on conflict (part_id, bin_id, lot_id) do update
    set average_cost = case
          when public.stock_balances.on_hand + excluded.on_hand = 0 then 0
          else ((public.stock_balances.on_hand * public.stock_balances.average_cost) + (excluded.on_hand * excluded.average_cost))
            / (public.stock_balances.on_hand + excluded.on_hand)
        end,
        on_hand = public.stock_balances.on_hand + excluded.on_hand;
  end if;

  insert into public.stock_movements (
    organization_id, branch_id, part_id, lot_id, from_bin_id, to_bin_id, quantity,
    unit_cost, movement_type, source_type, source_id, idempotency_key, posted_by
  ) values (
    p_organization_id, p_branch_id, p_part_id, p_lot_id, p_from_bin_id, p_to_bin_id, p_quantity,
    p_unit_cost, p_movement_type, p_source_type, p_source_id, p_idempotency_key, auth.uid()
  ) returning * into v_movement;

  return v_movement;
end;
$$;

create or replace function public.post_invoice(
  p_invoice_id uuid,
  p_expected_version bigint
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_branch_code text;
  v_series_id uuid;
  v_number text;
  v_subtotal numeric(18,3);
  v_discount numeric(18,3);
  v_tax numeric(18,3);
  v_total numeric(18,3);
begin
  select * into strict v_invoice from public.invoices i where i.id = p_invoice_id for update;
  if not app_private.has_permission(v_invoice.organization_id, v_invoice.branch_id, 'invoice.post') then
    raise exception 'Not authorized to post invoices' using errcode = '42501';
  end if;
  if v_invoice.status <> 'draft' then raise exception 'Only draft invoices can be posted' using errcode = '22023'; end if;
  if v_invoice.version <> p_expected_version then raise exception 'Invoice was changed by another user' using errcode = '40001'; end if;
  if not exists (select 1 from public.invoice_lines l where l.invoice_id = p_invoice_id) then
    raise exception 'Invoice must contain at least one line' using errcode = '23514';
  end if;

  select coalesce(sum(l.quantity * l.unit_price), 0), coalesce(sum(l.discount_amount), 0),
         coalesce(sum(l.tax_amount), 0), coalesce(sum(l.line_total), 0)
  into v_subtotal, v_discount, v_tax, v_total
  from public.invoice_lines l where l.invoice_id = p_invoice_id;

  select b.code into strict v_branch_code from public.branches b
  where b.id = v_invoice.branch_id and b.organization_id = v_invoice.organization_id;
  select d.series_id, d.document_number into strict v_series_id, v_number
  from app_private.take_document_number(
    v_invoice.organization_id, v_invoice.branch_id, 'invoice', v_branch_code || '-INV-'
  ) d;

  update public.invoices
  set invoice_series_id = v_series_id,
      invoice_number = v_number,
      subtotal = v_subtotal,
      discount_total = v_discount,
      tax_total = v_tax,
      grand_total = v_total,
      status = 'posted',
      posted_at = now(),
      document_hash = encode(extensions.digest(
        concat_ws('|', id::text, v_number, currency, v_subtotal::text, v_discount::text, v_tax::text, v_total::text),
        'sha256'
      ), 'hex')
  where id = p_invoice_id
  returning * into v_invoice;

  insert into integration.outbox_events (
    organization_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key
  ) values (
    v_invoice.organization_id, 'invoice', v_invoice.id,
    'invoice.posted', jsonb_build_object(
      'invoice_id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'branch_id', v_invoice.branch_id
    ), 'invoice.posted:' || v_invoice.id::text
  );

  return v_invoice;
end;
$$;

-- Provider references are optional, so NULL must not collapse all cash/manual
-- payments into one unique value. A separate application idempotency key is mandatory.
alter table public.payments
  drop constraint payments_organization_id_method_provider_ref_key;

create unique index payments_provider_reference_unique
  on public.payments(organization_id, method, provider_ref)
  where provider_ref is not null;

alter table public.payments
  add column idempotency_key text not null;

create unique index payments_idempotency_unique
  on public.payments(organization_id, idempotency_key);

create or replace function app_private.protect_posted_invoice()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'Posted invoices are immutable; create a credit note' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if (to_jsonb(new) - array['paid_total', 'status', 'updated_at', 'version'])
       <> (to_jsonb(old) - array['paid_total', 'status', 'updated_at', 'version']) then
      raise exception 'Posted invoice commercial fields are immutable' using errcode = '55000';
    end if;
    if new.paid_total < old.paid_total or new.paid_total > old.grand_total then
      raise exception 'Invalid paid total' using errcode = '23514';
    end if;
    if new.status <> (case
      when new.paid_total = new.grand_total then 'paid'
      when new.paid_total > 0 then 'partially_paid'
      else 'posted'
    end) then
      raise exception 'Invoice payment state does not match paid total' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger protect_posted_invoice
before update or delete on public.invoices
for each row execute function app_private.protect_posted_invoice();

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
  if v_invoice.status not in ('posted', 'partially_paid') then
    raise exception 'Invoice cannot receive a payment in its current state' using errcode = '22023';
  end if;
  if p_amount <= 0 or p_amount > (v_invoice.grand_total - v_invoice.paid_total) then
    raise exception 'Payment exceeds the outstanding invoice amount' using errcode = '23514';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;

  select * into v_payment from public.payments p
  where p.organization_id = v_invoice.organization_id and p.idempotency_key = p_idempotency_key;
  if found then return v_payment; end if;

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

  return v_payment;
end;
$$;

revoke all on function app_private.assert_branch_organization() from public, anon, authenticated;
revoke all on function app_private.take_document_number(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.protect_posted_invoice() from public, anon, authenticated;

revoke all on function public.create_repair_order(uuid, uuid, uuid, uuid, uuid, integer, numeric, text, timestamptz) from public, anon;
revoke all on function public.transition_repair_order(uuid, bigint, text, text) from public, anon;
revoke all on function public.post_stock_movement(uuid, uuid, uuid, uuid, uuid, uuid, numeric, numeric, text, text, uuid, text) from public, anon;
revoke all on function public.post_invoice(uuid, bigint) from public, anon;
revoke all on function public.receive_invoice_payment(uuid, numeric, text, text, text) from public, anon;

grant execute on function public.create_repair_order(uuid, uuid, uuid, uuid, uuid, integer, numeric, text, timestamptz) to authenticated;
grant execute on function public.transition_repair_order(uuid, bigint, text, text) to authenticated;
grant execute on function public.post_stock_movement(uuid, uuid, uuid, uuid, uuid, uuid, numeric, numeric, text, text, uuid, text) to authenticated;
grant execute on function public.post_invoice(uuid, bigint) to authenticated;
grant execute on function public.receive_invoice_payment(uuid, numeric, text, text, text) to authenticated;

comment on function public.create_repair_order is 'Atomically creates a branch-numbered repair order after tenant and permission validation.';
comment on function public.transition_repair_order is 'Applies an allow-listed repair-order state transition with optimistic concurrency.';
comment on function public.post_stock_movement is 'Posts one idempotent immutable stock movement and updates locked balances.';
comment on function public.post_invoice is 'Atomically numbers, totals, hashes and posts a draft invoice, then emits an outbox event.';
comment on function public.receive_invoice_payment is 'Creates an idempotent branch receipt, allocates it and advances invoice payment state.';
