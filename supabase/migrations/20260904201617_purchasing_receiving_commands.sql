-- Transactional purchasing and goods-receiving commands. Authenticated clients
-- retain read-only table access; writes cross the permission-checked API below.

create or replace function public.create_supplier(
  p_organization_id uuid,
  p_name text,
  p_tax_number text,
  p_phone text,
  p_email text
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier public.suppliers%rowtype;
begin
  if not app_private.has_permission(p_organization_id, null, 'purchasing.manage') then
    raise exception 'Not authorized to manage suppliers' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Supplier name is required' using errcode = '22023';
  end if;

  insert into public.suppliers (organization_id, name, tax_number, phone, email)
  values (
    p_organization_id,
    trim(p_name),
    nullif(trim(p_tax_number), ''),
    nullif(trim(p_phone), ''),
    nullif(lower(trim(p_email)), '')
  )
  returning * into v_supplier;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'supplier.created', 'supplier', v_supplier.id, jsonb_build_object('name', v_supplier.name));
  return v_supplier;
end;
$$;

create or replace function public.create_purchase_order(
  p_organization_id uuid,
  p_branch_id uuid,
  p_supplier_id uuid,
  p_part_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_tax_rate numeric
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches%rowtype;
  v_order public.purchase_orders%rowtype;
  v_number text;
  v_subtotal numeric(18,3);
  v_tax numeric(18,3);
begin
  if not app_private.has_permission(p_organization_id, p_branch_id, 'purchasing.manage') then
    raise exception 'Not authorized to create purchase orders for this branch' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_unit_cost is null or p_unit_cost < 0
     or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Quantity, unit cost or tax rate is invalid' using errcode = '22023';
  end if;

  select * into v_branch from public.branches
  where id = p_branch_id and organization_id = p_organization_id and status = 'active';
  if not found then raise exception 'Branch is unavailable' using errcode = '23514'; end if;
  if not exists (
    select 1 from public.suppliers s
    where s.id = p_supplier_id and s.organization_id = p_organization_id and s.status = 'active'
  ) then raise exception 'Supplier is unavailable' using errcode = '23514'; end if;
  if not exists (
    select 1 from public.parts p
    where p.id = p_part_id and p.organization_id = p_organization_id and p.status = 'active'
  ) then raise exception 'Part is unavailable' using errcode = '23514'; end if;

  select d.document_number into strict v_number
  from app_private.take_document_number(
    p_organization_id, p_branch_id, 'purchase_order', v_branch.code || '-PO-'
  ) d;
  v_subtotal := round(p_quantity * p_unit_cost, 3);
  v_tax := round(v_subtotal * p_tax_rate / 100, 3);

  insert into public.purchase_orders (
    organization_id, branch_id, supplier_id, po_number, status, currency,
    subtotal, tax_total, grand_total, created_by
  ) values (
    p_organization_id, p_branch_id, p_supplier_id, v_number, 'draft', v_branch.currency,
    v_subtotal, v_tax, v_subtotal + v_tax, auth.uid()
  ) returning * into v_order;

  insert into public.purchase_order_lines (
    organization_id, branch_id, purchase_order_id, line_no, part_id,
    ordered_quantity, unit_cost, tax_rate
  ) values (
    p_organization_id, p_branch_id, v_order.id, 1, p_part_id,
    p_quantity, p_unit_cost, p_tax_rate
  );

  insert into public.supplier_parts (
    organization_id, supplier_id, part_id, last_cost, currency
  ) values (
    p_organization_id, p_supplier_id, p_part_id, p_unit_cost, v_branch.currency
  ) on conflict (supplier_id, part_id) do update
    set last_cost = excluded.last_cost, currency = excluded.currency;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'purchase_order.created', 'purchase_order', v_order.id,
    jsonb_build_object('po_number', v_order.po_number, 'supplier_id', p_supplier_id)
  );
  return v_order;
end;
$$;

create or replace function public.add_purchase_order_line(
  p_purchase_order_id uuid,
  p_part_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_tax_rate numeric
)
returns public.purchase_order_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_line public.purchase_order_lines%rowtype;
begin
  select * into v_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'purchasing.manage') then
    raise exception 'Not authorized to change this purchase order' using errcode = '42501';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'Lines can only be added to draft purchase orders' using errcode = '23514';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_unit_cost is null or p_unit_cost < 0
     or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Quantity, unit cost or tax rate is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.parts p
    where p.id = p_part_id and p.organization_id = v_order.organization_id and p.status = 'active'
  ) then raise exception 'Part is unavailable' using errcode = '23514'; end if;

  insert into public.purchase_order_lines (
    organization_id, branch_id, purchase_order_id, line_no, part_id,
    ordered_quantity, unit_cost, tax_rate
  )
  select v_order.organization_id, v_order.branch_id, v_order.id,
         coalesce(max(l.line_no), 0) + 1, p_part_id, p_quantity, p_unit_cost, p_tax_rate
  from public.purchase_order_lines l
  where l.purchase_order_id = v_order.id
  returning * into v_line;

  update public.purchase_orders p
  set subtotal = totals.subtotal,
      tax_total = totals.tax_total,
      grand_total = totals.subtotal + totals.tax_total
  from (
    select round(sum(l.ordered_quantity * l.unit_cost), 3) as subtotal,
           round(sum(l.ordered_quantity * l.unit_cost * l.tax_rate / 100), 3) as tax_total
    from public.purchase_order_lines l where l.purchase_order_id = v_order.id
  ) totals
  where p.id = v_order.id;

  insert into public.supplier_parts (organization_id, supplier_id, part_id, last_cost, currency)
  values (v_order.organization_id, v_order.supplier_id, p_part_id, p_unit_cost, v_order.currency)
  on conflict (supplier_id, part_id) do update
    set last_cost = excluded.last_cost, currency = excluded.currency;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_order.organization_id, auth.uid(), 'purchase_order.line_added', 'purchase_order', v_order.id,
    jsonb_build_object('line_id', v_line.id, 'part_id', p_part_id)
  );
  return v_line;
