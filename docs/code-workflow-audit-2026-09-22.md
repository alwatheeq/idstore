# Code and workflow audit — 22 September 2026

**Remediation update:** See [audit fixes, 23 September](audit-fixes-2026-09-23.md). The findings below preserve the original audit evidence; F15 remains pending provider implementation.

The application has substantial working infrastructure, but several workflows remain incomplete or internally inconsistent. Passing UI and action tests does not establish that a customer visit can complete correctly through financial settlement and stock consumption.

## Scope and evidence

- Inventoried all **106 exported Server Actions**, their application references, and named database calls; every literal RPC name inspected has a definition in the checked-in migrations. The companion function inventory lists each action.
- Reviewed all action modules, route handlers, the two account-provisioning Edge Functions, shared authorization/form helpers, operational page queries, and relevant database command definitions and later replacements.
- Re-ran TypeScript, ESLint, UI-control audit and Arabic coverage audit: all pass. Control audit: **364 controls / 343 actions / 72 TSX files**. Arabic coverage: **1,631 strings**.
- Existing desktop/mobile Playwright suite: **305 passed, 1 intentionally skipped**, 30.1 seconds. Used the running app on port 3001 via a temporary configuration; the normal test command initially failed because it tried to start another Next development server in the same checkout.
- Four isolated probes against loaded application code confirmed: draft invoices inflate outstanding reports; report-query failures become zero metrics; a user with only `repair_order.manage` cannot see the QC navigation item; invalid refund amounts reach the RPC as `NaN`.
- Read the installed Next.js Server Actions documentation, including its request-size default.
- No business data, application behavior, database migrations or external accounts were changed. No messages or payments were sent. Only audit documents were added.

**Limits:** SQL findings describe checked-in definitions and their call paths. This audit did not compare them against the currently deployed database, execute the SQL regression suites, reproduce concurrent database transactions, or perform a full authenticated visit with real staff/customer accounts. Existing browser tests include source-loaded mocks, component fixtures and unauthenticated boundaries; they are not 305 real business transactions. External workers could exist outside this repository; their deployment was not verified. Earlier audit results were treated as historical evidence, not fresh verification.

## Findings, ordered by priority

### F01 · P1 — Refund replay returns data before checking authorization

**Source:** `supabase/migrations/20260905065830_finance_quality_campaign_commands.sql:144–149`, `record_payment_refund`.

The SECURITY DEFINER function finds an existing refund by organization derived from the supplied payment ID and idempotency key, then returns the complete refund before calling `has_permission`. The function is granted to authenticated callers. An authenticated user who knows a target payment ID and its refund reference can hit this return path without the required tenant/branch/refund permission. This is a conditional disclosure of an existing refund, not evidence of an unauthorized new refund or an observed incident. Reusing a key for another payment in the same organization also returns the unrelated original refund without checking payload consistency.

**Fix:** Resolve and authorize the payment before the replay lookup, and verify the existing refund's payment, credit note and relevant request fields. Add cross-tenant, revoked-permission and mismatched-replay tests.

### F02 · P1 — Concurrent refunds can exceed a credit note

**Source:** same migration, `record_payment_refund`, lines 146–155.

The function locks the payment, but reads the credit note without `FOR UPDATE`. When an invoice was paid using two payments, two concurrent refund requests can lock different payment rows, each read the same remaining credit-note balance, and both insert. For example, two payments of 60 and a credit note of 60 allow simultaneous 40 refunds to each see 60 available, recording 80 against that credit note. The per-payment check does not serialize this shared limit.

**Fix:** Lock the shared credit note before reading its aggregate refunds, using a consistent lock order; recheck balances inside that transaction. Add a real two-connection concurrency regression. This finding is source-traced, not concurrency-tested here.

### F03 · P1 — Partial credit notes do not reduce the amount collectible

**Sources:** `20260905065830_finance_quality_campaign_commands.sql:100–137` (`post_credit_note`); `20260904205436_billing_payment_commands.sql:288–296` (`receive_invoice_payment`); `20260905083158_portal_self_service.sql` (`portal_request_payment_link`).

