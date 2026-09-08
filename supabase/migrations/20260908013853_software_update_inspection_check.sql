-- Add a selectable, recommended software check to the shared maintenance catalog.
-- This checks version/update availability only; it does not authorize installation.
-- Existing task snapshots and recorded results are deliberately untouched.
insert into public.inspection_check_definitions (
  organization_id, vehicle_model_id, code, category, label_en, label_ar,
  is_required, active, sort_order, rules
) values (
  null, null, 'EV_SOFTWARE_UPDATE', 'electronics',
  'Software version & update availability',
  'فحص إصدار البرمجيات والتحديثات المتاحة',
  false, true, 25,
  '{"groups":["general"],"baseline":true,"capability":"","qualification":"","procedure_ref":"","unit":"","criteria":"","evidence_required":false}'::jsonb
)
on conflict (organization_id, vehicle_model_id, code) do nothing;

-- Safe rollback, if needed: deactivate only the shared EV_SOFTWARE_UPDATE
-- definition (organization_id and vehicle_model_id both null). Do not delete
-- definitions or historical inspection tasks/results.