end;
$$;

create or replace function public.transition_purchase_order(
  p_purchase_order_id uuid,
  p_to_status text
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_allowed boolean;
begin
  select * into v_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'purchasing.manage') then
    raise exception 'Not authorized to progress this purchase order' using errcode = '42501';
  end if;

  v_allowed := case v_order.status
    when 'draft' then p_to_status in ('submitted', 'cancelled')
    when 'submitted' then p_to_status in ('draft', 'confirmed', 'cancelled')
    when 'confirmed' then p_to_status = 'cancelled'
    when 'partially_received' then p_to_status = 'closed'
    when 'received' then p_to_status = 'closed'
    else false
  end;
  if not v_allowed then
    raise exception 'Invalid purchase order transition: % to %', v_order.status, p_to_status using errcode = '22023';
  end if;

  update public.purchase_orders
  set status = p_to_status,
      ordered_at = case when p_to_status = 'submitted' then coalesce(ordered_at, clock_timestamp()) else ordered_at end
  where id = v_order.id returning * into v_order;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_order.organization_id, auth.uid(), 'purchase_order.transitioned', 'purchase_order', v_order.id,
    jsonb_build_object('to_status', p_to_status)
  );
  return v_order;
end;
$$;

create or replace function public.receive_purchase_order_line(
  p_purchase_order_line_id uuid,
  p_quantity numeric,
  p_destination_bin_id uuid,
  p_supplier_document_no text,
  p_supplier_lot text,
  p_serial_no text,
  p_expiry_date date,
  p_idempotency_key text
)
returns public.goods_receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.purchase_order_lines%rowtype;
  v_order public.purchase_orders%rowtype;
  v_part public.parts%rowtype;
  v_branch_code text;
  v_receipt public.goods_receipts%rowtype;
  v_lot public.stock_lots%rowtype;
  v_receipt_number text;
  v_supplier_lot text := nullif(trim(p_supplier_lot), '');
  v_serial_no text := nullif(trim(p_serial_no), '');
  v_remaining numeric(18,3);
