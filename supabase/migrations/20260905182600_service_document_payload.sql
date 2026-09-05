-- One document projection serves authorized staff and the owning customer while
-- keeping draft commercial documents internal to the workshop.
create or replace function public.service_document(
  p_document_type text,
  p_document_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_estimate public.estimate_versions%rowtype;
  v_order public.repair_orders%rowtype;
  v_customer_id uuid;
  v_is_customer boolean;
  v_result jsonb;
begin
  if p_document_type = 'invoice' then
    select * into v_invoice from public.invoices where id = p_document_id;
    if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;

    v_customer_id := v_invoice.customer_id;
    v_is_customer := exists (
      select 1 from public.customer_accounts account
      where account.organization_id = v_invoice.organization_id
        and account.customer_id = v_invoice.customer_id
        and account.auth_user_id = auth.uid()
        and account.status = 'active'
    );
    if not app_private.has_permission(v_invoice.organization_id, v_invoice.branch_id, 'invoice.post')
       and not v_is_customer then
      raise exception 'Not authorized to read this invoice' using errcode = '42501';
    end if;
    if v_is_customer and v_invoice.status = 'draft' then
      raise exception 'Draft documents are not available to customers' using errcode = '42501';
    end if;

    select jsonb_strip_nulls(jsonb_build_object(
      'type', 'invoice',
      'number', coalesce(i.invoice_number, 'DRAFT'),
      'status', i.status,
      'currency', i.currency,
      'subtotal', i.subtotal,
      'discount', i.discount_total,
      'tax', i.tax_total,
      'total', i.grand_total,
      'paid', i.paid_total,
      'hash', i.document_hash,
      'issued_at', coalesce(i.posted_at, i.created_at),
      'seller', i.seller_snapshot,
      'buyer', i.buyer_snapshot,
      'repair_order', r.ro_number,
      'vehicle', jsonb_strip_nulls(jsonb_build_object(
        'vin', v.vin,
        'registration_no', v.registration_no,
        'model', m.name,
        'model_year', v.model_year
      )),
      'lines', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'line_no', line.line_no,
          'line_type', line.line_type,
          'description', line.description_snapshot,
          'quantity', line.quantity,
          'unit_price', line.unit_price,
          'discount', line.discount_amount,
          'tax_rate', line.tax_rate,
          'tax', line.tax_amount,
          'total', line.line_total
        ) order by line.line_no), '[]'::jsonb)
        from public.invoice_lines line where line.invoice_id = i.id
      )
    )) into v_result
    from public.invoices i
    left join public.repair_orders r on r.id = i.repair_order_id
    left join public.vehicles v on v.id = r.vehicle_id
    left join public.vehicle_models m on m.id = v.model_id
    where i.id = v_invoice.id;

  elsif p_document_type = 'estimate' then
    select * into v_estimate from public.estimate_versions where id = p_document_id;
    if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
    select * into strict v_order from public.repair_orders where id = v_estimate.repair_order_id;

    v_customer_id := v_order.customer_id;
    v_is_customer := exists (
      select 1 from public.customer_accounts account
      where account.organization_id = v_estimate.organization_id
        and account.customer_id = v_order.customer_id
        and account.auth_user_id = auth.uid()
        and account.status = 'active'
    );
    if not app_private.has_permission(v_estimate.organization_id, v_estimate.branch_id, 'estimate.manage')
       and not v_is_customer then
      raise exception 'Not authorized to read this estimate' using errcode = '42501';
    end if;
    if v_is_customer and v_estimate.status = 'draft' then
      raise exception 'Draft documents are not available to customers' using errcode = '42501';
    end if;

    select jsonb_strip_nulls(jsonb_build_object(
      'type', 'estimate',
      'number', r.ro_number || '-EST-V' || e.version_no::text,
      'status', e.status,
      'currency', e.currency,
      'subtotal', e.subtotal,
      'discount', e.discount_total,
      'tax', e.tax_total,
      'total', e.grand_total,
      'hash', e.document_hash,
      'issued_at', coalesce(e.sent_at, e.created_at),
      'expires_at', e.expires_at,
      'seller', jsonb_strip_nulls(jsonb_build_object(
        'organization_name', organization.legal_name,
        'organization_tax_number', organization.tax_number,
        'branch_name', branch.legal_name,
        'branch_tax_registration', branch.tax_registration,
        'country_code', branch.country_code,
        'city', branch.city,
        'address', branch.address_json,
        'phone', branch.phone,
        'email', branch.email
      )),
      'buyer', jsonb_strip_nulls(jsonb_build_object(
        'customer_name', coalesce(customer.legal_name, customer.display_name),
        'customer_tax_number', customer.tax_number,
        'customer_type', customer.customer_type
      )),
      'repair_order', r.ro_number,
      'vehicle', jsonb_strip_nulls(jsonb_build_object(
        'vin', vehicle.vin,
        'registration_no', vehicle.registration_no,
        'model', model.name,
        'model_year', vehicle.model_year
      )),
      'lines', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'line_no', line.line_no,
          'line_type', line.line_type,
          'description', line.description_snapshot,
          'approval_group', line.approval_group,
          'quantity', line.quantity,
          'unit_price', line.unit_price,
          'discount', line.discount_amount,
          'tax_rate', line.tax_rate,
          'tax', line.tax_amount,
          'total', line.line_total
        ) order by line.line_no), '[]'::jsonb)
        from public.estimate_lines line where line.estimate_version_id = e.id
      )
    )) into v_result
    from public.estimate_versions e
    join public.repair_orders r on r.id = e.repair_order_id
    join public.organizations organization on organization.id = e.organization_id
    join public.branches branch on branch.id = e.branch_id
    join public.customers customer on customer.id = r.customer_id
    join public.vehicles vehicle on vehicle.id = r.vehicle_id
    left join public.vehicle_models model on model.id = vehicle.model_id
    where e.id = v_estimate.id;
  else
    raise exception 'Document type is invalid' using errcode = '22023';
  end if;

  return v_result;
end;
$$;

revoke all on function public.service_document(text, uuid) from public, anon, authenticated;
grant execute on function public.service_document(text, uuid) to authenticated;

comment on function public.service_document(text, uuid)
is 'Returns the immutable invoice or estimate projection for authorized staff or the owning active customer account.';
