-- Inter-branch transfer, blind cycle-count and deferred-work workflows.

alter table public.stock_transfer_lines
  add column receiving_closed boolean not null default false;

create unique index stock_transfer_lines_part_lot_unique
  on public.stock_transfer_lines(transfer_id, part_id, lot_id) nulls not distinct;

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  bin_id uuid not null references public.bins(id) on delete restrict,
  count_number text not null,
  status text not null default 'counting' check (status in ('counting', 'posted', 'cancelled')),
  snapshot_at timestamptz not null default clock_timestamp(),
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, count_number)
);

create table public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  count_id uuid not null references public.stock_counts(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete restrict,
  bin_id uuid not null references public.bins(id) on delete restrict,
  lot_id uuid references public.stock_lots(id) on delete restrict,
  expected_quantity numeric(18,3) not null check (expected_quantity >= 0),
  counted_quantity numeric(18,3) check (counted_quantity >= 0),
  variance numeric(18,3) generated always as (counted_quantity - expected_quantity) stored,
  counted_by uuid references auth.users(id) on delete set null,
  counted_at timestamptz,
  unique nulls not distinct (count_id, part_id, bin_id, lot_id)
);

create unique index stock_counts_one_active_bin on public.stock_counts(bin_id) where status = 'counting';
create index stock_count_lines_count on public.stock_count_lines(count_id);

create trigger touch_stock_counts_updated_at before update on public.stock_counts
for each row execute function app_private.touch_updated_at();
create trigger assert_stock_counts_branch before insert or update of organization_id, branch_id on public.stock_counts
for each row execute function app_private.assert_branch_organization();
create trigger assert_stock_count_lines_branch before insert or update of organization_id, branch_id on public.stock_count_lines
for each row execute function app_private.assert_branch_organization();

alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;
create policy read_stock_counts on public.stock_counts for select to authenticated
using (app_private.has_branch_access(organization_id, branch_id));
create policy read_stock_count_lines on public.stock_count_lines for select to authenticated
using (app_private.has_branch_access(organization_id, branch_id));
grant select on public.stock_counts, public.stock_count_lines to authenticated;

create or replace function public.create_stock_transfer(p_source_branch_id uuid, p_destination_branch_id uuid)
returns public.stock_transfers
language plpgsql security definer set search_path = ''
as $$
declare
  v_source public.branches%rowtype;
  v_destination public.branches%rowtype;
  v_number text;
  v_transfer public.stock_transfers%rowtype;
begin
  select * into v_source from public.branches where id = p_source_branch_id and status = 'active';
  select * into v_destination from public.branches where id = p_destination_branch_id and status = 'active';
  if v_source.id is null or v_destination.id is null then raise exception 'Both transfer branches must be active' using errcode = 'P0002'; end if;
  if v_source.organization_id <> v_destination.organization_id or v_source.id = v_destination.id then
    raise exception 'Transfer branches must be different and in the same organization' using errcode = '23514';
  end if;
  if not app_private.has_permission(v_source.organization_id, v_source.id, 'inventory.manage')
     or not app_private.has_branch_access(v_destination.organization_id, v_destination.id) then
    raise exception 'Not authorized for both transfer branches' using errcode = '42501';
  end if;
  select document_number into v_number from app_private.take_document_number(v_source.organization_id, v_source.id, 'stock_transfer', 'ST');
  insert into public.stock_transfers (organization_id, source_branch_id, destination_branch_id, transfer_number, created_by)
  values (v_source.organization_id, v_source.id, v_destination.id, v_number, auth.uid()) returning * into v_transfer;
  return v_transfer;
end;
$$;

create or replace function public.add_stock_transfer_line(
  p_transfer_id uuid, p_part_id uuid, p_lot_id uuid,
  p_source_bin_id uuid, p_destination_bin_id uuid, p_quantity numeric
)
returns public.stock_transfer_lines
language plpgsql security definer set search_path = ''
as $$
declare
  v_transfer public.stock_transfers%rowtype;
  v_part public.parts%rowtype;
  v_balance public.stock_balances%rowtype;
  v_line public.stock_transfer_lines%rowtype;
