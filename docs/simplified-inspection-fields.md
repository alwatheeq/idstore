# Simplified inspection results

Removed Measurement, Unit, Manufacturer acceptance criteria, and Evidence/report reference from inspection result forms and history displays, along with the matching admin catalog criteria/unit/measurement-required controls.

The server action and database discard these retired fields from new submissions, including older clients. Existing check snapshots that required measurements no longer block Pass/Fail results. Failure finding/recommendation/urgency, retest reasons, administrator permissions and audit attribution remain enforced.

Existing historical JSON and database records are retained; no records or columns were deleted. The legacy add-inspection-item RPC signature remains compatible but ignores its measurement argument. Unrelated quantities and units in stock, purchasing and pricing are unchanged.

Database migration: `20260908015146_simplify_inspection_result_fields.sql`. Recovery definitions: `tests/fixtures/simplify-inspection-fields-rollback.sql` (apply only for an explicitly requested rollback).

Verification: `tests/simplified-inspection-fields.sql` passed using synthetic, rolled-back records. It tests Pass/Fail without the fields, old requirements, rejected persistence of retired inputs, catalog settings, audit attribution and permission boundaries. Browser inspection confirmed the simplified form. Build, TypeScript, lint, translation coverage and control-label checks passed.
