-- Grouped approvals, supplementary estimates, governed price overrides and workshop rework evidence.

alter table public.estimate_versions add column if not exists supplement_of_id uuid references public.estimate_versions(id) on delete set null, add column if not exists version_reason text;
alter table public.estimate_approvals add column if not exists approval_group text;
alter table public.estimate_lines add column if not exists catalog_unit_price numeric(18,3), add column if not exists price_override_reason text, add column if not exists price_override_by uuid references auth.users(id) on delete set null, add column if not exists price_override_at timestamptz;
alter table public.jobs add column if not exists cause_text text, add column if not exists correction_text text, add column if not exists original_job_id uuid references public.jobs(id) on delete set null, add column if not exists rework_kind text, add column if not exists rework_reason text;
alter table public.jobs drop constraint if exists jobs_rework_kind_check, add constraint jobs_rework_kind_check check(rework_kind is null or rework_kind in('rework','comeback'));

create table public.job_interruptions(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict, job_id uuid not null references public.jobs(id) on delete cascade,
  interruption_type text not null check(interruption_type in('pause','blocked')), reason text not null,
  started_at timestamptz not null default now(), ended_at timestamptz, started_by uuid not null references auth.users(id) on delete restrict,
  ended_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), check(ended_at is null or ended_at>=started_at)
);
create unique index job_interruptions_one_active on public.job_interruptions(job_id) where ended_at is null;
create index estimate_supplement_source on public.estimate_versions(supplement_of_id) where supplement_of_id is not null;
create index estimate_approval_group_history on public.estimate_approvals(estimate_version_id,approval_group,decided_at desc);
create trigger assert_branch_organization before insert or update of organization_id,branch_id on public.job_interruptions for each row execute function app_private.assert_branch_organization();
alter table public.job_interruptions enable row level security;
create policy job_interruptions_select on public.job_interruptions for select to authenticated using(app_private.has_branch_access(organization_id,branch_id));
grant select on public.job_interruptions to authenticated;

create or replace function public.create_supplementary_estimate(p_estimate_id uuid,p_reason text)
returns public.estimate_versions language plpgsql security definer set search_path='' as $$
declare v_source public.estimate_versions%rowtype; v_new public.estimate_versions%rowtype;
begin
 select * into strict v_source from public.estimate_versions where id=p_estimate_id for update;
 if not app_private.has_permission(v_source.organization_id,v_source.branch_id,'estimate.manage') then raise exception 'Not authorized to create a supplement' using errcode='42501'; end if;
 if v_source.status not in('sent','partially_approved','approved','declined') or nullif(trim(p_reason),'') is null then raise exception 'A sent or decided estimate and reason are required' using errcode='22023'; end if;
 if exists(select 1 from public.estimate_versions e where e.repair_order_id=v_source.repair_order_id and e.status='draft') then raise exception 'A draft estimate already exists' using errcode='23505'; end if;
 insert into public.estimate_versions(organization_id,branch_id,repair_order_id,version_no,status,currency,created_by,supplement_of_id,version_reason)
 select v_source.organization_id,v_source.branch_id,v_source.repair_order_id,coalesce(max(e.version_no),0)+1,'draft',v_source.currency,auth.uid(),v_source.id,trim(p_reason) from public.estimate_versions e where e.repair_order_id=v_source.repair_order_id returning * into v_new;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_source.organization_id,auth.uid(),'estimate.supplement_created','estimate',v_new.id,jsonb_build_object('source_estimate_id',v_source.id,'reason',trim(p_reason)));
 return v_new;
end; $$;

create or replace function public.approve_estimate_price_override(p_estimate_line_id uuid,p_catalog_unit_price numeric,p_override_unit_price numeric,p_reason text)
returns public.estimate_lines language plpgsql security definer set search_path='' as $$
declare v_line public.estimate_lines%rowtype; v_estimate public.estimate_versions%rowtype; v_base numeric; v_tax numeric;
begin
 select * into strict v_line from public.estimate_lines where id=p_estimate_line_id for update; select * into strict v_estimate from public.estimate_versions where id=v_line.estimate_version_id for update;
 if not app_private.is_admin(v_estimate.organization_id) then raise exception 'Only administrators can approve price overrides' using errcode='42501'; end if;
 if v_estimate.status<>'draft' or p_catalog_unit_price is null or p_catalog_unit_price<0 or p_override_unit_price is null or p_override_unit_price<0 or p_override_unit_price=p_catalog_unit_price or nullif(trim(p_reason),'') is null then raise exception 'Price override details are invalid' using errcode='22023'; end if;
 v_base:=round(v_line.quantity*p_override_unit_price,3); if v_line.discount_amount>v_base then raise exception 'Discount exceeds overridden value' using errcode='22023'; end if; v_tax:=round((v_base-v_line.discount_amount)*v_line.tax_rate/100,3);
 update public.estimate_lines set catalog_unit_price=p_catalog_unit_price,unit_price=p_override_unit_price,tax_amount=v_tax,line_total=v_base-v_line.discount_amount+v_tax,price_override_reason=trim(p_reason),price_override_by=auth.uid(),price_override_at=now() where id=v_line.id returning * into v_line;
 perform app_private.recalculate_estimate(v_estimate.id);
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_estimate.organization_id,auth.uid(),'estimate.price_overridden','estimate_line',v_line.id,jsonb_build_object('catalog_unit_price',p_catalog_unit_price,'override_unit_price',p_override_unit_price,'reason',trim(p_reason)));
 return v_line;
