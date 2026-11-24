# Audit fixes — 23 September 2026

The code and database changes address F01–F14 and F16 from the original audit. F15 remains an external integration implementation dependency; it is not represented as completed.

## Implemented

| Findings | Result |
|---|---|
| F01–F03 | Refund authorization runs before replay; the invoice and credit are locked before spend checks; mismatched retry payloads are rejected. Collection, dashboard, invoices, portal and reports use net debt after credits and recorded refunds. |
| F04 | Administrators can release an inspection hold only after all blocking findings have passing, reviewed retests. Historical findings remain traceable. Orders with HV permits require specialist handling. |
| F05–F06 | Whole-order QC is tied to a release revision, invalidated when work resumes or jobs change, and rechecked at ready/delivery. Failed checks cannot reuse older passes. Job QC has explicit pass/complete and fail/rework decisions. Already delivered legacy orders can still close. |
| F07 | Local/container Server Actions accept 52 MB requests for a 50 MiB file plus multipart overhead. Deployment ingress/body limits must also support that size. No real evidence file was uploaded during verification. |
| F08 | Waitlist booking pre-fills and locks request identity, validates the requested window/duration, books catalog services and links/closes the request atomically. Exact retries return the same booking; different retry details are rejected. |
| F09 | Work-order stock supports branch-scoped reservation, issue, release and unused return, with version checks, stock ledger entries, idempotent issue/return, quantity limits and quarantine/serialized-stock guards. Pricing alone does not move stock. |
| F10 | Catalog IDs survive pricing; approved estimate lines can populate jobs or a draft invoice without duplicate source lines. Partial approvals copy only approved groups. Existing invoice ledgers stay visible. Specialist-qualified services require explicit specialist dispatch. |
| F11–F13 | Operational lists load all API pages with stable ordering and propagate failed pages. Selected orders are scoped before retrieval. Reports aggregate in the database, exclude draft debt, and use weighted network measures. |
| F14 | QC navigation and controls match the permissions enforced by the corresponding commands. |
| F16 | Finance actions reject empty, non-finite, negative or over-precision amounts before calling the database. Refund and payment commands independently reject non-finite amounts. |

## External delivery still required (F15)

Customer notification delivery now has an admin-managed outgoing webhook at **Settings → Customer notifications**, following the user's direction. It forwards only customer message events, with signing, test requests, bounded retries and delivery status. See [the receiver contract](customer-notification-webhook.md). It remains disabled until the admin configures the endpoint and shared secret. No external endpoint was contacted during implementation.

Payment and fiscal delivery remain separate implementation dependencies. Their provider adapters, credentials, signed callback verification and end-to-end validation are not supplied by the notification webhook. New portal payment-link requests remain blocked until a functioning payment adapter is implemented.

## Deployment and verification

Applied five migrations to the connected IDstore Supabase project, with matching local migration filenames:

- `20260922221241_financial_workflow_fixes`
- `20260922221246_workshop_release_fixes`
- `20260922221250_workflow_handoffs`
- `20260922221254_order_stock`
- `20260922221257_report_balances`

Generated types were refreshed from the connected schema; existing SQL nullable-argument contracts were preserved because the generator omits them.

Validation: production build, TypeScript and ESLint passed. Arabic coverage: 1,652 strings. Control-label audit: 369 controls / 351 actions across 73 TSX files. Desktop/mobile suite: 309 passed, 1 existing skip. Four rollback-only SQL regression files passed, covering money, handoffs, stock, permissions and inspection release. A two-connection local test attempted simultaneous refunds against different payments sharing one credit: exactly one succeeded and the total stayed within the credit limit.

The SQL tests used a disposable PostgreSQL database with minimal Supabase auth/storage shims. Baseline replay needed the existing duplicate catalog index skipped and the expected `postgres` role created. No synthetic test data was inserted in the connected business database.

Signed-in browser smoke checks loaded appointments, dashboard, reports, work orders, quality and invoices; an existing order displayed its invoice ledger and stock controls. These checks were read-only. Provider delivery, real evidence uploads and production hosting request limits were not end-to-end tested.