Posting a partial credit records a separate credit note but leaves invoice `grand_total` and `paid_total` unchanged. Collection and payment-link requests compute due as `grand_total - paid_total`, without credits. A posted 100 JOD unpaid invoice with a 40 JOD credit can still accept/request 100 JOD rather than 60. Fully credited invoices are excluded from collection by status, but the report still includes their original unpaid amount. Reports and displayed balances share the same missing credit calculation.

**Fix:** Define one authoritative net receivable calculation that accounts for credits and the chosen refund-allocation model; use it consistently in collection validation, portal requests, invoice UI and reporting. Test partial/full credits before and after payment. Preserve immutable invoice face values.

### F04 · P1 — Inspection safety holds have no supported release workflow

**Sources:** `20260908020209_inspection_due_followups.sql:93–98`; `20260905065830_finance_quality_campaign_commands.sql:266`.

An immediate inspection failure sets the repair order to `quarantine`. Later passing retests and completed reviews do not clear that risk state. Work-order progression rejects ready/delivered/closed while quarantined. No active action or checked-in command was found for a reviewed release of that hold; searches of risk-state writes find escalation but no release to normal. Completing or dismissing the recommendation is a separate record change.

**Trigger:** fail a maintenance check with immediate urgency, repair it, record a passing retest and review, then try to release the vehicle. The order remains blocked.

**Fix:** Add an authorized, audited release operation that verifies resolution of all relevant blocking findings and records release evidence. Do not simply clear the hold on any single passing result.

### F05 · P1 — Quality release can reuse obsolete evidence or bypass a later failure

**Source:** `20260905065830_finance_quality_campaign_commands.sql:256–270`, `transition_repair_order`; `record_quality_check:196–206`.

The passing-QC guard runs only for `qc → ready`. It accepts a historical pass if no later fail exists, without requiring that pass to follow the latest reopening/work cycle. Thus ready → in_progress → qc can reuse the earlier pass. Quality checks are also allowed while ready: recording a new failure there does not change order status, and ready → delivered does not recheck QC. A later failure can therefore be followed by delivery when risk state remains normal.

**Fix:** Tie QC approval to the current work/release revision, invalidate it when work resumes, and enforce the current passing outcome at handover. Test both sequences explicitly.

### F06 · P2 — Sending a workshop job to QC leaves it without a completion action

**Sources:** `app/(app)/work-orders/page.tsx:152–160`; `20260908014438_admin_on_behalf_permissions.sql:211–268`; `record_quality_check` above.

`finishJob` offers “Send QC” and closes the timer with job status `qc`. The page deliberately renders no dispatch/timer control for QC jobs. `finish_job` only accepts an in-progress job; `start_job` does not accept QC; `resume_job` handles paused/blocked jobs. Recording a quality check only inserts evidence and does not complete or return the job. No application path from job QC to completed was found.

**Fix:** Add explicit pass/fail QC decisions that complete the job or return it for rework, with permission, version and evidence checks. Keep the job and order states consistent.

### F07 · P2 — Evidence upload advertises a size the server rejects

**Sources:** `app/(app)/records/actions.ts:10,42–43`; `next.config.ts`; installed `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md:27`.

The UI/action promises files up to 50 MB, but submission uses a Server Action and no `serverActions.bodySizeLimit` is configured. The installed framework defaults to a 1 MB total action request. A typical multi-megabyte photo or PDF is rejected before `uploadEvidence` can validate it or provide its normal feedback.

**Fix:** Prefer direct authorized private-storage uploads with a registration step, or set and test a deliberately supported request limit with multipart overhead and hosting limits. Align the displayed limit with the real path. Verified from code/configuration; no file was uploaded to business storage.

### F08 · P2 — Waitlist and portal requests cannot be converted to bookings in the UI

**Sources:** `app/(app)/appointments/page.tsx:127`; `app/(app)/appointments/actions.ts:152–173`; `20260905081516_advanced_scheduling.sql:172`.

