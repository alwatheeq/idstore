# Maintenance-only operating scope

The dedicated HV operating module is retired. Maintenance, inspections, diagnostic
records, battery-health observations, parts, billing and customer workflows remain.

- Removed the HV route and server actions, menu item, sidebar notice, branch and
  resource options, permission assignment and qualification-management UI.
- New jobs and service tasks default to normal maintenance. HV job types are no
  longer selectable. New specialist inspection definitions/checklists are blocked.
- Existing specialist definitions and historical evidence are retained in the
  database, but excluded from the active inspection catalog. Historical tasks
  remain visible for reference and documented admin review, not execution.
- General fault alerts, safety stops, stock quarantine, permissions and
  historical job protections are unchanged. Nothing is automatically marked safe.

## Database rollout

Applied migration: 20260906232949_retire_hv_module.sql.
No rows were deleted or rewritten. Six HV/qualification RPCs are no longer callable
by authenticated clients. Eleven write guards prevent recreating retired features,
including through old clients or indirect catalog instantiation.

The inspection workspace and candidate functions retain authorization and model
applicability checks while filtering specialist definitions.

Preflight found no HV permits, historical HV jobs, specialist service-template
tasks or generated specialist checklist tasks.

Verified routine job creation and rejection of an attempted HV reclassification
inside a transaction that was rolled back. Confirmed routine job/inspection RPCs
remain callable and retired RPCs do not.

The application changes are local until pushed/deployed. The shared Supabase
database already enforces the new scope.

## Rollback

Restore the application version with the HV module, then run
supabase/rollbacks/20260906232949_retire_hv_module.sql through the normal migration
process. It removes only the added guards, restores the prior inspection queries
and restores authenticated execute grants. Historical tables/data need no restore.
