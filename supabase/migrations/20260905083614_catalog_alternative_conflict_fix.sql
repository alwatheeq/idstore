-- Correct the catalog alternative upsert conflict target.

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