begin
  select * into v_transfer from public.stock_transfers where id = p_transfer_id for update;
  if not found then raise exception 'Stock transfer not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'inventory.manage') then
    raise exception 'Not authorized to prepare this transfer' using errcode = '42501';
  end if;
  if v_transfer.status <> 'draft' or p_quantity is null or p_quantity <= 0 then
    raise exception 'Only a draft transfer accepts positive line quantities' using errcode = '23514';
  end if;
  select * into v_part from public.parts where id = p_part_id and organization_id = v_transfer.organization_id and status = 'active';
  if not found then raise exception 'Active part not found' using errcode = 'P0002'; end if;
  if v_part.tracking <> 'none' and p_lot_id is null then raise exception 'Tracked parts require a lot or serial' using errcode = '23514'; end if;
  if not exists (select 1 from public.bins where id = p_source_bin_id and branch_id = v_transfer.source_branch_id and status = 'active')
     or not exists (select 1 from public.bins where id = p_destination_bin_id and branch_id = v_transfer.destination_branch_id and status = 'active') then
    raise exception 'Source and destination bins must match the transfer branches' using errcode = '23514';
  end if;
  select * into v_balance from public.stock_balances
  where part_id = p_part_id and bin_id = p_source_bin_id and lot_id is not distinct from p_lot_id for update;
  if not found or v_balance.on_hand - v_balance.reserved < p_quantity then
    raise exception 'Insufficient available source stock' using errcode = '23514';
  end if;
  update public.stock_balances set reserved = reserved + p_quantity where id = v_balance.id;
  insert into public.stock_transfer_lines (
    organization_id, transfer_id, part_id, lot_id, source_bin_id, destination_bin_id, requested_quantity
  ) values (
    v_transfer.organization_id, v_transfer.id, p_part_id, p_lot_id, p_source_bin_id, p_destination_bin_id, p_quantity
  ) returning * into v_line;
  return v_line;
end;
$$;

create or replace function public.transition_stock_transfer(p_transfer_id uuid, p_to_status text)
returns public.stock_transfers
language plpgsql security definer set search_path = ''
as $$
declare
  v_transfer public.stock_transfers%rowtype;
  v_line public.stock_transfer_lines%rowtype;
  v_balance public.stock_balances%rowtype;
begin
  select * into v_transfer from public.stock_transfers where id = p_transfer_id for update;
  if not found then raise exception 'Stock transfer not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'inventory.manage') then
    raise exception 'Not authorized to progress this transfer' using errcode = '42501';
  end if;
  if not ((v_transfer.status = 'draft' and p_to_status in ('requested', 'cancelled'))
    or (v_transfer.status = 'requested' and p_to_status in ('approved', 'cancelled'))
    or (v_transfer.status = 'approved' and p_to_status in ('dispatched', 'cancelled'))) then
    raise exception 'Invalid stock-transfer transition' using errcode = '22023';
  end if;
  if p_to_status in ('requested', 'approved', 'dispatched') and not exists (
    select 1 from public.stock_transfer_lines where transfer_id = v_transfer.id
  ) then raise exception 'A transfer requires at least one line' using errcode = '23514'; end if;

  if p_to_status = 'cancelled' then
    for v_line in select * from public.stock_transfer_lines where transfer_id = v_transfer.id loop
      update public.stock_balances set reserved = reserved - v_line.requested_quantity
      where part_id = v_line.part_id and bin_id = v_line.source_bin_id and lot_id is not distinct from v_line.lot_id;
    end loop;
  elsif p_to_status = 'dispatched' then
    for v_line in select * from public.stock_transfer_lines where transfer_id = v_transfer.id order by id for update loop
      select * into v_balance from public.stock_balances
      where part_id = v_line.part_id and bin_id = v_line.source_bin_id and lot_id is not distinct from v_line.lot_id for update;
      if not found or v_balance.on_hand < v_line.requested_quantity or v_balance.reserved < v_line.requested_quantity then
        raise exception 'Reserved transfer stock is no longer available' using errcode = '23514';
      end if;
      update public.stock_balances set on_hand = on_hand - v_line.requested_quantity, reserved = reserved - v_line.requested_quantity
      where id = v_balance.id;
      update public.stock_transfer_lines set shipped_quantity = requested_quantity where id = v_line.id;
      insert into public.stock_movements (
        organization_id, branch_id, part_id, lot_id, from_bin_id, quantity, unit_cost, movement_type,
        source_type, source_id, idempotency_key, posted_by
      ) values (
        v_transfer.organization_id, v_transfer.source_branch_id, v_line.part_id, v_line.lot_id,
        v_line.source_bin_id, v_line.requested_quantity, v_balance.average_cost, 'transfer_out',
        'stock_transfer_line', v_line.id, 'transfer-dispatch:' || v_line.id::text, auth.uid()
      );
    end loop;
  end if;
  update public.stock_transfers set status = p_to_status,
    dispatched_at = case when p_to_status = 'dispatched' then clock_timestamp() else dispatched_at end
  where id = v_transfer.id returning * into v_transfer;
  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_transfer.organization_id, auth.uid(), 'stock_transfer.' || p_to_status, 'stock_transfer', v_transfer.id, '{}'::jsonb);
  return v_transfer;
