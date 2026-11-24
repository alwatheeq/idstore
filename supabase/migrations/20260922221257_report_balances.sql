-- Uncapped, permission-scoped financial balances and server-side report aggregates.
create function public.invoice_balance_summary(p_organization_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.is_member(p_organization_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 return (select coalesce(jsonb_object_agg(i.id,app_private.invoice_net_due(i.id)),'{}') from public.invoices i where i.organization_id=p_organization_id and app_private.has_branch_access(i.organization_id,i.branch_id));
end; $$;
revoke all on function public.invoice_balance_summary(uuid) from public,anon;
grant execute on function public.invoice_balance_summary(uuid) to authenticated;

create function public.branch_report(p_organization_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ops boolean; finance boolean; result jsonb;
begin
 ops:=app_private.has_permission(p_organization_id,null,'report.operations.read');
 finance:=app_private.has_permission(p_organization_id,null,'report.finance.read');
 if not ops and not finance then raise exception 'Reporting access is not assigned' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'code',b.code,'city',b.city,'display_name',b.display_name,'status',b.status,
'openOrders',case when ops then coalesce((select count(*) from public.repair_orders r where r.branch_id=b.id and r.status not in ('delivered','closed','cancelled')),0) else 0 end,
'overdue',case when ops then coalesce((select count(*) from public.repair_orders r where r.branch_id=b.id and r.status not in ('delivered','closed','cancelled') and r.promised_at<now()),0) else 0 end,
'appointments',case when ops then coalesce((select count(*) from public.appointments a where a.branch_id=b.id and a.status in ('requested','confirmed','checked_in')),0) else 0 end,
'noShows',case when ops then coalesce((select count(*) from public.appointments a where a.branch_id=b.id and a.status='no_show'),0) else 0 end,
'completedCount',case when ops then coalesce((select count(*) from public.repair_orders r where r.branch_id=b.id and r.closed_at is not null),0) else 0 end,
'averageCycleHours',case when ops then coalesce((select coalesce(avg(extract(epoch from (r.closed_at-r.opened_at))/3600),0) from public.repair_orders r where r.branch_id=b.id and r.closed_at is not null),0) else 0 end,
'laborAttainment',case when ops then coalesce((select coalesce(sum(extract(epoch from (l.ended_at-l.started_at))/60),0) from public.labor_entries l where l.branch_id=b.id) / nullif((select sum(j.planned_minutes) from public.jobs j where j.branch_id=b.id and j.status<>'cancelled'),0)*100,0) else 0 end,
'approvalRate',case when ops then coalesce((select 100.0*count(*)filter(where e.status='approved')/nullif(count(*),0) from public.estimate_versions e where e.branch_id=b.id and e.status in ('approved','declined')),0) else 0 end,
'approvedCount',case when ops then coalesce((select count(*) from public.estimate_versions e where e.branch_id=b.id and e.status='approved'),0) else 0 end,
'decidedCount',case when ops then coalesce((select count(*) from public.estimate_versions e where e.branch_id=b.id and e.status in ('approved','declined')),0) else 0 end,
'inventoryValue',case when ops then coalesce((select coalesce(sum(s.on_hand*s.average_cost),0) from public.stock_balances s where s.branch_id=b.id),0) else 0 end,
'availableUnits',case when ops then coalesce((select coalesce(sum(greatest(0,s.on_hand-s.reserved)),0) from public.stock_balances s where s.branch_id=b.id),0) else 0 end,
'safetyDeferred',case when ops then coalesce((select count(*) from public.vehicle_recommendations v where v.branch_id=b.id and v.severity='safety_stop' and v.status in ('open','scheduled')),0) else 0 end,
'billed',case when finance then coalesce((select coalesce(sum(i.grand_total),0) from public.invoices i where i.branch_id=b.id and i.status not in ('draft','void')),0) else 0 end,
'outstanding',case when finance then coalesce((select coalesce(sum(app_private.invoice_net_due(i.id)),0) from public.invoices i where i.branch_id=b.id),0) else 0 end,
'collected',case when finance then coalesce((select coalesce(sum(p.amount),0) from public.payments p where p.branch_id=b.id and p.status in ('received','partially_refunded','refunded'))-(select coalesce(sum(r.amount),0) from public.payment_refunds r where r.branch_id=b.id and r.status='recorded'),0) else 0 end ) order by b.city,b.id),'[]') into result from public.branches b where b.organization_id=p_organization_id and app_private.has_branch_access(b.organization_id,b.id);
 return result;
end; $$;
revoke all on function public.branch_report(uuid) from public,anon;
grant execute on function public.branch_report(uuid) to authenticated;
