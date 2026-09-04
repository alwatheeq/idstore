create or replace function public.finish_job(
  p_job_id uuid,
  p_expected_version bigint,
  p_outcome text,
  p_note text
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_technician public.technician_profiles%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not app_private.has_permission(v_job.organization_id, v_job.branch_id, 'job.perform') then
    raise exception 'Not authorized to perform this job' using errcode = '42501';
  end if;
  if v_job.version <> p_expected_version then
    raise exception 'Job changed; refresh before stopping' using errcode = '40001';
  end if;
  if v_job.status <> 'in_progress' or p_outcome not in ('paused', 'blocked', 'qc', 'completed') then
    raise exception 'Job state or outcome is invalid' using errcode = '22023';
  end if;

  select * into v_technician
  from public.technician_profiles
  where organization_id = v_job.organization_id and user_id = auth.uid() and active;
  if not found or not exists (
    select 1 from public.job_assignments a
    where a.job_id = v_job.id and a.technician_id = v_technician.id and a.unassigned_at is null
  ) then
    raise exception 'This job is not assigned to the current technician' using errcode = '42501';
  end if;

  update public.labor_entries
  set ended_at = greatest(clock_timestamp(), started_at + interval '1 millisecond'),
      pause_reason = case when p_outcome in ('paused', 'blocked') then nullif(trim(p_note), '') else null end
  where job_id = v_job.id and technician_id = v_technician.id and ended_at is null;
  if not found then raise exception 'No active timer exists for this job' using errcode = '23514'; end if;

  if p_outcome = 'completed' and v_job.safety_class in ('hv_isolated', 'hv_battery_open') and exists (
    select 1 from public.hv_work_permits p where p.job_id = v_job.id and p.state not in ('closed', 'revoked')
  ) then
    raise exception 'Close the high-voltage permit before completing the job' using errcode = '23514';
  end if;

  update public.jobs
  set status = p_outcome,
      completed_at = case when p_outcome = 'completed' then clock_timestamp() else null end
  where id = v_job.id returning * into v_job;

  insert into audit.events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_job.organization_id, auth.uid(), 'job.timer_stopped', 'job', v_job.id,
    jsonb_build_object('outcome', p_outcome, 'note', nullif(trim(p_note), ''))
  );
  return v_job;
end;
$$;

revoke all on function public.finish_job(uuid, bigint, text, text) from public, anon;
grant execute on function public.finish_job(uuid, bigint, text, text) to authenticated;