end;
$$;

create or replace function public.receive_stock_transfer_line(
  p_line_id uuid, p_quantity numeric, p_close_line boolean, p_discrepancy_reason text, p_idempotency_key text
)
returns public.stock_transfers
language plpgsql security definer set search_path = ''
as $$
declare
  v_line public.stock_transfer_lines%rowtype;
  v_transfer public.stock_transfers%rowtype;
  v_cost numeric(18,3);
begin
  select * into v_line from public.stock_transfer_lines where id = p_line_id for update;
  if not found then raise exception 'Transfer line not found' using errcode = 'P0002'; end if;
  select * into v_transfer from public.stock_transfers where id = v_line.transfer_id for update;
  if not app_private.has_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'inventory.manage') then
    raise exception 'Not authorized to receive at the destination branch' using errcode = '42501';
  end if;
  if v_transfer.status not in ('dispatched', 'partially_received') or v_line.receiving_closed then
    raise exception 'Transfer line is not open for receiving' using errcode = '23514';
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > v_line.shipped_quantity - v_line.received_quantity
     or (p_quantity = 0 and not p_close_line)
     or (p_close_line and p_quantity < v_line.shipped_quantity - v_line.received_quantity and nullif(trim(p_discrepancy_reason), '') is null)
     or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Receipt quantity, closure reason or idempotency key is invalid' using errcode = '22023';
  end if;
  if exists (select 1 from public.stock_movements where organization_id = v_transfer.organization_id and idempotency_key = p_idempotency_key) then
    return v_transfer;
  end if;
  select unit_cost into v_cost from public.stock_movements
  where source_type = 'stock_transfer_line' and source_id = v_line.id and movement_type = 'transfer_out';
  if p_quantity > 0 then
    insert into public.stock_balances (organization_id, branch_id, part_id, bin_id, lot_id, on_hand, reserved, average_cost)
    values (v_transfer.organization_id, v_transfer.destination_branch_id, v_line.part_id, v_line.destination_bin_id, v_line.lot_id, p_quantity, 0, v_cost)
    on conflict (part_id, bin_id, lot_id) do update set
      average_cost = case when public.stock_balances.on_hand + excluded.on_hand = 0 then 0 else
        ((public.stock_balances.on_hand * public.stock_balances.average_cost) + (excluded.on_hand * excluded.average_cost)) /
        (public.stock_balances.on_hand + excluded.on_hand) end,
      on_hand = public.stock_balances.on_hand + excluded.on_hand;
    insert into public.stock_movements (
      organization_id, branch_id, part_id, lot_id, to_bin_id, quantity, unit_cost, movement_type,
      source_type, source_id, idempotency_key, posted_by
    ) values (
      v_transfer.organization_id, v_transfer.destination_branch_id, v_line.part_id, v_line.lot_id,
      v_line.destination_bin_id, p_quantity, v_cost, 'transfer_in', 'stock_transfer_line', v_line.id,
      p_idempotency_key, auth.uid()
    );
  end if;
  update public.stock_transfer_lines set received_quantity = received_quantity + p_quantity,
    receiving_closed = p_close_line or received_quantity + p_quantity = shipped_quantity,
    discrepancy_reason = case when p_close_line and received_quantity + p_quantity < shipped_quantity then trim(p_discrepancy_reason) else discrepancy_reason end
  where id = v_line.id;
  update public.stock_transfers set
    status = case when not exists (
      select 1 from public.stock_transfer_lines where transfer_id = v_transfer.id and not receiving_closed
    ) then 'received' else 'partially_received' end,
    received_at = case when not exists (
      select 1 from public.stock_transfer_lines where transfer_id = v_transfer.id and not receiving_closed
    ) then clock_timestamp() else received_at end
  where id = v_transfer.id returning * into v_transfer;
  return v_transfer;
