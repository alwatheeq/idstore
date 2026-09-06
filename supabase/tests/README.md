# Database verification

Run the two SQL checks against a non-production Supabase project after applying every migration:

1. `schema_verification.sql` reports the RLS, grant, trigger and ledger state. Queries documented as “must return zero rows” are release blockers when they return data.
2. `transactional_workflows.sql` exercises authenticated Admin commands, idempotency, append-only consent history, outbox behavior, tenant isolation, campaign verification and QC release. It discovers an active Admin dynamically and rolls back every fixture.

The workflow test intentionally stops when no active Admin membership exists. Never add an Auth UUID, mobile number, PIN or service-role key to this repository to make a test pass.

The browser CI job is credential-free and validates the application’s fail-closed unauthenticated boundary. Authenticated browser journeys belong in a dedicated staging project with disposable accounts and cleanup fixtures; they must not target production.

## Isolated inspection workflow regression

`scripts/test-inspection-db.mjs` runs the actual inspection migrations and RPCs in an in-memory PGlite PostgreSQL instance. It does not connect to Supabase or use real customer records. Install `@electric-sql/pglite` in a temporary directory and pass the absolute path of its `dist/index.js` to the script:

```sh
node scripts/test-inspection-db.mjs /absolute/temp/node_modules/@electric-sql/pglite/dist/index.js
```

The harness substitutes minimal Auth/Storage schemas and `text` for unrelated `citext` fields. It tests pending generation, deduplication, result validation, technician permissions, RLS, safety escalation, exceptions, review reopening, immutable retests, model/year schedule rules and qualification expiry. This complements, rather than replaces, staging integration tests.

`tests/e2e/inspection-workflow.spec.tsx` renders the real React components using synthetic data for English/Arabic desktop/mobile layout checks. It also tests recommendation selection and progress logic without authenticating to production.

The three inspection RPCs intentionally use `SECURITY DEFINER` with an empty search path and explicit organization/branch/role checks. Supabase's [authenticated-definer advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) flags this intentional API boundary; direct task/result writes and anonymous RPC access remain denied.

## Independent-workshop vehicle profile

The same isolated harness tests `update_vehicle_service_profile`: technical edits persist, historical warranty values (including nulls) are preserved, validation rejects invalid input, audit events are recorded, and anonymous, unauthorized, cross-organization and unassigned-branch access is rejected. No live vehicle data is used.

The additive migration retains the legacy `update_vehicle_profile` API for older deployments. Rollback requires reverting the app caller before dropping only `update_vehicle_service_profile(uuid, uuid, text, text, text, date, text)`; no warranty columns or historical values are removed.

`tests/e2e/workshop-terminology.spec.ts` checks the effective Arabic translations and prevents factory-warranty inputs from returning to the vehicle UI/save action. The human-reviewed dictionary `lib/i18n/workshop-ar.json` overrides generated copy; the coverage audit includes both dictionaries.
