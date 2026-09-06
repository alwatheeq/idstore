-- Keep the currently deployed legacy form usable until the frontend is released.
-- An assigned or generated inspection can only finish through supervisor review.
create or replace function public.complete_inspection(p_inspection_id uuid)
returns public.inspections language plpgsql security definer set search_path='' as $$
declare v_i public.inspections%rowtype;
begin
 select * into v_i from public.inspections where id=p_inspection_id for update;
 if not found then raise exception 'Inspection unavailable'; end if;
 if auth.uid() is null or not app_private.has_permission(v_i.organization_id,v_i.branch_id,'inspection.perform') then raise exception 'Not authorized' using errcode='42501'; end if;
 if v_i.checklist_generated_at is not null or v_i.assignment <> '{}'::jsonb then raise exception 'Review recommendations and complete the generated checklist'; end if;
 if v_i.status <> 'in_progress' then raise exception 'Inspection is locked'; end if;
 if not exists(select 1 from public.inspection_items where inspection_id=v_i.id) then raise exception 'Add at least one completed check before finishing the inspection'; end if;
 update public.inspections set status='completed',completed_at=now() where id=v_i.id returning * into v_i;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(v_i.organization_id,auth.uid(),'inspection.legacy_completed','inspection',v_i.id,jsonb_build_object('workflow','legacy_unassigned'));
 return v_i;
end;
$$;
revoke all on function public.complete_inspection(uuid) from public,anon,authenticated;
grant execute on function public.complete_inspection(uuid) to authenticated;
