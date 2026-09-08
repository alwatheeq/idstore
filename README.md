# IDstore

IDstore is a bilingual, multi-branch Volkswagen ID electric-vehicle service-center platform. The repository contains the working Next.js operations interface, researched product specification, and a Supabase/Postgres backend for customers, vehicles, appointments, maintenance workshop execution, inventory, purchasing, invoicing, payments, integrations and auditing.

## Repository contents

- `docs/ev-service-center-supabase-spec.md` — product and technical specification
- `docs/database-setup.md` — Supabase connection, bootstrap and deployment guidance
- `docs/deployment-runbook.md` — standalone container, verification and rollback procedure
- `app/` and `components/` — responsive English/Arabic operations interface
- `lib/supabase/` — SSR clients, session refresh and typed command adapters
- `supabase/config.toml` — local Supabase configuration
- `supabase/migrations/` — versioned database migrations
- `supabase/functions/` — authenticated server-side account provisioning
- `supabase/seed.sql` — local-only seed entry point
- `supabase/tests/` — post-migration and rollback-only transactional verification
- `tests/e2e/` — desktop/mobile authentication, access-boundary and accessibility browser tests

## Security model

The only internal application roles are `admin` and `staff`. Admin has organization-wide application capabilities. Staff access is limited by assigned branches and explicit capability permissions. Customer portal accounts are separate from internal memberships. Historical high-voltage qualification records are not application roles; the standalone HV workflow is retired.

All exposed application tables have Row Level Security enabled. Commercial ledgers and integration state are server/RPC-only by default. Supabase secret/service-role keys must never be exposed to browser or mobile code.

## Local setup

Install the pinned application dependencies and start Next.js:

```bash
npm install
npm run dev
```

Set the two public Supabase values documented in `.env.example`; the request proxy then enforces authenticated sessions. Without them, the login and health routes remain available while every protected route fails closed.

For a local database, install Docker Desktop and use the Supabase CLI:

```bash
npx supabase start
npx supabase db reset
```

Local Studio is available at the URL printed by `supabase start`. See `docs/database-setup.md` to create the first organization, branches and Admin membership.

## Deploy

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase migration list
npx supabase functions deploy provision-staff
npx supabase functions deploy provision-customer
```

Run Supabase security and performance advisors after every database change. Never commit `.env` files, database passwords, access tokens or secret keys.

The application can be built as a hardened standalone container with `compose.production.yml`. See `docs/deployment-runbook.md` for required build values, health checks, staged rollout and rollback.

### Connected development project

- Project: `IDstore`
- Project reference: `irmtvbeholrcrwgjajjf`
- Region: `eu-central-1`
- API URL: `https://irmtvbeholrcrwgjajjf.supabase.co`

The local `.env.local` contains only the public project URL and publishable key and remains excluded from Git. Database types are generated into `lib/database.types.ts`.

## Current status

The application supports maintenance/bodyshop order intake, assigned inspections, admin-configured services, spare-part pricing, customers/vehicles, branch/staff access, appointments, inventory/purchasing, estimates, billing, records and manual customer follow-ups. Standalone HV-safety and Diagnostics/battery-health pages have been retired while historical records are retained.

The 8 September 2026 audit found and fixed authentication/deep-link failures, invalid scheduling dates, replay-key handling and localization hydration errors, and reduced duplicate branch queries. See [the audit report](docs/application-audit-2026-09-08.md) and [release status](docs/release-status.md) for measured results and limitations. Automated messaging, provider/fiscal integration delivery, large-directory pagination and automated approved-work-to-invoice conversion are not claimed complete. User-approved database hardening was subsequently applied as `20260908144433_audit_access_hardening`, with unchanged non-anonymous grants and passing post-migration database tests.
