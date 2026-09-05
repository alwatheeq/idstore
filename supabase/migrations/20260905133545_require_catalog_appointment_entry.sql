-- Remove legacy client entry points that can bypass catalog service validation.

revoke all on function public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, text)
  from authenticated;