The action/database support `booked` with an appointment ID, but the waitlist form exposes only offered/cancelled/expired and supplies no appointment ID. “Offer slot” only changes status; it does not create a slot offer or booking. Creating a separate appointment does not link or close the request. Portal requests enter this same waitlist.

**Fix:** Add a request-to-booking flow that carries customer, vehicle, branch and preferred window into scheduling and atomically links the resulting appointment to the waitlist entry. Include rejection/cancellation and duplicate-submission behavior.

### F09 · P2 — Parts are priced but cannot be issued to a workshop order through the app

**Sources:** `app/(app)/work-orders/item-actions.ts:66–74`; `components/maintenance-order-items.tsx`; `app/(app)/inventory/actions.ts:40–101`.

Adding a part passes its description and commercial values, without retaining the catalog part ID in the line command. The component tells users to issue stock separately in Inventory, but that action permits only receipt/adjustment gain/adjustment loss, and dispositions cover supplier return/scrap. No workshop issue/return/reservation action was found in the application. The database movement engine supports more movement types, but that is not a usable order-linked workflow. A loss adjustment would not provide the missing order/part consumption linkage.

**Fix:** Preserve part identity, implement order-linked reserve/issue/return operations, and reconcile billed quantity against consumption without assuming every priced part should be issued immediately. Cover tracked lots/serials and insufficient stock.

### F10 · P2 — Approved pricing is disconnected from invoice and job creation

**Sources:** `20260904205436_billing_payment_commands.sql:55–113`; `app/(app)/invoices/actions.ts:15`; `app/(app)/work-orders/actions.ts:109`; `components/maintenance-order-items.tsx`.

The invoice-from-order command creates a header with no estimate lines. Approval does not instantiate workshop jobs from the inspection-selected services. Appointment-derived catalog jobs exist on a separate path; they do not close the gap for the current work-order-first flow. Staff must re-enter approved prices/quantities and manually create jobs, with no enforced link to approved versus declined groups. The default workspace continues displaying the latest estimate even after an invoice exists, because invoices are read only when no estimate exists.

**Fix:** Provide explicit, idempotent “Create jobs from approved scope” and “Create invoice from approved scope” operations, with a defined supplement/group policy and traceable source IDs. Show the resulting invoice in the order workspace. This remains a product workflow gap rather than a missing RPC-name error.

### F11 · P2 — Historical records and totals are silently truncated at the API row cap

**Sources:** `supabase/config.toml:18` (`max_rows = 1000`); `app/(app)/work-orders/page.tsx:59–68`; `app/(app)/reports/page.tsx:27–39`; analogous unpaginated directory/ledger queries.

Work orders and jobs are fetched as whole organization lists, then filtered for a selected branch or explicit order ID in JavaScript. Under the configured 1,000-row cap, a valid older deep link can be reported as absent, and newer records from other branches can crowd out the selected branch. Reports sum capped row sets and present them as totals. This is a correctness issue as the dataset grows, not merely a performance concern.

**Fix:** Fetch explicit IDs and branch scopes in the database query; paginate lists and use database aggregates for reports. Test with more than 1,000 records distributed across branches. The deployed API cap was not queried in this audit.

### F12 · P2 — Draft invoices inflate the outstanding report

**Source:** `app/(app)/reports/page.tsx:41,63–64`.

`branchInvoices` excludes only void invoices. “Billed” excludes draft, but “Outstanding” sums every remaining row. An unposted 100 JOD draft renders as 100 JOD due. An isolated probe against the actual page function reproduced this. Credit handling is separately described in F03.

**Fix:** Include only collectible posted statuses and the shared net balance calculation. Add a reporting fixture containing draft, posted, paid, partially paid, void and credited invoices.

### F13 · P2 — Failed report reads are presented as zero business activity

**Source:** `app/(app)/reports/page.tsx:27–39` and its `data ?? []` calculations.

Report reads destructure data and discard errors. Permission/backend/query failures therefore become zero balances, zero billing or empty branch lists. The isolated probe confirmed failed reads render zero financial metrics. Similar secondary-query error handling occurs across several setup/dropdown pages, where failure can masquerade as missing setup.

