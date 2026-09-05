-- Catalog identity, alternative parts, stock disposition, landed cost and three-way supplier matching.

create table public.part_barcodes(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  part_id uuid not null references public.parts(id) on delete cascade, barcode text not null, barcode_type text not null default 'ean13' check(barcode_type in('ean13','upc','code128','qr','other')),
  is_primary boolean not null default false, created_at timestamptz not null default now(), unique(organization_id,barcode)
);
create table public.part_alternatives(
  organization_id uuid not null references public.organizations(id) on delete restrict, part_id uuid not null references public.parts(id) on delete cascade,
  alternative_part_id uuid not null references public.parts(id) on delete cascade, notes text, approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), primary key(part_id,alternative_part_id), check(part_id<>alternative_part_id)
);
create table public.inventory_dispositions(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict, part_id uuid not null references public.parts(id) on delete restrict,
  lot_id uuid references public.stock_lots(id) on delete restrict, source_bin_id uuid not null references public.bins(id) on delete restrict,
  disposition_type text not null check(disposition_type in('supplier_return','scrap')), quantity numeric(18,3) not null check(quantity>0),
  reason text not null, supplier_reference text, movement_id uuid references public.stock_movements(id) on delete restrict,
  recorded_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create table public.supplier_invoices(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict, supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict, supplier_invoice_no text not null, invoice_date date not null,
  currency char(3) not null, merchandise_total numeric(18,3) not null check(merchandise_total>=0), landed_cost_total numeric(18,3) not null default 0 check(landed_cost_total>=0),
  grand_total numeric(18,3) not null check(grand_total>=0), expected_total numeric(18,3) not null, variance_total numeric(18,3) not null,
  match_status text not null check(match_status in('matched','exception','pending_receipt')), evidence_note text,
  recorded_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), unique(supplier_id,supplier_invoice_no)
);
create table public.supplier_invoice_lines(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict, supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete cascade,
  purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete restrict, invoiced_quantity numeric(18,3) not null check(invoiced_quantity>0),
  invoiced_unit_cost numeric(18,3) not null check(invoiced_unit_cost>=0), expected_unit_cost numeric(18,3) not null check(expected_unit_cost>=0),
  quantity_variance numeric(18,3) not null, price_variance numeric(18,3) not null
);
create table public.landed_cost_allocations(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict, supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete cascade,
  goods_receipt_line_id uuid not null references public.goods_receipt_lines(id) on delete restrict, cost_type text not null default 'freight',
  amount numeric(18,3) not null check(amount>=0), allocation_basis text not null default 'value' check(allocation_basis in('value','quantity','manual')), created_at timestamptz not null default now()
);

create trigger assert_branch_organization before insert or update of organization_id,branch_id on public.inventory_dispositions for each row execute function app_private.assert_branch_organization();
create trigger assert_branch_organization before insert or update of organization_id,branch_id on public.supplier_invoices for each row execute function app_private.assert_branch_organization();
create trigger assert_branch_organization before insert or update of organization_id,branch_id on public.supplier_invoice_lines for each row execute function app_private.assert_branch_organization();
create trigger assert_branch_organization before insert or update of organization_id,branch_id on public.landed_cost_allocations for each row execute function app_private.assert_branch_organization();
alter table public.part_barcodes enable row level security; alter table public.part_alternatives enable row level security; alter table public.inventory_dispositions enable row level security;
alter table public.supplier_invoices enable row level security; alter table public.supplier_invoice_lines enable row level security; alter table public.landed_cost_allocations enable row level security;
create policy part_barcodes_select on public.part_barcodes for select to authenticated using(app_private.is_member(organization_id));
create policy part_alternatives_select on public.part_alternatives for select to authenticated using(app_private.is_member(organization_id));
create policy inventory_dispositions_select on public.inventory_dispositions for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));
create policy supplier_invoices_select on public.supplier_invoices for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));
create policy supplier_invoice_lines_select on public.supplier_invoice_lines for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));
create policy landed_cost_allocations_select on public.landed_cost_allocations for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));
grant select on public.part_barcodes,public.part_alternatives,public.inventory_dispositions,public.supplier_invoices,public.supplier_invoice_lines,public.landed_cost_allocations to authenticated;

