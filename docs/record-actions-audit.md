# Record actions audit — 8 September 2026

## UI convention

- Pencil: edit. Eye: inspect an existing record. Archive: remove a reusable record from active use. Restore: reactivate it. Trash: delete a removable draft/item, or open a clearly labelled cancellation confirmation.
- Each icon has an English/Arabic accessible name and tooltip. Buttons are 36px on desktop and 44px on touch/narrow screens. Logical CSS properties support RTL; action columns remain reachable when tables scroll.
- Save/Cancel and consequential workflow buttons keep text. Unsaved creation forms have Cancel, not Delete.
- Archive/retire/cancel/discard screens identify the target, explain what happens, require a reason and explicit confirmation. New directory writes are admin-only, tenant-scoped and reject stale timestamps. Existing staff permissions for operational actions remain unchanged.

## Module coverage and retention policy

| Module / records | Editing | Removal / historical records |
| --- | --- | --- |
| Customers | New name/type/legal/tax/notes editor; existing contacts, addresses and portal controls | Archive/restore; portal access is revoked on archive and is not automatically restored. Open orders/appointments block archive. Consent history remains append-only. |
| Vehicles | Existing technical identity, branch, color, ownership and mileage controls; explicit pencil in roster | New archive/restore. Resolve restrictions and open work first. Ownership/mileage evidence is corrected through its existing history workflow. |
| Staff | Details, roles, branches, permissions, technician profile | Delete access/restore without erasing completed work. Self-deletion and final-admin safeguards remain. |
| Branches | New name/legal name/city editor plus existing contacts editor | Archive/restore; last active branch, open activity and stock are protected. |
| Parts | New English/Arabic description and price editor; existing tracking identity/catalog controls | Archive/restore with stock, reservation and open purchase-order guards. Part numbers and stock tracking identity are not rewritten. |
| Suppliers | New supplier directory with name/tax/phone/email editor | Archive/restore; linked open purchase orders block archive. |
| Services | Existing versioned ID/description/price/time editor, now icon-based | New retirement confirmation; archived-services view lets an admin edit/reissue a new version. Previously selected service snapshots remain usable on existing orders. |
| Resources | New name editor; existing capacity/booking controls | Archive/restore; future active bookings block archive. Branch and resource identity remain stable. |
| Inspection catalog | Existing detailed model-aware editor; compact archive for organization-owned items | New archive/restore for custom checks. Shared standard definitions are not deleted by an organization. Generated checklist snapshots are retained. |
| Inspections | Assignment, selection, per-check results/retests and review | New cancel option for unfinished inspections. Completed inspections and findings remain evidence, not deletable rows. |
| Work orders | Existing services/parts, job assignment, narrative and state controls | Existing cancellation/rework workflow; item removal uses compact confirmed trash actions. Closed service history is not erased. |
| Appointments | Existing reschedule, waitlist, booking and check-in controls | Existing cancellation/no-show workflow; checked-in order history retained. |
| Estimates | Existing draft pricing/line controls and revisions | New discard for unsent drafts marks the version superseded, preserving numbering and finding provenance. Sent/approved documents use revisions, not destructive edits. |
| Invoices | Existing draft line controls; pencil opens draft editing | New discard removes an unposted, unnumbered draft and its lines; foreign-key references block deletion. Posted invoices remain locked and use credit notes. |
| Payments / finance | Existing receipts, credits, refunds and cash-session workflows | Posted monetary evidence is not hard-deleted. Refund/reversal/approval operations remain explicit. |
| Purchasing | Existing draft lines, supplier invoice matching and receipt workflows | Existing purchase-order cancellation; posted receipts/matching history remain ledger evidence. |
| Stock control | Existing transfers, count entry, adjustments and disposition workflows | Cancel unposted transfers through their state controls; correct posted balances with movements, never rewrite stock history. |
| Diagnostics / battery reports | Module removed from the app | No page, server actions, navigation, work-order shortcut or new uploads. Existing database records and historical document downloads are retained. |
| Quality / campaigns | Existing QC results, campaign matching and transitions | Existing retire/not-applicable/rework transitions. Historical quality evidence retained. |
| Files / messages | Existing upload/link/queue workflows | Evidence hashes and delivery history are retained; not exposed to generic directory deletion. |
| Settings / governance | Existing permission and organization-status controls | Access revocation/status transitions, not deletion of audit/security records. |
| Dashboard / reports / search | Derived views link to source records | No independent records to edit/delete. |

This is not a blanket SQL CRUD interface. Prices on posted documents, audit events, inspection evidence, consents and stock movements deliberately retain their specialized controls. Existing operational forms such as purchase-order lines still use their established add/cancel/reissue workflow rather than a universal row editor.

## Safety and verification

- RPCs live in `app_private` with empty search paths and explicit administrator checks; public wrappers are security-invoker. Table names and editable columns are allowlisted. Anonymous execution is revoked.
- New actions never accept a caller-selected organization, role, status, SQL table or arbitrary update columns. Archived customers do not regain portal access merely by restoring their directory record.
- `tests/directory-records.sql` exercises real DB behavior inside `BEGIN…ROLLBACK`: every directory edit/archive/restore, role/tenant boundaries, stale writes, open-work guard, service retirement, inspection cancellation, draft discard and posted-document protection. It leaves no fixture records behind.
- Browser regression coverage includes real rendered controls in English/Arabic at 390px and 1280px; server-action tests cover allowlists, confirmation, validation and error redirects.
- Supabase security advisors reported no new findings for these functions. Existing project-wide warnings were unchanged (110 legacy authenticated security-definer notices and the pre-existing leaked-password-protection setting).
- No production customer/staff/financial record was deleted during verification. No Git push or Vercel deployment is part of this request.
