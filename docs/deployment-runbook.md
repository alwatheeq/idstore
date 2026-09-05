# IDstore deployment runbook

## Release artifact

IDstore is built as one immutable Next.js standalone container image. Build once per environment because `NEXT_PUBLIC_*` values are embedded into browser assets during `next build`. Deploy the same tagged image to every replica in that environment.

Required build and runtime values:

- `NEXT_PUBLIC_SUPABASE_URL`: the environment's Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: an active publishable key, never a secret/service-role key.
- `DEPLOYMENT_VERSION`: an immutable release identifier, normally the full Git commit SHA.

Do not store actual values in Compose files, GitHub workflow files or source control. The build necessarily embeds the two public Supabase values in browser assets, so they must never be replaced with a secret/service-role key. Supply them through the deployment system so environments cannot be mixed accidentally.

## Prepare

1. Confirm CI passes type-check, lint, production build and Playwright.
2. Apply and verify all Supabase migrations in staging before production.
3. Run `supabase/tests/schema_verification.sql` and `supabase/tests/transactional_workflows.sql` in staging.
4. Confirm the production Supabase backup/PITR state and record the last known-good application image tag.
5. Confirm the reverse proxy provides TLS, request-size limits, rate limiting and slow-client protection.
6. Confirm monitoring consumes `/api/health`, application logs, Supabase logs and provider outbox failures.

## Build

With the required variables supplied by an approved secret/configuration store:

```bash
docker compose -f compose.production.yml build
```

The multi-stage image installs locked dependencies, produces only the standalone runtime, runs as UID/GID 1001, drops Linux capabilities, uses a read-only root filesystem under Compose and exposes only port 3000 to the loopback reverse proxy.

## Deploy and verify

1. Start the new tagged image in staging and confirm `/api/health` returns HTTP 200.
2. Confirm `/api/readiness` returns HTTP 200 and reports only `supabaseConfiguration: true`; it never returns a key or URL.
3. Run unauthenticated boundary tests, then sign in with a disposable staging Admin and verify dashboard, customer, vehicle, work-order, inventory and invoice reads.
4. Deploy with a rolling or blue-green strategy. Allow 10–30 seconds for graceful termination of the old instance.
5. Watch health, error rate, latency, database connections and integration outbox state continuously for the first 15 minutes, then recheck at one hour.

The health endpoint is liveness-only and deliberately does not restart healthy application instances during a transient Supabase incident. Readiness validates configuration without leaking it; dependency availability is monitored separately.

## Rollback

Rollback immediately for unavailable service, authorization leakage, migration incompatibility, material invoice/inventory corruption, or a sustained error/latency regression.

1. Route traffic back to the recorded previous image tag.
2. Do not reverse a database migration until its documented down-migration/data-recovery impact has been reviewed. Prefer a forward repair for additive migrations.
3. Confirm `/api/health`, login, staff scope and customer portal scope on the restored image.
4. Preserve failed image logs and deployment metadata for the incident review.

## Scale-out notes

- Replicas must run the identical image/build output.
- Configure `DEPLOYMENT_VERSION` for Next.js version-skew protection.
- If multiple builds are produced for one release, configure one shared `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time.
- Introduce a shared cache/tag coordinator before relying on revalidation across multiple independently cached replicas.