create or replace function public.configure_part_catalog(p_part_id uuid,p_hazardous_classification text,p_barcode text,p_barcode_type text,p_related_part_id uuid,p_relationship text,p_notes text)
returns public.parts language plpgsql security definer set search_path='' as $$ declare v_part public.parts%rowtype; begin
 select * into strict v_part from public.parts where id=p_part_id for update;
 if not app_private.is_admin(v_part.organization_id) then raise exception 'Only administrators can govern the parts catalog' using errcode='42501'; end if;
 update public.parts set hazardous_classification=nullif(trim(p_hazardous_classification),'') where id=v_part.id returning * into v_part;
 if nullif(trim(p_barcode),'') is not null then insert into public.part_barcodes(organization_id,part_id,barcode,barcode_type,is_primary) values(v_part.organization_id,v_part.id,trim(p_barcode),coalesce(nullif(p_barcode_type,''),'other'),true) on conflict(organization_id,barcode) do update set part_id=excluded.part_id,barcode_type=excluded.barcode_type; end if;
 if p_related_part_id is not null and p_related_part_id<>v_part.id and exists(select 1 from public.parts where id=p_related_part_id and organization_id=v_part.organization_id) then
   if p_relationship='superseded_by' then insert into public.part_supersessions(organization_id,old_part_id,new_part_id,effective_at,source) values(v_part.organization_id,v_part.id,p_related_part_id,current_date,nullif(trim(p_notes),'')) on conflict do nothing; update public.parts set status='superseded' where id=v_part.id;
   elsif p_relationship='alternative' then insert into public.part_alternatives(organization_id,part_id,alternative_part_id,notes,approved_by) values(v_part.organization_id,v_part.id,p_related_part_id,nullif(trim(p_notes),''),auth.uid()) on conflict(part_id,alternative_part_id) do update set notes=excluded.notes,approved_by=excluded.approved_by; else raise exception 'Relationship is invalid' using errcode='22023'; end if;
 end if;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_part.organization_id,auth.uid(),'part.catalog_configured','part',v_part.id,jsonb_build_object('hazard',v_part.hazardous_classification,'barcode',nullif(trim(p_barcode),''),'relationship',nullif(p_relationship,'')));
 return v_part;
end; $$;

create or replace function public.record_inventory_disposition(p_stock_balance_id uuid,p_quantity numeric,p_disposition_type text,p_reason text,p_supplier_reference text,p_idempotency_key text)
returns public.inventory_dispositions language plpgsql security definer set search_path='' as $$ declare v_balance public.stock_balances%rowtype; v_move public.stock_movements%rowtype; v_row public.inventory_dispositions%rowtype; v_source uuid:=gen_random_uuid(); begin
 select * into strict v_balance from public.stock_balances where id=p_stock_balance_id for update;
 if not app_private.has_permission(v_balance.organization_id,v_balance.branch_id,'inventory.manage') then raise exception 'Not authorized to dispose stock' using errcode='42501'; end if;
 if p_quantity is null or p_quantity<=0 or p_disposition_type not in('supplier_return','scrap') or nullif(trim(p_reason),'') is null then raise exception 'Disposition details are invalid' using errcode='22023'; end if;
 select * into v_move from public.post_stock_movement(v_balance.organization_id,v_balance.branch_id,v_balance.part_id,v_balance.lot_id,v_balance.bin_id,null,p_quantity,v_balance.average_cost,p_disposition_type,'inventory_disposition',v_source,p_idempotency_key);
 insert into public.inventory_dispositions(organization_id,branch_id,part_id,lot_id,source_bin_id,disposition_type,quantity,reason,supplier_reference,movement_id,recorded_by) values(v_balance.organization_id,v_balance.branch_id,v_balance.part_id,v_balance.lot_id,v_balance.bin_id,p_disposition_type,p_quantity,trim(p_reason),nullif(trim(p_supplier_reference),''),v_move.id,auth.uid()) returning * into v_row; return v_row;
end; $$;