end; $$;

create or replace function public.record_estimate_group_decision(p_estimate_id uuid,p_approval_group text,p_decision text,p_actor_name text,p_channel text,p_evidence_note text)
returns public.estimate_versions language plpgsql security definer set search_path='' as $$
declare v_estimate public.estimate_versions%rowtype; v_order public.repair_orders%rowtype; v_group_count integer; v_decided_count integer; v_approved_count integer; v_declined_count integer;
begin
 select * into strict v_estimate from public.estimate_versions where id=p_estimate_id for update;
 if not app_private.has_permission(v_estimate.organization_id,v_estimate.branch_id,'estimate.manage') then raise exception 'Not authorized to record this decision' using errcode='42501'; end if;
 if v_estimate.status not in('sent','partially_approved') or p_decision not in('approved','declined') or nullif(trim(p_approval_group),'') is null or nullif(trim(p_actor_name),'') is null or p_channel not in('phone','whatsapp','email','in_person','portal') or not exists(select 1 from public.estimate_lines l where l.estimate_version_id=v_estimate.id and coalesce(l.approval_group,'General')=trim(p_approval_group)) then raise exception 'Group decision evidence is invalid' using errcode='22023'; end if;
 insert into public.estimate_approvals(organization_id,branch_id,estimate_version_id,decision,actor_name,channel,evidence_json,approval_group)
 values(v_estimate.organization_id,v_estimate.branch_id,v_estimate.id,p_decision,trim(p_actor_name),p_channel,jsonb_strip_nulls(jsonb_build_object('note',nullif(trim(p_evidence_note),''),'recorded_by',auth.uid())),trim(p_approval_group));
 with groups as(select distinct coalesce(approval_group,'General') g from public.estimate_lines where estimate_version_id=v_estimate.id), latest as(select distinct on(approval_group) approval_group,decision from public.estimate_approvals where estimate_version_id=v_estimate.id and approval_group is not null order by approval_group,decided_at desc)
 select count(*),count(l.approval_group),count(*)filter(where l.decision='approved'),count(*)filter(where l.decision='declined') into v_group_count,v_decided_count,v_approved_count,v_declined_count from groups g left join latest l on l.approval_group=g.g;
 update public.estimate_versions set status=case when v_decided_count<v_group_count then 'partially_approved' when v_approved_count=v_group_count then 'approved' when v_declined_count=v_group_count then 'declined' else 'partially_approved' end,updated_at=now() where id=v_estimate.id returning * into v_estimate;
 update public.findings f set status=case when p_decision='approved' then 'approved' else 'declined' end where f.id in(select l.source_id from public.estimate_lines l where l.estimate_version_id=v_estimate.id and coalesce(l.approval_group,'General')=trim(p_approval_group) and l.source_id is not null);
 select * into strict v_order from public.repair_orders where id=v_estimate.repair_order_id for update;
 if v_estimate.status='approved' and v_order.status='awaiting_approval' then update public.repair_orders set status='approved' where id=v_order.id; insert into public.repair_order_events(organization_id,branch_id,repair_order_id,from_status,to_status,reason,actor_id) values(v_order.organization_id,v_order.branch_id,v_order.id,'awaiting_approval','approved','All estimate groups approved',auth.uid()); end if;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_estimate.organization_id,auth.uid(),'estimate.group_decided','estimate',v_estimate.id,jsonb_build_object('approval_group',trim(p_approval_group),'decision',p_decision,'status',v_estimate.status));
 return v_estimate;
end; $$;

