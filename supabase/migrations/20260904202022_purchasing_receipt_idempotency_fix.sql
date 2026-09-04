-- A retried receipt must return the original document even after that receipt
-- moved the purchase order to its terminal received state.

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
  if nullif(trim(p_idempotency_key), '') is null or length(p_idempotency_key) > 200 then
    raise exception 'Receipt idempotency key is invalid' using errcode = '22023';
  end if;

  select r.* into v_receipt
  from public.stock_movements m
  join public.goods_receipts r on r.id = m.source_id
  where m.organization_id = v_order.organization_id
    and m.source_type = 'purchase_receipt'
    and m.idempotency_key = p_idempotency_key;
  if found then return v_receipt; end if;

  if v_order.status not in ('confirmed', 'partially_received') then
    raise exception 'Only confirmed purchase orders can be received' using errcode = '23514';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Receipt quantity is invalid' using errcode = '22023';
  end if;

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

revoke all on function public.receive_purchase_order_line(uuid, numeric, uuid, text, text, text, date, text) from public, anon;
grant execute on function public.receive_purchase_order_line(uuid, numeric, uuid, text, text, text, date, text) to authenticated;
