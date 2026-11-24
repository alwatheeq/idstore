-- Explicit order-linked reservation, issue and return. No stock movement is implied by pricing.
create table public.order_stock (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), branch_id uuid not null references public.branches(id),
 repair_order_id uuid not null references public.repair_orders(id), stock_balance_id uuid not null references public.stock_balances(id),
 quantity numeric(18,3) not null check(quantity>0), returned_quantity numeric(18,3) not null default 0 check(returned_quantity>=0 and returned_quantity<=quantity),
 status text not null default 'reserved' check(status in ('reserved','issued','released')), version bigint not null default 1,
 idempotency_key text not null, created_at timestamptz not null default now(), unique(organization_id,idempotency_key)
);
create index order_stock_order on public.order_stock(repair_order_id);
create index order_stock_balance on public.order_stock(stock_balance_id);
alter table public.order_stock enable row level security;
revoke all on public.order_stock from anon,authenticated;
grant select on public.order_stock to authenticated;
create policy order_stock_read on public.order_stock for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));
create function public.manage_order_stock(p_order_id uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.repair_orders%rowtype; s public.order_stock%rowtype; b public.stock_balances%rowtype; m public.stock_movements%rowtype;
 qty numeric; key text:=nullif(trim(p_data->>'key'),''); expected bigint; stock_id uuid;
begin
 select * into strict r from public.repair_orders where id=p_order_id for update;
 if not app_private.has_permission(r.organization_id,r.branch_id,'inventory.manage') then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_action is null or p_action not in ('reserve','issue','release','return') or key is null then raise exception 'Invalid stock action' using errcode='22023'; end if;
 if p_action='reserve' then
  qty:=(p_data->>'quantity')::numeric; stock_id:=(p_data->>'balance_id')::uuid;
  select * into s from public.order_stock where organization_id=r.organization_id and idempotency_key=key;
  if found then
   if s.repair_order_id<>r.id or s.stock_balance_id is distinct from stock_id or s.quantity is distinct from qty then raise exception 'Reference belongs to another reservation' using errcode='23505'; end if;
   return to_jsonb(s);
  end if;
  if r.status in ('ready','delivered','closed','cancelled') then raise exception 'Reopen this order before reserving parts' using errcode='23514'; end if;
  select * into strict b from public.stock_balances where id=stock_id and organization_id=r.organization_id and branch_id=r.branch_id for update;
  if qty is null or qty::text in ('NaN','Infinity','-Infinity') or qty<=0 or qty<>round(qty,3) or qty>b.on_hand-b.reserved then raise exception 'Enter an available stock quantity' using errcode='23514'; end if;
  if exists(select 1 from public.parts where id=b.part_id and tracking='serial') and qty<>1 then raise exception 'Serialized parts require quantity one' using errcode='23514'; end if;
  if exists(select 1 from public.bins where id=b.bin_id and (status<>'active' or bin_type='quarantine')) then raise exception 'Stock is not available for workshop use' using errcode='23514'; end if;
  update public.stock_balances set reserved=reserved+qty where id=b.id;
  insert into public.order_stock(organization_id,branch_id,repair_order_id,stock_balance_id,quantity,idempotency_key) values(r.organization_id,r.branch_id,r.id,b.id,qty,key) returning * into s;
 else
  select * into strict s from public.order_stock where id=(p_data->>'id')::uuid and repair_order_id=r.id for update;
  select * into strict b from public.stock_balances where id=s.stock_balance_id for update;
  select * into m from public.stock_movements where organization_id=r.organization_id and idempotency_key=key;
  if found then
   if m.source_id<>s.id or m.movement_type<>(case when p_action='return' then 'return' else 'issue' end) or (p_action='return' and m.quantity is distinct from (p_data->>'quantity')::numeric) then raise exception 'Reference belongs to another movement' using errcode='23505'; end if;
   return to_jsonb(s);
  end if;
  expected:=(p_data->>'version')::bigint;
  if expected is distinct from s.version then raise exception 'Stock record changed; refresh first' using errcode='40001'; end if;
  if p_action in ('issue','release') then
   if s.status<>'reserved' then raise exception 'Only reserved stock can be issued or released' using errcode='23514'; end if;
   if p_action='issue' and r.status in ('ready','delivered','closed','cancelled') then raise exception 'Reopen this order before issuing parts' using errcode='23514'; end if;
   if p_action='issue' and exists(select 1 from public.bins where id=b.bin_id and (status<>'active' or bin_type='quarantine')) then raise exception 'Stock is no longer available for workshop use' using errcode='23514'; end if;
   update public.stock_balances set reserved=reserved-s.quantity where id=b.id;
   if p_action='issue' then perform public.post_stock_movement(r.organization_id,r.branch_id,b.part_id,b.lot_id,b.bin_id,null,s.quantity,b.average_cost,'issue','order_stock',s.id,key); end if;
   update public.order_stock set status=case when p_action='issue' then 'issued' else 'released' end,version=version+1 where id=s.id returning * into s;
  else
   qty:=(p_data->>'quantity')::numeric;
   if s.status<>'issued' or qty is null or qty::text in ('NaN','Infinity','-Infinity') or qty<=0 or qty<>round(qty,3) or qty>s.quantity-s.returned_quantity then raise exception 'Return cannot exceed issued quantity' using errcode='23514'; end if;
   if exists(select 1 from public.parts where id=b.part_id and tracking='serial') and qty<>1 then raise exception 'Serialized parts require quantity one' using errcode='23514'; end if;
   select * into strict m from public.stock_movements where source_type='order_stock' and source_id=s.id and movement_type='issue';
   perform public.post_stock_movement(r.organization_id,r.branch_id,b.part_id,b.lot_id,null,b.bin_id,qty,m.unit_cost,'return','order_stock',s.id,key);
   update public.order_stock set returned_quantity=returned_quantity+qty,version=version+1 where id=s.id returning * into s;
  end if;
 end if;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(r.organization_id,auth.uid(),'order_stock.'||p_action,'repair_order',r.id,to_jsonb(s));
 return to_jsonb(s);
end; $$;
revoke all on function public.manage_order_stock(uuid,text,jsonb) from public,anon;
grant execute on function public.manage_order_stock(uuid,text,jsonb) to authenticated;