end;
$$;

create or replace function public.create_stock_count(p_bin_id uuid)
returns public.stock_counts
language plpgsql security definer set search_path = ''
as $$
declare
  v_bin public.bins%rowtype;
  v_count public.stock_counts%rowtype;
  v_number text;
begin
  select * into v_bin from public.bins where id = p_bin_id and status = 'active';
  if not found then raise exception 'Active bin not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_bin.organization_id, v_bin.branch_id, 'inventory.manage') then
    raise exception 'Not authorized to count this bin' using errcode = '42501';
  end if;
  v_number := 'CNT-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS');
  insert into public.stock_counts (organization_id, branch_id, warehouse_id, bin_id, count_number, created_by)
  values (v_bin.organization_id, v_bin.branch_id, v_bin.warehouse_id, v_bin.id, v_number, auth.uid()) returning * into v_count;
  insert into public.stock_count_lines (organization_id, branch_id, count_id, part_id, bin_id, lot_id, expected_quantity)
  select organization_id, branch_id, v_count.id, part_id, bin_id, lot_id, on_hand
  from public.stock_balances where bin_id = v_bin.id and on_hand > 0;
  return v_count;
end;
$$;

create or replace function public.record_stock_count_line(p_count_line_id uuid, p_counted_quantity numeric)
returns public.stock_count_lines
language plpgsql security definer set search_path = ''
as $$
declare
  v_line public.stock_count_lines%rowtype;
  v_count public.stock_counts%rowtype;
begin
  select * into v_line from public.stock_count_lines where id = p_count_line_id for update;
  if not found then raise exception 'Stock-count line not found' using errcode = 'P0002'; end if;
  select * into v_count from public.stock_counts where id = v_line.count_id for update;
  if not app_private.has_permission(v_count.organization_id, v_count.branch_id, 'inventory.manage') then
    raise exception 'Not authorized to record this count' using errcode = '42501';
  end if;
  if v_count.status <> 'counting' or p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'Count is closed or quantity is invalid' using errcode = '23514';
  end if;
  update public.stock_count_lines set counted_quantity = p_counted_quantity, counted_by = auth.uid(), counted_at = clock_timestamp()
  where id = v_line.id returning * into v_line;
  return v_line;
end;
$$;

create or replace function public.post_stock_count(p_count_id uuid)
returns public.stock_counts
language plpgsql security definer set search_path = ''
as $$
declare
  v_count public.stock_counts%rowtype;
  v_line public.stock_count_lines%rowtype;
  v_balance public.stock_balances%rowtype;
