-- Simple workshop services reuse the versioned catalog and its booking checks.
-- Price is a catalog customer charge in JOD, not an invoice or internal cost.
create or replace function public.create_simple_service(
  p_organization_id uuid, p_name text, p_name_ar text,
  p_customer_price numeric, p_estimated_minutes integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version public.service_template_versions%rowtype;
  v_code text := 'SVC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  if auth.uid() is null or not app_private.is_admin(p_organization_id) then
    raise exception 'Only administrators can define services' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 160
     or length(coalesce(p_name_ar, '')) > 160
     or p_customer_price is null or p_customer_price < 0 or p_customer_price > 999999.999
     or p_customer_price <> round(p_customer_price, 3)
     or p_estimated_minutes is null or p_estimated_minutes < 1 or p_estimated_minutes > 1440 then
    raise exception 'Enter a service name, a price from 0 to 999999.999 JOD and 1 to 1440 whole minutes' using errcode = '22023';
  end if;
  select * into v_version from public.create_service_template(
    p_organization_id, v_code, trim(p_name), coalesce(trim(p_name_ar), ''), '',
    (current_timestamp at time zone 'Asia/Amman')::date, null, null,
    'workshop:admin-defined-service',
    jsonb_build_object('model_codes', jsonb_build_array(), 'entry_mode', 'simple',
      'service_pricing', jsonb_build_object('currency', 'JOD', 'customer_price', p_customer_price))
  );
  perform public.add_service_template_task(
    v_version.id, v_code, trim(p_name), coalesce(trim(p_name_ar), ''),
    p_estimated_minutes, '', '', '',
    jsonb_build_object('capture', 'confirmation', 'safety_class', 'normal')
  );
  perform public.publish_service_template_version(v_version.id);
  return v_version.id;
end;
$$;
revoke all on function public.create_simple_service(uuid, text, text, numeric, integer) from public, anon, authenticated;
grant execute on function public.create_simple_service(uuid, text, text, numeric, integer) to authenticated;
comment on function public.create_simple_service(uuid, text, text, numeric, integer)
  is 'Admin-only atomic creation of a bookable workshop service, customer price in JOD and estimated minutes. Existing RLS and command authorization are preserved.';
