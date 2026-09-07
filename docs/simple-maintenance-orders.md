# Simple maintenance orders

Work orders are the default entry point. Each order is either Maintenance or Bodyshop; bodywork uses a separate order even for the same vehicle. Technician timers, diagnostics and lifecycle transitions remain in the Advanced view.

## Inspection-led workflow

1. Open a work order with its branch, customer, vehicle, type and reported issues.
2. Assign the inspection and generate its checklist using the existing configurable check matrix.
3. Record results and complete the inspection review.
4. The assigned technician (or administrator) selects one or more matching services and an optional finding/reason. Selection is recorded against both the inspection and work order with actor, timestamp, service ID and description snapshots.
5. Price the selected services and required spare parts on the order; use the existing approval and billing workflow.

Selections are recommendations, not customer approval, stock issuance or automatic job assignment. Repeated selection of the same service version on an inspection is idempotent. Historical selections are retained rather than overwritten.

## Simple service catalog

Admins define Description and order type. A stable Service ID is generated automatically; an Arabic description is supported. Price and estimated minutes are optional. Editing preserves previous versions and published pricing records.

The starter catalog contains 20 Maintenance services (brakes, filters, tyres, suspension, 12V battery, sensors, lighting, diagnostics and related routine work) and 6 Bodyshop services (dent, paint, bumper, panel and polish work). No invented prices, durations or mandatory maintenance intervals are seeded. Engine-oil changes are excluded for VW ID electric vehicles, as described by [Volkswagen's EV workshop guidance](https://www.vw.com.cy/en/e-mobility-and-id/id-magazin/e-mobility/electric-vehicles-in-the-workshop.html). Offerings are not repair procedures or evidence that a service is required.

Existing orders and templates default to Maintenance; no historical records were deleted. The admin can create separate Bodyshop offerings, but cannot silently reclassify a service with existing history.

Intake requires branch, customer and linked vehicle. Notes are optional; mileage, charge level, promised handover and the reported-issues matrix are grouped under optional intake details.

## Pricing and persistence

- New orders open their own workspace after intake. Prepare order creates a draft estimate without pretending that diagnosis has started.
- Add a published service selected through a completed inspection, or an active inventory part, with quantity, unit price and optional tax. Service type must match the order. Catalog names are resolved again on the server; prices are copied as editable defaults, not assumed when unset or in another currency.
- The existing estimate ledger calculates totals. Sent/approved estimates remain immutable. Approval, revisions and billing use the existing Estimates workflow.
- Legacy orders invoiced without an estimate use their existing invoice ledger. Draft invoice items can be added/removed here with optimistic version checks; posted invoices are read-only.
- Parts on the price list are **not stock issues or reservations**. Stock issuance continues through Inventory. No duplicate monetary ledger or stock movement is created.
- Services here are priced line items, not automatically assigned technician jobs. Advanced retains the existing job workflow.
- Existing fees, discounts and other historical line types remain visible under Other charges.

## Boundaries

Every action authenticates, reads the tenant-scoped order and checks the selected operating branch. Terminal orders are read-only. The existing transactional RPCs enforce branch permissions, draft-only edits, version conflicts, totals and audit events. Invoice/estimate IDs and removal targets are checked against the order before mutation.

Two additive migrations allow immediate intake pricing and a first price list on older active orders only when no estimate or invoice exists. Existing records were not migrated or deleted.

## Verification

- New database RPCs verified within rollback transactions: both order types, ID/description-only service creation, versioned edits, completed-inspection requirement, wrong-type rejection, repeated-selection idempotency and unauthorized-user rejection. Authenticated API wrappers work; no test services remain.
- The new selection table has branch-scoped read RLS and no direct authenticated writes. Public RPC wrappers use invoker security with authorization-checked private implementations. The security advisor reports no new warnings from these additions; existing project warnings remain.

- Browser fixture tests: English/Arabic at mobile and desktop widths, accessible labels, field containment and LTR prices.
- Action fixtures: service/part saves, tenant/order filters, branch mismatch, invalid decimals, unavailable catalog items, locked estimates, posted invoices, invoice version requirements, and removal.
- Supabase rollback checks: intake draft creation, line totals (25 + 2 × 10 with 16% tax = 52.200), removal totals, duplicate draft denial, locked estimate denial and unauthorized caller denial.
- Existing draft invoice add/remove and stale-version rejection verified inside a rollback transaction; no test invoice lines remain.
- Authenticated-role execution and anonymous EXECUTE denial verified. Test orders and estimates were rolled back.
- Security advisor retains the existing intentional warning for authenticated access to the permission-checked SECURITY DEFINER pricing RPC; its empty search path and explicit authentication/branch permission checks are preserved.