**Fix:** Distinguish unavailable data from a genuine zero and present retry/error states. Do not publish a combined financial total from partially failed queries.

### F14 · P2 — QC navigation uses different permissions from QC execution

**Sources:** `lib/navigation.ts:32`; `record_quality_check` in `20260905065830_finance_quality_campaign_commands.sql:201`.

The sidebar shows Quality & campaigns for `inspection.perform` or `report.operations.read`. Signing QC actually requires `repair_order.manage`. A work-order manager with only that capability cannot discover the page needed to release an order, while users with inspection/report access see a form the database rejects. An isolated navigation probe reproduced the hidden-page case.

**Fix:** Align navigation and controls with each command's capability. Separate QC controls from campaign controls, which have their own branch/CRM requirements. Keep backend authorization authoritative.

### F15 · P2 — Queued integrations have no delivery implementation in this repository

**Sources:** `app/portal/actions.ts` (`requestPaymentLink`); `app/(app)/records/actions.ts` (`queueCustomerMessage`); `app/(app)/invoices/actions.ts` (`postInvoice`); `app/(app)/governance/page.tsx`; `supabase/functions/`.

Payment links, customer messages and fiscal documents enqueue database events. The only checked-in Edge Functions provision accounts; no provider sender, outbox consumer, payment webhook or fiscal-delivery adapter was found. Follow-up due dates likewise have manual contact controls but no included automatic reminder sender. Governance displays integration status; it does not implement delivery or retry processing.

**Fix:** Treat these as queued requests until an external worker is deployed and verified. Implement or document ownership of delivery, retries, deduplication, callbacks and failure recovery; show actionable pending/failed states. This is a repository/deployment-verification gap, not proof that no separately deployed service exists.

### F16 · P3 — Finance numeric validation lets invalid values reach the backend

**Source:** `app/(app)/finance-control/actions.ts:9–37`.

The helper returns `NaN` for non-finite input, but checks only `<= 0` or `< 0`, which are false for NaN. Blank input becomes zero. An isolated probe confirmed `recordRefund` sends NaN to the RPC; JSON serializes it as null. Database constraints can reject the mutation, but the caller receives a generic failure instead of a precise field error, and blank counted cash can become a real zero.

**Fix:** Require nonempty input where appropriate, validate `Number.isFinite`, and check monetary range/precision consistently before the RPC. Keep database constraints too.

## Feature-by-feature disposition

“Connected” below means the application reference and command exist and were traced. It does not mean a full live transaction passed.

