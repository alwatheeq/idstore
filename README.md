# IDstore

IDstore is a bilingual, multi-branch Volkswagen ID electric-vehicle service-center platform. The repository contains the working Next.js operations interface, researched product specification, and a Supabase/Postgres backend for customers, vehicles, appointments, workshop execution, high-voltage safety, inventory, purchasing, invoicing, payments, integrations and auditing.

## Repository contents

- `docs/ev-service-center-supabase-spec.md` — product and technical specification
- `docs/database-setup.md` — Supabase connection, bootstrap and deployment guidance
- `app/` and `components/` — responsive English/Arabic operations interface
- `lib/supabase/` — SSR clients, session refresh and typed command adapters
- `supabase/config.toml` — local Supabase configuration
- `supabase/migrations/` — versioned database migrations
- `supabase/seed.sql` — local-only seed entry point
- `supabase/tests/schema_verification.sql` — post-migration verification queries

## Security model

The only internal application roles are `admin` and `staff`. Admin has organization-wide application capabilities. Staff access is limited by assigned branches and explicit capability permissions. Customer portal accounts are separate from internal memberships. High-voltage qualifications and permits are safety controls, not roles.

All exposed application tables have Row Level Security enabled. Commercial ledgers and integration state are server/RPC-only by default. Supabase secret/service-role keys must never be exposed to browser or mobile code.

## Local setup

Install the pinned application dependencies and start Next.js:

```bash
npm install
npm run dev
```

Without Supabase environment variables, the interface runs as a local operational prototype. Once a project is connected, set the two public values documented in `.env.example`; the request proxy then enforces authenticated sessions.

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
```

Run Supabase security and performance advisors after every database change. Never commit `.env` files, database passwords, access tokens or secret keys.

## Current status

The web application and versioned database migrations are implemented and pass production build, type and lint checks. Live Supabase project creation, migration application, generated database types and GitHub synchronization require the selected Supabase organization/cost confirmation and valid GitHub authentication.