begin
  select * into v_count from public.stock_counts where id = p_count_id for update;
  if not found then raise exception 'Stock count not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_count.organization_id, v_count.branch_id, 'inventory.manage') then
    raise exception 'Not authorized to post this count' using errcode = '42501';
  end if;
  if v_count.status <> 'counting' or exists (
    select 1 from public.stock_count_lines where count_id = v_count.id and counted_quantity is null
  ) then raise exception 'Every line must be counted before posting' using errcode = '23514'; end if;
  for v_line in select * from public.stock_count_lines where count_id = v_count.id and variance <> 0 order by id for update loop
    select * into v_balance from public.stock_balances where part_id = v_line.part_id and bin_id = v_line.bin_id
      and lot_id is not distinct from v_line.lot_id for update;
    if not found then raise exception 'Count balance no longer exists' using errcode = '23514'; end if;
    update public.stock_balances set on_hand = v_line.counted_quantity where id = v_balance.id;
    insert into public.stock_movements (
      organization_id, branch_id, part_id, lot_id, from_bin_id, to_bin_id, quantity, unit_cost,
      movement_type, source_type, source_id, idempotency_key, posted_by
    ) values (
      v_count.organization_id, v_count.branch_id, v_line.part_id, v_line.lot_id,
      case when v_line.variance < 0 then v_line.bin_id end,
      case when v_line.variance > 0 then v_line.bin_id end,
      abs(v_line.variance), v_balance.average_cost,
      case when v_line.variance > 0 then 'adjustment_gain' else 'adjustment_loss' end,
      'stock_count_line', v_line.id, 'stock-count:' || v_line.id::text, auth.uid()
    );
  end loop;
  update public.stock_counts set status = 'posted', posted_at = clock_timestamp()
  where id = v_count.id returning * into v_count;
  return v_count;
end;
$$;

create or replace function public.create_vehicle_recommendation(
  p_vehicle_id uuid, p_branch_id uuid, p_description text, p_severity text, p_due_date date, p_due_odometer_km integer
)
returns public.vehicle_recommendations
language plpgsql security definer set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_result public.vehicle_recommendations%rowtype;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if not found then raise exception 'Vehicle not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_vehicle.organization_id, p_branch_id, 'repair_order.manage') then
    raise exception 'Not authorized to record deferred work' using errcode = '42501';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and organization_id = v_vehicle.organization_id)
     or nullif(trim(p_description), '') is null or p_severity not in ('amber', 'red', 'safety_stop')
     or (p_due_odometer_km is not null and p_due_odometer_km < 0) then
    raise exception 'Recommendation branch, description, severity or due mileage is invalid' using errcode = '22023';
  end if;
  insert into public.vehicle_recommendations (organization_id, branch_id, vehicle_id, description, severity, due_date, due_odometer_km)
  values (v_vehicle.organization_id, p_branch_id, v_vehicle.id, trim(p_description), p_severity, p_due_date, p_due_odometer_km)
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.transition_vehicle_recommendation(p_recommendation_id uuid, p_to_status text)
returns public.vehicle_recommendations
language plpgsql security definer set search_path = ''
as $$
declare v_result public.vehicle_recommendations%rowtype;
begin
  select * into v_result from public.vehicle_recommendations where id = p_recommendation_id for update;
  if not found then raise exception 'Recommendation not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_result.organization_id, v_result.branch_id, 'repair_order.manage') then
    raise exception 'Not authorized to progress deferred work' using errcode = '42501';
  end if;
  if not ((v_result.status = 'open' and p_to_status in ('scheduled', 'dismissed', 'completed'))
    or (v_result.status = 'scheduled' and p_to_status in ('open', 'completed', 'dismissed'))) then
    raise exception 'Invalid deferred-work transition' using errcode = '22023';
  end if;
  update public.vehicle_recommendations set status = p_to_status where id = v_result.id returning * into v_result;
  return v_result;
end;
$$;

do $$
declare v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.create_stock_transfer(uuid,uuid)'::regprocedure,
    'public.add_stock_transfer_line(uuid,uuid,uuid,uuid,uuid,numeric)'::regprocedure,
    'public.transition_stock_transfer(uuid,text)'::regprocedure,
    'public.receive_stock_transfer_line(uuid,numeric,boolean,text,text)'::regprocedure,
    'public.create_stock_count(uuid)'::regprocedure,
    'public.record_stock_count_line(uuid,numeric)'::regprocedure,
    'public.post_stock_count(uuid)'::regprocedure,
    'public.create_vehicle_recommendation(uuid,uuid,text,text,date,integer)'::regprocedure,
    'public.transition_vehicle_recommendation(uuid,text)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to authenticated', v_signature);
  end loop;
end;
$$;
