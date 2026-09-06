-- Existing hosted projects can retain default Data API grants on newly created
-- public tables. Keep the catalog read-only and route writes through validated RPCs.

revoke all on table public.inspection_check_definitions from anon, authenticated;
grant select on table public.inspection_check_definitions to authenticated;