create or replace function public.record_job_narrative(p_job_id uuid,p_cause_text text,p_correction_text text)
returns public.jobs language plpgsql security definer set search_path='' as $$ declare v_job public.jobs%rowtype; begin
 select * into strict v_job from public.jobs where id=p_job_id for update; if not app_private.has_permission(v_job.organization_id,v_job.branch_id,'job.perform') then raise exception 'Not authorized to update this job' using errcode='42501'; end if;
 if nullif(trim(p_cause_text),'') is null or nullif(trim(p_correction_text),'') is null then raise exception 'Cause and correction are required' using errcode='22023'; end if;
 update public.jobs set cause_text=trim(p_cause_text),correction_text=trim(p_correction_text),updated_at=now() where id=v_job.id returning * into v_job;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_job.organization_id,auth.uid(),'job.narrative_recorded','job',v_job.id,jsonb_build_object('repair_order_id',v_job.repair_order_id)); return v_job; end; $$;

create or replace function public.interrupt_job(p_job_id uuid,p_expected_version bigint,p_interruption_type text,p_reason text)
returns public.jobs language plpgsql security definer set search_path='' as $$ declare v_job public.jobs%rowtype; begin
 select * into strict v_job from public.jobs where id=p_job_id for update; if not app_private.has_permission(v_job.organization_id,v_job.branch_id,'job.perform') then raise exception 'Not authorized to interrupt this job' using errcode='42501'; end if;
 if v_job.version<>p_expected_version or v_job.status<>'in_progress' or p_interruption_type not in('pause','blocked') or nullif(trim(p_reason),'') is null then raise exception 'Job interruption is invalid' using errcode='40001'; end if;
 update public.labor_entries set ended_at=now(),pause_reason=trim(p_reason) where job_id=v_job.id and ended_at is null;
 insert into public.job_interruptions(organization_id,branch_id,job_id,interruption_type,reason,started_by) values(v_job.organization_id,v_job.branch_id,v_job.id,p_interruption_type,trim(p_reason),auth.uid());
 update public.jobs set status=case when p_interruption_type='pause' then 'paused' else 'blocked' end,updated_at=now() where id=v_job.id returning * into v_job; return v_job; end; $$;

create or replace function public.resume_job(p_job_id uuid,p_expected_version bigint)
returns public.jobs language plpgsql security definer set search_path='' as $$ declare v_job public.jobs%rowtype; begin
 select * into strict v_job from public.jobs where id=p_job_id for update; if not app_private.has_permission(v_job.organization_id,v_job.branch_id,'job.perform') then raise exception 'Not authorized to resume this job' using errcode='42501'; end if;
 if v_job.version<>p_expected_version or v_job.status not in('paused','blocked') then raise exception 'Job is not available to resume' using errcode='40001'; end if;
 update public.job_interruptions set ended_at=now(),ended_by=auth.uid() where job_id=v_job.id and ended_at is null;
 update public.jobs set status='ready',updated_at=now() where id=v_job.id returning * into v_job; return v_job; end; $$;

create or replace function public.create_rework_job(p_original_job_id uuid,p_rework_kind text,p_reason text)
returns public.jobs language plpgsql security definer set search_path='' as $$ declare v_source public.jobs%rowtype; v_job public.jobs%rowtype; begin
 select * into strict v_source from public.jobs where id=p_original_job_id; if not app_private.has_permission(v_source.organization_id,v_source.branch_id,'workshop.dispatch') then raise exception 'Not authorized to create rework' using errcode='42501'; end if;
 if v_source.status<>'completed' or p_rework_kind not in('rework','comeback') or nullif(trim(p_reason),'') is null then raise exception 'Completed source job, rework type and reason are required' using errcode='22023'; end if;
 insert into public.jobs(organization_id,branch_id,repair_order_id,operation_code,description_snapshot,status,safety_class,required_qualification_code,planned_minutes,original_job_id,rework_kind,rework_reason)
 values(v_source.organization_id,v_source.branch_id,v_source.repair_order_id,v_source.operation_code,v_source.description_snapshot||' · '||p_rework_kind,'ready',v_source.safety_class,v_source.required_qualification_code,v_source.planned_minutes,v_source.id,p_rework_kind,trim(p_reason)) returning * into v_job;
 insert into audit.events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_job.organization_id,auth.uid(),'job.rework_created','job',v_job.id,jsonb_build_object('original_job_id',v_source.id,'kind',p_rework_kind,'reason',trim(p_reason))); return v_job; end; $$;

do $$ declare r regprocedure; begin foreach r in array array['public.create_supplementary_estimate(uuid,text)'::regprocedure,'public.approve_estimate_price_override(uuid,numeric,numeric,text)'::regprocedure,'public.record_estimate_group_decision(uuid,text,text,text,text,text)'::regprocedure,'public.record_job_narrative(uuid,text,text)'::regprocedure,'public.interrupt_job(uuid,bigint,text,text)'::regprocedure,'public.resume_job(uuid,bigint)'::regprocedure,'public.create_rework_job(uuid,text,text)'::regprocedure] loop execute format('revoke all on function %s from public,anon,authenticated',r); execute format('grant execute on function %s to authenticated',r); end loop; end $$;
