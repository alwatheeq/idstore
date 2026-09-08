-- Administrative directory maintenance; operational and financial ledgers are not editable here.
create or replace function app_private.manage_directory_record(
  p_organization_id uuid, p_kind text, p_id uuid, p_mode text,
  p_updated_at timestamptz, p_changes jsonb, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_table text;
  v_fields text[];
  v_required text[];
  v_record jsonb;
  v_key text;
  v_set text;
  v_archived boolean;
begin
  if auth.uid() is null or not app_private.is_admin(p_organization_id) then
    raise exception 'Only administrators can manage directory records' using errcode='42501';
  end if;
  if p_mode is null or p_mode not in ('edit','archive','restore') then
    raise exception 'Choose a valid record action.' using errcode='22023';
  end if;
  -- Identifiers and editable columns are constants, never caller-supplied SQL.
  case p_kind
    when 'customer' then v_table:='customers'; v_fields:=array['display_name','customer_type','legal_name','tax_number','notes']; v_required:=array['display_name','customer_type'];
    when 'vehicle' then v_table:='vehicles'; v_fields:=array[]::text[]; v_required:=array[]::text[];
    when 'part' then v_table:='parts'; v_fields:=array['description_en','description_ar','sale_price']; v_required:=array['description_en','sale_price'];
    when 'supplier' then v_table:='suppliers'; v_fields:=array['name','tax_number','phone','email']; v_required:=array['name'];
    when 'branch' then v_table:='branches'; v_fields:=array['display_name','legal_name','city']; v_required:=v_fields;
    when 'resource' then v_table:='resources'; v_fields:=array['name']; v_required:=v_fields;
    when 'check' then v_table:='inspection_check_definitions'; v_fields:=array['label_en','label_ar']; v_required:=v_fields;
    else raise exception 'Unsupported record type.' using errcode='22023';
  end case;
  -- Serialize administrative archives, including the last active branch guard.
  perform 1 from public.organizations where id=p_organization_id for update;
  execute format('select to_jsonb(r) from public.%I r where id=$1 and organization_id=$2 for update',v_table)
    into v_record using p_id,p_organization_id;
  if v_record is null then raise exception 'Record not found' using errcode='P0002'; end if;
  if p_updated_at is null or (v_record->>'updated_at')::timestamptz <> p_updated_at then
    raise exception 'This record changed. Refresh the page and try again.' using errcode='40001';
  end if;
  v_archived:=coalesce(v_record->>'status'='archived',false)
    or (p_kind='resource' and v_record->>'status'='inactive')
    or (p_kind='check' and v_record->>'active'='false');
  if p_mode='edit' then
    if v_archived or v_record->>'status'='anonymized' or cardinality(v_fields)=0 then
      raise exception 'This record cannot be edited here.' using errcode='22023';
    end if;
    if p_changes is null or jsonb_typeof(p_changes)<>'object' then
      raise exception 'Invalid record fields.' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_object_keys(p_changes) k where not k=any(v_fields))
      or not p_changes ?& v_fields then
      raise exception 'Invalid record fields.' using errcode='22023';
    end if;
    foreach v_key in array v_required loop
      if nullif(btrim(p_changes->>v_key),'') is null then
        raise exception 'Check the required fields and text length.' using errcode='22023';
      end if;
    end loop;
    foreach v_key in array v_fields loop
      if jsonb_typeof(p_changes->v_key) not in ('string','number','null')
        or length(p_changes->>v_key)>(case when v_key='notes' then 2000 else 240 end) then
        raise exception 'Check the required fields and text length.' using errcode='22023';
      end if;
    end loop;
    if p_kind='part' and (jsonb_typeof(p_changes->'sale_price')<>'number'
      or (p_changes->>'sale_price')::numeric not between 0 and 999999999) then
      raise exception 'Enter a non-negative price.' using errcode='22023';
    end if;
    select string_agg(format('%1$I=(jsonb_populate_record(null::public.%2$I,$1)).%1$I',k,v_table),',') into v_set from unnest(v_fields) k;
    execute format('update public.%I set %s,updated_at=clock_timestamp() where id=$2 and organization_id=$3',v_table,v_set)
      using p_changes,p_id,p_organization_id;
  else
    if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
      raise exception 'Enter a reason between 3 and 500 characters.' using errcode='22023';
    end if;
    if p_mode='archive' then
      if v_archived then raise exception 'This record is already archived.' using errcode='22023'; end if;
      if p_kind in ('customer','vehicle') then
        if v_record->>'status'<>'active' then
          raise exception 'Resolve the record restrictions before archiving.' using errcode='22023';
        end if;
        if exists(select 1 from public.repair_orders where organization_id=p_organization_id
          and case when p_kind='customer' then customer_id=p_id else vehicle_id=p_id end
          and status not in ('delivered','closed','cancelled'))
          or exists(select 1 from public.appointments where organization_id=p_organization_id
          and case when p_kind='customer' then customer_id=p_id else vehicle_id=p_id end
          and status in ('requested','confirmed','checked_in')) then
          raise exception 'Complete or cancel linked open orders and appointments first.' using errcode='22023';
        end if;
      elsif p_kind='supplier' and exists(select 1 from public.purchase_orders where supplier_id=p_id and organization_id=p_organization_id and status not in ('closed','cancelled')) then
        raise exception 'Close or cancel linked purchase orders first.' using errcode='22023';
      elsif p_kind='part' then
        if exists(select 1 from public.stock_balances where part_id=p_id and organization_id=p_organization_id and (on_hand<>0 or reserved<>0)) then
          raise exception 'Resolve remaining stock and reservations before archiving this part.' using errcode='22023';
        end if;
        if exists(select 1 from public.purchase_order_lines l join public.purchase_orders o on o.id=l.purchase_order_id where l.part_id=p_id and o.organization_id=p_organization_id and o.status not in ('closed','cancelled')) then
          raise exception 'Close or cancel linked purchase orders first.' using errcode='22023';
        end if;
      elsif p_kind='resource' and exists(select 1 from public.resource_bookings where resource_id=p_id and organization_id=p_organization_id and status='active' and ends_at>now()) then
        raise exception 'Cancel active resource bookings before archiving.' using errcode='22023';
      elsif p_kind='branch' then
        if (select count(*) from public.branches where organization_id=p_organization_id and status='active' and id<>p_id)=0 then
          raise exception 'Keep at least one active branch.' using errcode='22023';
        end if;
        if exists(select 1 from public.repair_orders where branch_id=p_id and status not in ('delivered','closed','cancelled'))
          or exists(select 1 from public.appointments where branch_id=p_id and status in ('requested','confirmed','checked_in'))
          or exists(select 1 from public.stock_balances where branch_id=p_id and (on_hand<>0 or reserved<>0))
          or exists(select 1 from public.purchase_orders where branch_id=p_id and status not in ('closed','cancelled'))
          or exists(select 1 from public.cash_sessions where branch_id=p_id and status='open') then
          raise exception 'Resolve open branch activity and stock before archiving.' using errcode='22023';
        end if;
      end if;
    elsif not v_archived then
      raise exception 'Only archived records can be restored.' using errcode='22023';
    end if;
    if p_kind='check' then
      update public.inspection_check_definitions set active=(p_mode='restore'),updated_at=clock_timestamp() where id=p_id and organization_id=p_organization_id;
    else
      execute format('update public.%I set status=$1,updated_at=clock_timestamp() where id=$2 and organization_id=$3',v_table)
        using case when p_mode='restore' then 'active' when p_kind='resource' then 'inactive' else 'archived' end,p_id,p_organization_id;
    end if;
    if p_kind='customer' and p_mode='archive' then
      update public.customer_accounts set status='revoked' where customer_id=p_id and organization_id=p_organization_id;
    end if;
  end if;
  insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata)
    values(p_organization_id,auth.uid(),'directory.'||p_mode,p_kind,p_id,
      jsonb_build_object('reason',nullif(btrim(p_reason),''),'changed_fields',case when p_mode='edit' then p_changes else '{}'::jsonb end,'previous_status',v_record->>'status'));
end;
$$;
revoke all on function app_private.manage_directory_record(uuid,text,uuid,text,timestamptz,jsonb,text) from public,anon;
grant execute on function app_private.manage_directory_record(uuid,text,uuid,text,timestamptz,jsonb,text) to authenticated;

create or replace function public.manage_directory_record(
  p_organization_id uuid,p_kind text,p_id uuid,p_mode text,p_updated_at timestamptz,p_changes jsonb,p_reason text
) returns void language sql security invoker set search_path='' as $$
  select app_private.manage_directory_record(p_organization_id,p_kind,p_id,p_mode,p_updated_at,p_changes,p_reason);
$$;
revoke all on function public.manage_directory_record(uuid,text,uuid,text,timestamptz,jsonb,text) from public,anon;
grant execute on function public.manage_directory_record(uuid,text,uuid,text,timestamptz,jsonb,text) to authenticated;
