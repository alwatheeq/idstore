# IDstore release status

## Implemented and verified

The connected development project has 26 synchronized migrations and JWT-protected staff/customer provisioning functions. Every in-scope local module has a live Supabase-backed screen and permission-checked database command: organization/branches, Admin/Staff access, CRM contacts/consents, vehicles, portal, appointments/resources, templates, reception, inspections, estimates, workshop execution, HV safety, diagnostics/evidence, inventory/purchasing/transfers/counts, deferred work, billing/payments/credits/refunds/cash, QC/campaigns, communications, global search, reports and redacted integration/audit governance.

Verification completed on 5 September 2026:

- TypeScript, ESLint and the optimized Next.js build pass.
- Playwright passes 9 desktop/mobile Chromium tests with one intentional desktop skip for the mobile-only overflow assertion.
- Axe reports no serious or critical WCAG A/AA violations on mobile/PIN login.
- Live rolled-back database transactions cover service-template immutability, resource conflicts, stock transfer/short receipt, blind counts, deferred work, evidence/message idempotency, tenant rejection, credit/refund limits, cash reconciliation, QC release, campaign verification and portal data/decision scope.
- Supabase performance advisor has no warning-level database finding after removal of the duplicate resource index. Informational unused-index results are expected on an empty development dataset; foreign-key index candidates should be selected from measured production query plans, not added indiscriminately.
- Supabase's security-definer advisor flags the intentional authenticated command RPC boundary. Every callable command uses a fixed empty search path, revoked `PUBLIC`/`anon` execution and an in-function identity/permission check. Leaked-password protection remains a project Auth setting to enable before production.

## External go-live gates

These are deliberately not marked complete because they require contracts, credentials, certification or business sign-off:

1. JoFotara sandbox/production credentials, current UBL 2.1 package and accountant-approved tax/rounding examples.
2. A contracted SMS/WhatsApp/email provider and approved templates; the application currently writes a durable idempotent outbox event.
3. Payment-provider credentials/webhook signing keys and PCI-reviewed operational procedures; manual/card references work without storing card data.
4. Volkswagen/importer authorization for ODIS, erWin, Digital Service Schedule or campaign VIN data. The product records provenance and evidence but does not bypass licensed access.
5. Local HV procedure/qualification approval, staff training and named accountable signatories.
6. Production domain/hosting, MFA and leaked-password protection, rate limiting/bot protection, malware scanning provider, monitoring destinations, paid-plan PITR and an independently tested object backup/restore.
7. GitHub remote creation/push; this machine currently has neither a configured remote nor an authenticated GitHub CLI session.

No source-code implementation can truthfully close these gates without the corresponding external authority and secrets.
