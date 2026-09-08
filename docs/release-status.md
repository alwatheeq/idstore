# IDstore release status

## Current evidence — 8 September 2026

See [the application audit](application-audit-2026-09-08.md) for findings, fixes, workflow triggers, measurements and verification limits. The connected development database has 70 applied migrations after the approved hardening follow-up. Standalone HV-safety and Diagnostics/battery-health modules are retired from the application; retained historical schema is not an active feature claim.

- ESLint, TypeScript, Arabic coverage (1,631 strings), UI-control checks and the production/standalone build pass.
- Chromium desktop/mobile suite: **301 passed, 1 intentionally skipped**. It combines production-server public-boundary checks, source-loaded action regressions and rendered component fixtures; it is not an exhaustive authenticated business acceptance test.
- Read-only authenticated navigation and mobile Arabic checks exposed and verified the fix for page-wide hydration failures.
- Rollback-only synthetic database tests pass for inspection/admin permissions, follow-up dates, timer/cashier attribution, invoice versions and payment replay/balances.
- Dependency audit reported no known vulnerabilities at audit time.
- No production deployment, real payment, message delivery or real stock transaction was performed in this audit.

## Pending changes and release gates

1. Database privilege hardening is **applied and verified** following explicit user approval and integration review. Migration `20260908144433_audit_access_hardening` removed all 160 anonymous table ACL entries (140 previously visible in information_schema plus 20 MAINTAIN entries), removed postgres's automatic anonymous table/sequence grants, and optimized the portal policy. Non-anonymous grants are unchanged; three rollback-only database suites pass. The rollback snapshot is retained in `tests/fixtures/audit-access-rollback.sql`.
2. Customer due dates are visible and support manual contact; automated reminders need a provider, consent/template policy, scheduler and delivery/retry configuration.
3. Approved service choices, jobs, stock issue and invoice lines are still separate steps. Decide the approved-group/revision rules before automating their conversion.
4. Broad list queries need server-side pagination/search and independent by-ID retrieval before claiming completeness beyond the 1,000-row API cap.
5. Enable/review production Auth protections, monitoring, rate limiting, backup/PITR and a tested restore process. Leaked-password protection remains disabled; no production security certification is claimed.
6. Fiscal integration, payment-provider callbacks, messaging delivery, malware scanning and licensed vehicle-service data require configured integrations and end-to-end staging evidence. Queued outbox records alone are not successful delivery.
7. Legacy database tests include retired HV scenarios and environment-derived identities. Modernize those fixtures before using them as current release acceptance gates.

The previous 5 September status, 26-migration count and 13-test claim were historical and are superseded. Hosting, repository authentication and provisioning deployment status should be checked at release time rather than inferred from stale documentation.
