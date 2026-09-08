create or replace function app_private.discard_draft_document(p_organization_id uuid,p_kind text,p_id uuid,p_updated_at timestamptz,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_invoice public.invoices%rowtype; v_estimate public.estimate_versions%rowtype;
begin
  if auth.uid() is null or not app_private.is_admin(p_organization_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Enter a reason between 3 and 500 characters.' using errcode='22023'; end if;
  if p_kind='invoice' then
    select * into v_invoice from public.invoices where id=p_id and organization_id=p_organization_id for update;
    if not found then raise exception 'Record not found' using errcode='P0002'; end if;
    if v_invoice.status<>'draft' or v_invoice.posted_at is not null or v_invoice.invoice_number is not null or v_invoice.paid_total<>0 then
      raise exception 'Only unposted drafts can be discarded.' using errcode='22023';
    end if;
    if p_updated_at is null or v_invoice.updated_at<>p_updated_at then raise exception 'This record changed. Refresh the page and try again.' using errcode='40001'; end if;
    -- Restrictive foreign keys prevent deleting allocated, credited or externally referenced documents.
    delete from public.invoice_lines where invoice_id=p_id and organization_id=p_organization_id;
    delete from public.invoices where id=p_id and organization_id=p_organization_id;
  elsif p_kind='estimate' then
    select * into v_estimate from public.estimate_versions where id=p_id and organization_id=p_organization_id for update;
    if not found then raise exception 'Record not found' using errcode='P0002'; end if;
    if v_estimate.status<>'draft' or v_estimate.sent_at is not null or exists(select 1 from public.estimate_approvals where estimate_version_id=p_id) then
      raise exception 'Only unposted drafts can be discarded.' using errcode='22023';
    end if;
    if p_updated_at is null or v_estimate.updated_at<>p_updated_at then raise exception 'This record changed. Refresh the page and try again.' using errcode='40001'; end if;
    -- Preserve version numbering and finding/approval provenance; release the active draft slot.
    update public.estimate_versions set status='superseded',updated_at=clock_timestamp() where id=p_id;
  else raise exception 'Unsupported record type.' using errcode='22023';
  end if;
  insert into audit.events(organization_id,branch_id,actor_id,action,entity_type,entity_id,metadata)
    values(p_organization_id,coalesce(v_invoice.branch_id,v_estimate.branch_id),auth.uid(),'draft.discarded',p_kind,p_id,
      jsonb_build_object('reason',p_reason,'repair_order_id',coalesce(v_invoice.repair_order_id,v_estimate.repair_order_id),'grand_total',coalesce(v_invoice.grand_total,v_estimate.grand_total)));
end;
$$;
create or replace function public.discard_draft_document(p_organization_id uuid,p_kind text,p_id uuid,p_updated_at timestamptz,p_reason text)
returns void language sql security invoker set search_path='' as $$ select app_private.discard_draft_document(p_organization_id,p_kind,p_id,p_updated_at,p_reason); $$;
revoke all on function app_private.discard_draft_document(uuid,text,uuid,timestamptz,text),public.discard_draft_document(uuid,text,uuid,timestamptz,text) from public,anon;
grant execute on function app_private.discard_draft_document(uuid,text,uuid,timestamptz,text),public.discard_draft_document(uuid,text,uuid,timestamptz,text) to authenticated;
