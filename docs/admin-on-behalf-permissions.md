# Admin permissions and technician attribution

Implemented 2026-09-08. Admin remains scoped to their own organization, across its branches. The existing central permission resolver already grants admin all active module capabilities; module-specific ownership checks were the remaining restrictions.

## Updated workflows

- Inspections: admin can enter results for the assigned active technician without a technician profile of their own. Results retain the technician ID and the actual saving user's ID. The UI shows a bilingual on-behalf notice, and result history marks admin-entered attempts.
- Inspection assignment: admin can change assignment/context after checklist generation while the inspection is in progress. Existing check definitions and results remain immutable snapshots. Audit records retain the previous assignment and technician.
- Workshop jobs: admin can start a timer for the primary assigned technician and stop an existing technician timer, including after that technician is deactivated. Pause/resume controls are also visible. Timer actions record the actual admin actor and technician ID. Ready jobs can now start after resume.
- Job narratives: admins can edit existing cause/correction text rather than only filling empty values.
- Cash registers: admin can close another cashier's open session. Cash calculations and ownership remain attached to that cashier; the closing admin is recorded in audit history.

## Existing permissions retained

Staff, customer and vehicle management, work orders and service/parts selection, inspection catalogs, estimates, purchasing, inventory, billing, records, settings and governance already use central admin capability checks. No user impersonation or global RLS bypass was added. Customer-portal identity checks remain separate.

Finalized financial documents still use the existing reversal/correction workflows. Inspection evidence is corrected through a dated retest with a reason, not overwritten. Qualifications, tenant boundaries, optimistic concurrency and active-timer constraints remain enforced. Retired HV and diagnostics modules remain retired.

## Verification and recovery

- Applied migration: `20260908014438_admin_on_behalf_permissions.sql`.
- `tests/admin-on-behalf.sql` executes public workflows with synthetic organizations/users/records and rolls everything back. Covers admin without a technician profile, unassigned staff denial, cross-tenant denial, suspended admin denial, reassignment history, retest preservation, unforgeable attribution, ready-job start/finish and cashier closure.
- Inspection UI tests cover admin/staff controls and English/Arabic copy.
- Read-only browser check confirmed the on-behalf notice and Record results controls on the user's inspection; no real inspection result was submitted.
- `tests/fixtures/admin-on-behalf-rollback.sql` captures the five prior function definitions for an explicitly authorized rollback. It changes function definitions only, not saved records.