| Feature | Functions/workflow reviewed | Disposition |
|---|---|---|
| Login/session | Mobile/PIN login, return destination, staff/portal selection, active profile, session refresh, signout | Connected; existing boundary tests pass. No recovery/reset-PIN workflow found; provisioning is creation-only and duplicate mobile accounts cannot be re-created. Live credential recovery remains unverified. |
| Branch selection | Active branches, selected-branch cookie, branch resolution | Connected; selected branch is a UI scope, while RLS/command checks are the authorization boundary. Several pages query all accessible branches before filtering. |
| Branch administration | Create, contacts, directory edit/archive/restore | Connected; admin checks and audited commands present. Deployment/real archive scenarios not executed. |
| Staff/access | Provision, edit, suspend, delete access, roles, branches, permissions | Connected; Edge create-then-link and compensating Auth cleanup present. Existing mocked-action tests pass. No PIN reset/change action found. |
| Customers | Create/duplicate check, contacts, addresses, consent, status, portal provisioning | Connected. Account creation and customer creation are intentionally separate steps with partial-success feedback. Portal recovery/revocation UI requires further product work. |
| Vehicles | Create/complete identity, profile, ownership start/end, odometer, directory lifecycle | Connected; ownership and correction checks exist. Parent list pagination remains F11. |
| Appointments | Catalog booking, recurring bookings, resources, status, signed check-in, open order | Connected. Waitlist conversion F08; check-in handoff redirects to the general work-order list instead of the created order. No reschedule/edit-appointment UI found; cancel/rebook is the available workaround. |
| Catalog/capacity | Simple service versioning, templates/tasks/publish/retire, resources, bookings, hours, holidays | Connected. Capacity editing exists in catalog tabs. Tracked-part transfer selection is incomplete: transfer UI filters parts to `tracking === none` and provides no lot selector even though the action accepts `lotId`. |
| Work-order intake | Customer/vehicle ownership, branch, type, concern, promised date | Connected; current service-first workspace opens an explicit order. F11 can break historical links. |
| Inspections | Create, assign, select/generate checks, results, exceptions, retests, review, cancel, service selection | Connected current workflow; immutable attempts/review evidence present. F04 blocks safety-hold resolution. Four older Server Actions have no active application reference; see inventory. |
| Follow-ups | Recommendations, status, due-date reschedule, customer/vehicle lists and call links | Connected for manual work; automatic delivery F15. Retest evidence does not itself resolve old findings/holds. |
| Pricing/estimates | Prepare, line add/remove, send, whole/group decisions, supplement, override, discard | Connected. Scope-to-execution/billing F10; source part/service identity is lost in generic commercial lines F09/F10. |
| Technician work | Job creation/assignment, start/finish timer, pause/block/resume, narrative, rework | Connected until QC; F06. Order status changes are separate from individual job state changes. |
| Quality/campaigns | QC signoff, campaign create/verify/retire, match/complete vehicle | Commands and forms connected; QC lifecycle F05/F06 and discoverability F14. |
| Invoices/payments | Draft/lines/post, document download, payment receipt | Connected; stable form keys and version checks present. Approved scope F10 and net credits F03 remain. Recording a payment method does not contact a gateway. |
| Finance control | Credits, refunds, cash open/close/approve | Connected but F01–F03 and F16 need correction. Concurrency and real reconciliation not tested here. |
| Inventory | Parts, receipts/adjustments, catalog relationships, return/scrap | Connected for displayed operations. Workshop issue missing F09; manual movement always supplies null lot, so tracked receipts need Purchasing. |
| Purchasing | Suppliers, purchase orders/lines/state, receipts, supplier invoice matching | Connected. Supplier invoice form sends one line per call; multi-line document entry/editing is not exposed as a complete workflow. No live supplier/receipt mutation performed. |
| Transfers/counts | Transfer/reservation/state/receipt, blind count lines/post | Connected for untracked parts; tracked transfer picker gap above. No live stock ledger mutation performed. |
| Files/messages | Upload/hash/register, private file links, queue message | Upload size F07 and delivery F15. Malware-scanning integration appears as an external gate, not a verified pipeline. |
| Reports/dashboard/search | Scoped reads, aggregates, filters and record links | F11–F13; no representative-volume benchmark. Reports also average branch cycle averages without weighting by completed-order count. |
| Governance | Integration/outbox overview, audit reads | Read-only visibility is connected; consumer/delivery implementation F15. |
| Health/readiness | Process health and configuration check | Connected; readiness only validates configuration shape, not database connectivity, migrations or provider availability. Treat it as configuration readiness. |

## Recommended repair sequence and acceptance checks

1. **Financial correctness and access:** F01–F03. Verify replay permissions, shared-credit concurrency, net balances, partial/full credits and refunds with database transactions and real role scopes.
2. **Workshop completion:** F04–F06 and F14. Run a failed inspection → repair → passing retest → reviewed hold release → QC → handover journey, plus QC failure and reopen cases.
3. **Complete the handoffs:** F08–F10. Portal request → booking → check-in → inspection → approved scope → assigned jobs → issued parts → invoice; prove IDs and quantities remain linked.
4. **Reliable use at volume:** F07 and F11–F13/F16. Exercise supported attachment sizes, deep links past the row cap, a non-first branch, partial query failures and financial status fixtures.
5. **Deploy and verify external workers:** F15. Show an event progressing from queued to delivered/accepted or a retryable/terminal failure; prove callback validation and replay handling.

No source fixes were applied as part of this review. The findings are ready to turn into implementation work without changing existing business records during the audit.
