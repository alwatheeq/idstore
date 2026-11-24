-- Booking and approved-scope handoffs retain source IDs and serialize on their parent.
create function public.book_waitlist_entry(p_waitlist_id uuid,p_start_at timestamptz,p_end_at timestamptz,p_service_version_ids uuid[],p_resource_id uuid default null,p_advisor_user_id uuid default null,p_promised_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare w public.appointment_waitlist%rowtype; ids uuid[];
begin
 select * into strict w from public.appointment_waitlist where id=p_waitlist_id for update;
 if not app_private.has_permission(w.organization_id,w.branch_id,'appointments.manage') then raise exception 'Not authorized' using errcode='42501'; end if;
 if w.status='booked' then
  if not exists(select 1 from public.appointments a where a.id=w.appointment_id and a.start_at=p_start_at and a.end_at=p_end_at and a.advisor_user_id is not distinct from p_advisor_user_id and a.promised_at is not distinct from p_promised_at)
   or (select array_agg(template_version_id order by template_version_id) from public.appointment_service_items where appointment_id=w.appointment_id) is distinct from (select array_agg(id order by id) from unnest(p_service_version_ids) id)
   or not (case when p_resource_id is null then not exists(select 1 from public.resource_bookings where appointment_id=w.appointment_id and status='active') else exists(select 1 from public.resource_bookings where appointment_id=w.appointment_id and resource_id=p_resource_id and status='active') end)
  then raise exception 'This request already has a different booking' using errcode='23505'; end if;
  return w.appointment_id;
 end if;
 if w.status not in ('waiting','offered') then raise exception 'This request is no longer open' using errcode='23514'; end if;
 if p_end_at-p_start_at<make_interval(mins=>w.duration_minutes) then raise exception 'Booking is shorter than the requested duration' using errcode='22023'; end if;
 if p_start_at<w.preferred_from or p_end_at>w.preferred_to then raise exception 'Choose a slot within the requested window' using errcode='22023'; end if;
 ids:=public.create_catalog_appointments(w.organization_id,w.branch_id,w.customer_id,w.vehicle_id,p_start_at,p_end_at,p_promised_at,w.notes,w.service_mode,w.transport_mode,p_advisor_user_id,p_resource_id,p_service_version_ids,1);
 perform public.transition_waitlist_entry(w.id,'booked',ids[1],'Scheduled from the waitlist');
 return ids[1];
end; $$;
revoke all on function public.book_waitlist_entry(uuid,timestamptz,timestamptz,uuid[],uuid,uuid,timestamptz) from public,anon;
grant execute on function public.book_waitlist_entry(uuid,timestamptz,timestamptz,uuid[],uuid,uuid,timestamptz) to authenticated;

alter table public.estimate_lines add column catalog_part_id uuid references public.parts(id), add column catalog_service_version_id uuid references public.service_template_versions(id);
alter table public.invoice_lines add column catalog_part_id uuid references public.parts(id), add column catalog_service_version_id uuid references public.service_template_versions(id), add column source_estimate_line_id uuid unique references public.estimate_lines(id);
alter table public.jobs add column source_estimate_line_id uuid unique references public.estimate_lines(id);
create index estimate_lines_catalog_part on public.estimate_lines(catalog_part_id);
create index estimate_lines_catalog_service on public.estimate_lines(catalog_service_version_id);
create index invoice_lines_catalog_part on public.invoice_lines(catalog_part_id);
create index invoice_lines_catalog_service on public.invoice_lines(catalog_service_version_id);

create function public.add_order_catalog_item(p_order_id uuid,p_ledger_id uuid,p_invoice_version bigint,p_item_type text,p_catalog_id uuid,p_quantity numeric,p_price numeric,p_tax numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.repair_orders%rowtype; description text; line_id uuid; il public.invoice_lines%rowtype; el public.estimate_lines%rowtype;
begin
 select * into strict r from public.repair_orders where id=p_order_id for update;
 if not app_private.has_branch_access(r.organization_id,r.branch_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if r.status in ('delivered','closed','cancelled') then raise exception 'This order is read-only' using errcode='23514'; end if;
 if p_item_type='part' then
  select concat_ws(' · ',part_number,description_en) into description from public.parts where id=p_catalog_id and organization_id=r.organization_id and status='active';
 elsif p_item_type='labor' then
  select concat_ws(' / ',c.description_en,c.description_ar) into description from public.work_order_service_choices c join public.service_template_versions v on v.id=c.service_version_id join public.service_templates t on t.id=v.template_id
  where c.repair_order_id=r.id and c.service_version_id=p_catalog_id and t.work_order_type=r.order_type limit 1;
 end if;
 if description is null then raise exception 'Select an available part or inspection service' using errcode='22023'; end if;
 if p_invoice_version is not null then
  if not exists(select 1 from public.invoices where id=p_ledger_id and repair_order_id=r.id) then raise exception 'Invoice does not belong to order' using errcode='23514'; end if;
  il:=public.add_invoice_line(p_ledger_id,p_invoice_version,p_item_type,description,p_quantity,p_price,0,p_tax);
  update public.invoice_lines set catalog_part_id=case when p_item_type='part' then p_catalog_id end,catalog_service_version_id=case when p_item_type='labor' then p_catalog_id end where id=il.id;
  line_id:=il.id;
 else
  if not exists(select 1 from public.estimate_versions where id=p_ledger_id and repair_order_id=r.id) then raise exception 'Estimate does not belong to order' using errcode='23514'; end if;
  el:=public.add_estimate_line(p_ledger_id,p_item_type,description,p_quantity,p_price,0,p_tax,'General',null);
  update public.estimate_lines set catalog_part_id=case when p_item_type='part' then p_catalog_id end,catalog_service_version_id=case when p_item_type='labor' then p_catalog_id end where id=el.id;
  line_id:=el.id;
 end if;
 return jsonb_build_object('id',line_id);
end; $$;
revoke all on function public.add_order_catalog_item(uuid,uuid,bigint,text,uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.add_order_catalog_item(uuid,uuid,bigint,text,uuid,numeric,numeric,numeric) to authenticated;

create function public.materialize_approved_estimate(p_estimate_id uuid,p_target text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.estimate_versions%rowtype; r public.repair_orders%rowtype; i public.invoices%rowtype; l public.estimate_lines%rowtype; il public.invoice_lines%rowtype; j public.jobs%rowtype; minutes integer; count_lines integer:=0;
begin
 select * into strict r from public.repair_orders where id=(select repair_order_id from public.estimate_versions where id=p_estimate_id) for update;
 if p_target is null or p_target not in ('invoice','jobs') then raise exception 'Invalid handoff' using errcode='22023'; end if;
 if not app_private.has_permission(r.organization_id,r.branch_id,case when p_target='invoice' then 'invoice.post' else 'workshop.dispatch' end) then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into strict e from public.estimate_versions where id=p_estimate_id for update;
 if e.status not in ('approved','partially_approved') or r.status='cancelled' then raise exception 'Approved estimate scope is required' using errcode='23514'; end if;
 if p_target='invoice' then
  select * into i from public.invoices where repair_order_id=r.id for update;
  if not found then i:=public.create_invoice_from_repair_order(r.id); end if;
  if i.status<>'draft' then raise exception 'Posted invoices cannot receive additional estimate lines; use the correction workflow' using errcode='23514'; end if;
 end if;
 for l in select el.* from public.estimate_lines el where el.estimate_version_id=e.id and el.line_type<>'text'
  and (e.status='approved' or (select a.decision from public.estimate_approvals a where a.estimate_version_id=e.id and a.approval_group=coalesce(el.approval_group,'General') order by a.decided_at desc,a.id desc limit 1)='approved') order by el.line_no loop
  if p_target='invoice' and not exists(select 1 from public.invoice_lines where source_estimate_line_id=l.id) then
   select * into i from public.invoices where id=i.id;
   il:=public.add_invoice_line(i.id,i.version,l.line_type,l.description_snapshot,l.quantity,l.unit_price,l.discount_amount,l.tax_rate);
   update public.invoice_lines set source_estimate_line_id=l.id,catalog_part_id=l.catalog_part_id,catalog_service_version_id=l.catalog_service_version_id where id=il.id;
   count_lines:=count_lines+1;
  elsif p_target='jobs' and l.line_type='labor' and not exists(select 1 from public.jobs where source_estimate_line_id=l.id) then
   select coalesce(sum(standard_minutes),0)*l.quantity into minutes from public.service_template_tasks where version_id=l.catalog_service_version_id;
   if exists(select 1 from public.service_template_tasks where version_id=l.catalog_service_version_id and nullif(required_qualification_code,'') is not null) then raise exception 'Specialist service scope must be dispatched with its required qualifications' using errcode='23514'; end if;
   j:=public.create_job(r.id,l.description_snapshot,'','normal','',minutes);
   update public.jobs set source_estimate_line_id=l.id where id=j.id;
   count_lines:=count_lines+1;
  end if;
 end loop;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(r.organization_id,auth.uid(),'estimate.scope_materialized','estimate',e.id,jsonb_build_object('target',p_target,'created_lines',count_lines,'invoice_id',i.id));
 return case when p_target='invoice' then i.id else r.id end;
end; $$;
revoke all on function public.materialize_approved_estimate(uuid,text) from public,anon;
grant execute on function public.materialize_approved_estimate(uuid,text) to authenticated;