begin
  select * into v_line from public.purchase_order_lines
  where id = p_purchase_order_line_id for update;
  if not found then raise exception 'Purchase order line not found' using errcode = 'P0002'; end if;
  select * into strict v_order from public.purchase_orders where id = v_line.purchase_order_id for update;

  if not app_private.has_permission(v_order.organization_id, v_order.branch_id, 'purchasing.manage') then
    raise exception 'Not authorized to receive this purchase order' using errcode = '42501';
  end if;
  if v_order.status not in ('confirmed', 'partially_received') then
    raise exception 'Only confirmed purchase orders can be received' using errcode = '23514';
  end if;
  if p_quantity is null or p_quantity <= 0 or nullif(trim(p_idempotency_key), '') is null
     or length(p_idempotency_key) > 200 then
    raise exception 'Receipt quantity or idempotency key is invalid' using errcode = '22023';
  end if;

  select r.* into v_receipt
  from public.stock_movements m
  join public.goods_receipts r on r.id = m.source_id
  where m.organization_id = v_order.organization_id
    and m.source_type = 'purchase_receipt'
    and m.idempotency_key = p_idempotency_key;
  if found then return v_receipt; end if;

  v_remaining := v_line.ordered_quantity - v_line.received_quantity;
  if p_quantity > v_remaining then
    raise exception 'Receipt exceeds the outstanding order quantity' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.bins b
    where b.id = p_destination_bin_id and b.organization_id = v_order.organization_id
      and b.branch_id = v_order.branch_id and b.status = 'active'
  ) then raise exception 'Destination bin is unavailable' using errcode = '23514'; end if;

  select * into strict v_part from public.parts
  where id = v_line.part_id and organization_id = v_order.organization_id and status = 'active';

  if v_part.tracking = 'none' then
    if v_supplier_lot is not null or v_serial_no is not null or p_expiry_date is not null then
      raise exception 'This part does not use lot or serial tracking' using errcode = '22023';
    end if;
  elsif v_part.tracking = 'lot' then
    if v_supplier_lot is null or v_serial_no is not null then
      raise exception 'A supplier lot is required for this part' using errcode = '22023';
    end if;
  elsif v_part.tracking = 'serial' then
    if v_serial_no is null or p_quantity <> 1 then
      raise exception 'Serialized receipts require one serial number and quantity 1' using errcode = '22023';
    end if;
  end if;

  if v_part.tracking <> 'none' then
    select * into v_lot from public.stock_lots l
    where l.organization_id = v_order.organization_id and l.part_id = v_part.id
      and l.supplier_lot is not distinct from v_supplier_lot
      and l.serial_no is not distinct from v_serial_no;
    if found and v_lot.unit_cost <> v_line.unit_cost then
      raise exception 'This lot or serial was previously received at a different unit cost' using errcode = '23514';
    elsif not found then
      insert into public.stock_lots (
        organization_id, part_id, supplier_lot, serial_no, expiry_date, unit_cost
      ) values (
        v_order.organization_id, v_part.id, v_supplier_lot, v_serial_no, p_expiry_date, v_line.unit_cost
      ) returning * into v_lot;
    end if;
  end if;

  select b.code into strict v_branch_code from public.branches b
  where b.id = v_order.branch_id and b.organization_id = v_order.organization_id;
  select d.document_number into strict v_receipt_number
  from app_private.take_document_number(
    v_order.organization_id, v_order.branch_id, 'receipt', v_branch_code || '-GR-'
  ) d;

  insert into public.goods_receipts (
    organization_id, branch_id, purchase_order_id, receipt_number,
    supplier_document_no, status, received_by
  ) values (
    v_order.organization_id, v_order.branch_id, v_order.id, v_receipt_number,
    nullif(trim(p_supplier_document_no), ''), 'posted', auth.uid()
  ) returning * into v_receipt;

  insert into public.goods_receipt_lines (
    organization_id, branch_id, goods_receipt_id, purchase_order_line_id,
    destination_bin_id, lot_id, quantity, unit_cost
  ) values (
    v_order.organization_id, v_order.branch_id, v_receipt.id, v_line.id,
    p_destination_bin_id, v_lot.id, p_quantity, v_line.unit_cost
  );

  insert into public.stock_balances (
    organization_id, branch_id, part_id, bin_id, lot_id, on_hand, reserved, average_cost
  ) values (
    v_order.organization_id, v_order.branch_id, v_part.id, p_destination_bin_id,
    v_lot.id, p_quantity, 0, v_line.unit_cost
  ) on conflict (part_id, bin_id, lot_id) do update
  set average_cost = case
        when public.stock_balances.on_hand + excluded.on_hand = 0 then 0
        else ((public.stock_balances.on_hand * public.stock_balances.average_cost)
          + (excluded.on_hand * excluded.average_cost))
          / (public.stock_balances.on_hand + excluded.on_hand)
      end,
      on_hand = public.stock_balances.on_hand + excluded.on_hand;

  insert into public.stock_movements (
    organization_id, branch_id, part_id, lot_id, from_bin_id, to_bin_id,
    quantity, unit_cost, movement_type, source_type, source_id, idempotency_key, posted_by
  ) values (
    v_order.organization_id, v_order.branch_id, v_part.id, v_lot.id, null, p_destination_bin_id,
    p_quantity, v_line.unit_cost, 'receipt', 'purchase_receipt', v_receipt.id, p_idempotency_key, auth.uid()
  );

  update public.purchase_order_lines
  set received_quantity = received_quantity + p_quantity
  where id = v_line.id;

  update public.purchase_orders p
  set status = case when exists (
        select 1 from public.purchase_order_lines l
        where l.purchase_order_id = p.id and l.received_quantity < l.ordered_quantity
      ) then 'partially_received' else 'received' end
  where p.id = v_order.id;

  update public.supplier_parts
  set last_cost = v_line.unit_cost, currency = v_order.currency
  where supplier_id = v_order.supplier_id and part_id = v_part.id;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_order.organization_id, auth.uid(), 'goods_receipt.posted', 'goods_receipt', v_receipt.id,
    jsonb_build_object('purchase_order_id', v_order.id, 'line_id', v_line.id, 'quantity', p_quantity)
  );
  return v_receipt;
end;
$$;

revoke all on function public.create_supplier(uuid, text, text, text, text) from public, anon;
revoke all on function public.create_purchase_order(uuid, uuid, uuid, uuid, numeric, numeric, numeric) from public, anon;
revoke all on function public.add_purchase_order_line(uuid, uuid, numeric, numeric, numeric) from public, anon;
revoke all on function public.transition_purchase_order(uuid, text) from public, anon;
revoke all on function public.receive_purchase_order_line(uuid, numeric, uuid, text, text, text, date, text) from public, anon;

grant execute on function public.create_supplier(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_purchase_order(uuid, uuid, uuid, uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.add_purchase_order_line(uuid, uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.transition_purchase_order(uuid, text) to authenticated;
grant execute on function public.receive_purchase_order_line(uuid, numeric, uuid, text, text, text, date, text) to authenticated;
