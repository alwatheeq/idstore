# Database verification

Run the two SQL checks against a non-production Supabase project after applying every migration:

1. `schema_verification.sql` reports the RLS, grant, trigger and ledger state. Queries documented as “must return zero rows” are release blockers when they return data.
2. `transactional_workflows.sql` exercises authenticated Admin commands, idempotency, append-only consent history, outbox behavior, tenant isolation, campaign verification and QC release. It discovers an active Admin dynamically and rolls back every fixture.

The workflow test intentionally stops when no active Admin membership exists. Never add an Auth UUID, mobile number, PIN or service-role key to this repository to make a test pass.

The browser CI job is credential-free and validates the application’s fail-closed unauthenticated boundary. Authenticated browser journeys belong in a dedicated staging project with disposable accounts and cleanup fixtures; they must not target production.
