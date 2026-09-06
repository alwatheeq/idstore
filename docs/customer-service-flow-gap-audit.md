# Customer → vehicle → service flow: implementation audit

Reviewed 7 September 2026 against the shared [Customer Vehicle Service Flow](https://chatgpt.com/s/t_6a9de6a902fc819186c74bb6d09515e5).

This is a gap audit, not a claim that every integration is production-ready. Existing Apple-inspired responsive styling, Arabic support, branch permissions and historical data remain in place. Manufacturer-warranty fields are deliberately excluded because this is an independent, out-of-warranty workshop.

## Delivered in this batch

1. **Quick customer intake:** name and normalized mobile are required; the operating branch is retained and a sole branch is defaulted. Customer type defaults to individual; PIN, company, tax, email, address and notes are in an optional disclosure. Existing mobile/tax matches lead to actionable existing-customer links instead of a dead-end error. Success opens the created customer. A failed optional PIN provisioning step no longer hides successful customer creation behind a caught redirect.
2. **Quick vehicle intake:** customer, catalog model (which carries the make) and either plate or valid VIN. Measurements and other details remain optional. New records use null for absent identifiers, never invented VINs. Server/database validation, normalized duplicate plate detection, unique VIN enforcement, ownership creation and audit recording are retained. Missing identifiers can be completed later; this does not permit changing existing identifiers.
3. **Connected navigation:** customer → add vehicle (owner preselected), customer/vehicle → new visit, customer rail → vehicle, and intake context → customer/vehicle. Intake only offers that customer's current vehicle relationships and resets vehicle selection when customer changes. The server rechecks that relationship. No data is written merely by following a link.
4. **Customer service history:** visits with linked vehicle, branch, mileage, complaint, inspections, quote versions, invoices and invoice-level payment allocations. Summary includes accessible visit count, last visit and posted/part-paid outstanding balances grouped by currency. Reads are explicitly filtered by organization and customer and remain subject to RLS. A query failure is an error, not an empty history. This is **not** the previous address/consent history, now labelled Contact history.
5. **Direct record anchors:** work-order and invoice links locate their exact records. An explicit work-order deep link can show the RLS-accessible order from another branch without changing the operating branch selection.
6. **Arabic/mobile:** new labels have reviewed workshop Arabic; compound identifiers are LTR, dates use the selected locale with Latin digits, and forms/history cards collapse on narrow screens.

Implementation: `app/(app)/customers`, `app/(app)/vehicles`, `app/(app)/work-orders`, `components/customer-service-history.tsx`, `components/intake-identity-fields.tsx`, `components/journey-date.tsx`.

## Comparison with the full requested journey

| Requirement | Current state / remaining work |
| --- | --- |
| Quick customer + unique mobile + optional PIN | Implemented in the web intake; existing database/portal identity guards retained. Live duplicate checking while typing and in-place inline creation remain UX enhancements. |
| One customer, many vehicles | Existing ownership ledger; linked navigation added. Historical ownership is retained rather than deleted. |
| Plate OR VIN, make/model | Implemented for the existing VW ID model catalog. Free-form/non-VW make/model administration is not introduced. |
| Expanded vehicle metadata | Existing color, trim, model year, capacity, drive unit, software and first registration. Registration expiry, origin, purchase details and the complete requested document metadata are still gaps. |
| Registration camera/gallery/PDF + OCR review | Generic private vehicle uploads exist in Records. Dedicated registration intake, extraction confidence, old/new comparison and employee-confirmed field updates are **not implemented**. OCR provider selection, credentials and document-processing/data-residency approval are prerequisites to external processing. |
| Persistent visit context | Added to the intake selection. A consistent context bar across all downstream modules remains to be completed. |
| Multiple complaint selections and notes | Implemented. Voice-to-text and an inline photo/video complaint uploader are not implemented. Existing Records accepts images/PDF and other evidence, not video. |
| Assignment → checks → results → review | Existing inspection workflow and configurable catalog, generated pending checks, append-only results/retests and qualification gates. Real technician/qualification setup is still required before assignment. |
| Findings → services → estimate | Findings can be priced from Estimates and catalog tasks exist. The one-click recommendation-to-catalog-service selection experience still needs work. Inspection tasks must not themselves be treated as approved repair jobs. |
| Labor/parts/fees/discount/tax pricing | Existing estimate lines, catalog pricing and governed overrides. A unified customer-facing preliminary estimate vs formal quotation experience is incomplete. |
| Formal bilingual documents | Existing `/api/documents/[kind]/[id]` service documents. Needs end-to-end review of the new flow and all desired customer-facing fields. |
| Full/partial approval, rejection, supplement | Existing immutable actor/channel/group evidence and supplementary versions. Signature capture, viewed tracking and direct SMS/WhatsApp secure approval delivery still need implementation/configuration. |
| Approval → execution, no compulsory full payment | Existing repair order doubles as preapproval intake; its presence does not mean repairs are authorized. Existing approval/workshop gates are preserved. No new payment-before-repair gate was added. Exact partial-approved job execution behavior needs a dedicated integration test. |
| Full/partial payment and deposits | Invoice payments/allocations and finance controls exist. A distinct quotation-stage deposit workflow remains a gap; do not present manual references as a working online gateway. |
| Quote → jobs without re-entry | Catalog job instantiation exists, but a complete approved-line-to-job/part handoff for every estimate line needs further implementation and verification. |
| Execution, additional work, QC, invoice | Existing job status/timers/narratives, supplementary quotations, stock usage, QC and invoice functions. Comprehensive synthetic end-to-end financial/workshop testing remains. |
| Customer 360 | Linked service history plus dedicated Vehicles, Quotations, Invoices & payments and Documents tabs. Vehicle cards show year/plate/latest recorded mileage/last customer visit and current or historical relationship. Notes editing, unallocated payments and the full requested summary remain incomplete. |
| Vehicle 360 | Technical/ownership/mileage/service tabs plus dedicated Quotations, Invoices & payments and Documents tabs. Comprehensive lifetime totals, a dedicated photos gallery, parts tab and next-service cards remain incomplete. |
| Next service by date OR mileage | Existing deferred recommendations can store due date/km. A configured maintenance-plan engine, whichever-first due calculation, dashboard/customer/vehicle cards and reminder scheduling/delivery remain incomplete. No manufacturer intervals were guessed. |
| Search and navigation | Customer/vehicle lists now have functional GET search and type/status filters, Arabic-digit normalization and reset/empty states. Filtering currently operates on the loaded list (first 1,000 rows; a warning appears at the cap), not a complete server-paginated index. Other module filters and a full navigation audit remain. |

## Next implementation batches

1. Complete remaining 360 summary/notes/parts/gallery views, downstream context headers and server-paginated search. Dedicated financial/document tabs, customer vehicle cards and selected-vehicle upload links are delivered.
2. Add registration document metadata and manual review UI, then connect an explicitly selected OCR provider. Never silently overwrite an existing VIN/plate.
3. Connect findings → catalog service proposal → quotation → approved jobs/parts, including partial approvals and supplemental work. Add synthetic approval/payment/QC regression tests.
4. Add quotation deposits and gateway/webhook integration after provider configuration; retain manual payments as a distinct method.
5. Add administrator-configured service intervals and date/km due calculation, reminder eligibility/consent and provider delivery; test both thresholds.

## Database rollout and recovery

`20260906222853_quick_vehicle_intake.sql` is applied to linked Supabase project `irmtvbeholrcrwgjajjf`. It replaces `create_vehicle` without changing its signature/return type and adds `complete_vehicle_identity`; it makes no table/column deletions and rewrites no customer or vehicle rows.

Verification: isolated PGlite executes the real migration and tests plate-only/VIN-only registration, required model, malformed identifiers, normalized duplicate plate and VIN, ownership, completion, immutable existing identifiers, cross-organization customer/branch rejection, branch-restricted Staff and anonymous rejection. No live customer/vehicle fixtures were created.

Recovery: roll back the web intake first if necessary. Do **not** impose NOT NULL or delete newly created plate-only/VIN-only records. The prior `create_vehicle` function body can be restored from `20260905225415_add_vehicle_color.sql` alone, preserving grants/signature and all historical rows. Leave the additive completion function in place until no deployed web version calls it. Do not rerun the whole older migration (it also manages unrelated profile RPCs).

UI verification is covered by `tests/e2e/customer-journey.spec.tsx` plus the existing Apple layout/Arabic/workshop regression suites. Server action input checks and live read-only Arabic navigation are also reviewed. Provider delivery and OCR are not tested or claimed working.

Final checks for this batch: production build, TypeScript, ESLint, translation coverage (1,797 audited UI strings), `git diff --check`, and isolated database regressions pass. Playwright: **79 passed, 1 expected desktop skip** (the skipped case is mobile-only and passes in the mobile project). These tests combine real component rendering with synthetic data and unauthenticated route checks; they are not a full live financial transaction test. The new web changes are local, not committed/pushed or deployed to Vercel in this batch.

## Second batch: connected record views

- Added customer Vehicles/Quotations/Invoices & payments/Documents and vehicle Quotations/Invoices & payments/Documents tabs, using the same responsive design and reviewed Arabic labels.
- Financial tabs explicitly query the customer **or** vehicle ID as well as organization; unrelated tabs' financial detail is not rendered. Balances still refer to visible posted/part-paid invoices, not an accounting reconciliation or unallocated credit balance.
- Documents collect typed bindings for the chosen vehicle, its repair orders, inspections, diagnostics, battery reports and invoices. Customer documents deliberately include only that customer's own visits and associated inspection/diagnostic/invoice files, not all files belonging to vehicles they once owned. RLS and ten-minute signed URLs are retained; query failure prevents presenting an empty/successful ledger.
- Vehicle upload links preselect the exact target in Records. The upload page omits unrelated message forms and other record targets, works for accessible archived vehicles, and returns success/duplicate/error feedback to the same selected vehicle. Existing upload size/type/permission/checksum checks remain in effect. No new public bucket or OCR processing was added.
- Customer vehicle cards retain historical relationships and restrict New visit links to current ones. Last visit is customer-specific; mileage is the vehicle's latest recorded reading, not an inferred service interval.
- Customer and vehicle GET search supports normalized Arabic/Persian digits and all-word matching; type/status filters combine with the query. Server-side pagination remains pending as described above.
- No database migration or live data changes were required for this batch. Signed-file behavior and isolation use synthetic fixtures; live browser checks were read-only.
- Final verification: **93 Playwright tests passed, 1 expected desktop-only skip**; production build/TypeScript, ESLint, Arabic coverage (1,811 audited strings) and diff checks pass. Arabic numeric dates now strip ICU direction marks before rendering LTR, preventing misplaced separators. Web changes remain local and unpushed.
