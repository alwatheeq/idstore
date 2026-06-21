# Watheeq EV Service Center

Management system for a VW electric-vehicle service center — Arabic/English, RTL-ready. Phase 1 foundation.

## Tech Stack

| Layer | Library / Version |
|---|---|
| Build | Vite + React 19 + TypeScript |
| Routing | react-router-dom v7 |
| Backend | Supabase (Postgres · Auth · Storage) |
| Styling | Tailwind CSS v3 + Radix UI |
| i18n | react-i18next |
| Data fetching | TanStack Query |

## Prerequisites

- Node.js (LTS) + npm

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 3. Configure environment variables

Copy `.env.example` to `.env` at the repo root (`.env` is gitignored):

```bash
cp .env.example .env
```

Fill in your values from Supabase → Project Settings → API:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

> **Note:** the app throws at startup if these variables are missing.

### 4. Apply the database migration

Open `supabase/migrations/0001_phase1_schema.sql` and run its contents in the Supabase SQL editor.

Verify the result:
- 8 tables created (vehicles, customers, service orders, etc.)
- Private `inspection-media` storage bucket exists

### 5. Create the admin user

Supabase → Authentication → Users → **Add user** (email + password).

> There is no public signup — access is admin-only.

### 6. Run the app

```bash
npm run dev
```

Log in with the admin credentials you just created.

Expected behaviour:
- `/` redirects to `/login` when unauthenticated
- After login: shell with five sidebar nav items loads
- Language toggle in the header flips the layout between LTR (English) and RTL (Arabic)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm test` | Run Vitest test suite |
| `npm run lint` | ESLint check |

## Phase Roadmap

| Phase | Scope |
|---|---|
| **1 — Foundation** *(this)* | Auth, shell, navigation, i18n, Supabase schema, base components |
| 2 | Customers & Vehicles management |
| 3 | Service Orders — intake form & vehicle inspection |
| 4 | Invoicing |
| 5 | Dashboard & analytics |
| 6 | Customer portal, WhatsApp notifications, software-update tracking |
| 7 | Accounting & inventory |

See [`docs/superpowers/specs/`](docs/superpowers/specs/) and [`docs/superpowers/plans/`](docs/superpowers/plans/) for detailed specifications and implementation plans.
