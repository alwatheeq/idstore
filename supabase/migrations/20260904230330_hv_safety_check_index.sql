create index hv_permit_checks_permit_code_time
  on public.hv_permit_checks(permit_id, check_code, occurred_at desc, id desc);