create or replace function public.record_supplier_invoice(p_purchase_order_id uuid,p_supplier_invoice_no text,p_invoice_date date,p_landed_cost numeric,p_lines jsonb,p_evidence_note text)
returns public.supplier_invoices language plpgsql security definer set search_path='' as $$
declare v_po public.purchase_orders%rowtype; v_invoice public.supplier_invoices%rowtype; v_line jsonb; v_po_line public.purchase_order_lines%rowtype; v_merch numeric:=0; v_expected numeric:=0; v_received numeric; v_pending boolean:=false; v_receipt_total numeric; v_receipt record;
begin
 select * into strict v_po from public.purchase_orders where id=p_purchase_order_id for update;
 if not app_private.has_permission(v_po.organization_id,v_po.branch_id,'purchasing.manage') then raise exception 'Not authorized to record supplier invoices' using errcode='42501'; end if;
 if v_po.status not in('partially_received','received','closed') or nullif(trim(p_supplier_invoice_no),'') is null or p_invoice_date is null or coalesce(p_landed_cost,0)<0 or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Supplier invoice details are invalid' using errcode='22023'; end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
   select * into strict v_po_line from public.purchase_order_lines where id=(v_line->>'purchase_order_line_id')::uuid and purchase_order_id=v_po.id;
   if (v_line->>'quantity')::numeric<=0 or (v_line->>'unit_cost')::numeric<0 then raise exception 'Supplier invoice line is invalid' using errcode='22023'; end if;
   select coalesce(sum(quantity),0) into v_received from public.goods_receipt_lines where purchase_order_line_id=v_po_line.id;
   if v_received<(v_line->>'quantity')::numeric then v_pending:=true; end if;
   v_merch:=v_merch+(v_line->>'quantity')::numeric*(v_line->>'unit_cost')::numeric; v_expected:=v_expected+(v_line->>'quantity')::numeric*v_po_line.unit_cost;
 end loop;
 insert into public.supplier_invoices(organization_id,branch_id,supplier_id,purchase_order_id,supplier_invoice_no,invoice_date,currency,merchandise_total,landed_cost_total,grand_total,expected_total,variance_total,match_status,evidence_note,recorded_by)
 values(v_po.organization_id,v_po.branch_id,v_po.supplier_id,v_po.id,trim(p_supplier_invoice_no),p_invoice_date,v_po.currency,round(v_merch,3),round(coalesce(p_landed_cost,0),3),round(v_merch+coalesce(p_landed_cost,0),3),round(v_expected+coalesce(p_landed_cost,0),3),round(v_merch-v_expected,3),case when v_pending then 'pending_receipt' when abs(v_merch-v_expected)<=0.01 then 'matched' else 'exception' end,nullif(trim(p_evidence_note),''),auth.uid()) returning * into v_invoice;
 for v_line in select value from jsonb_array_elements(p_lines) loop select * into strict v_po_line from public.purchase_order_lines where id=(v_line->>'purchase_order_line_id')::uuid;
   select coalesce(sum(quantity),0) into v_received from public.goods_receipt_lines where purchase_order_line_id=v_po_line.id;
   insert into public.supplier_invoice_lines(organization_id,branch_id,supplier_invoice_id,purchase_order_line_id,invoiced_quantity,invoiced_unit_cost,expected_unit_cost,quantity_variance,price_variance) values(v_po.organization_id,v_po.branch_id,v_invoice.id,v_po_line.id,(v_line->>'quantity')::numeric,(v_line->>'unit_cost')::numeric,v_po_line.unit_cost,(v_line->>'quantity')::numeric-v_received,((v_line->>'unit_cost')::numeric-v_po_line.unit_cost)*(v_line->>'quantity')::numeric);
 end loop;
 select coalesce(sum(grl.quantity*grl.unit_cost),0) into v_receipt_total from public.goods_receipt_lines grl join public.goods_receipts gr on gr.id=grl.goods_receipt_id where gr.purchase_order_id=v_po.id;
 if coalesce(p_landed_cost,0)>0 and v_receipt_total>0 then for v_receipt in select grl.id,grl.quantity*grl.unit_cost value from public.goods_receipt_lines grl join public.goods_receipts gr on gr.id=grl.goods_receipt_id where gr.purchase_order_id=v_po.id loop insert into public.landed_cost_allocations(organization_id,branch_id,supplier_invoice_id,goods_receipt_line_id,amount) values(v_po.organization_id,v_po.branch_id,v_invoice.id,v_receipt.id,round(p_landed_cost*v_receipt.value/v_receipt_total,3)); end loop; end if;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_po.organization_id,auth.uid(),'supplier_invoice.recorded','supplier_invoice',v_invoice.id,jsonb_build_object('match_status',v_invoice.match_status,'variance',v_invoice.variance_total)); return v_invoice;
end; $$;

do $$ declare r regprocedure; begin foreach r in array array['public.configure_part_catalog(uuid,text,text,text,uuid,text,text)'::regprocedure,'public.record_inventory_disposition(uuid,numeric,text,text,text,text)'::regprocedure,'public.record_supplier_invoice(uuid,text,date,numeric,jsonb,text)'::regprocedure] loop execute format('revoke all on function %s from public,anon,authenticated',r); execute format('grant execute on function %s to authenticated',r); end loop; end $$;
