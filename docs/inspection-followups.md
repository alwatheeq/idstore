# Inspection follow-ups

Inspection results have two urgency choices: High — within a week, and Stable. Existing stored urgency codes and historical results remain intact. The optional due date is independent of urgency; staff choose the actual contact date rather than a date being inferred silently.

Saving a failed check, a recommendation other than None, or a due date creates an open vehicle follow-up. Retesting updates the same active follow-up instead of generating duplicates. Omitting a date on retest preserves an existing date; use Edit due date to explicitly clear or change it.

Customers and Vehicles display the shared open/scheduled follow-up list, including overdue and undated items. Managed records are scoped to the selected vehicle or the customer's currently linked vehicles. Status changes use the workshop's Asia/Amman calendar date. Staff can click the current customer's phone number to call. This is a staff contact queue, not an automatic SMS/WhatsApp sender or background notification service.

Date edits require inspection.perform or repair_order.manage permission, with organization/branch enforcement in the database. Administrators retain their existing permissions. Stale edits are rejected and changes are audited under the actual acting user. Complete or dismiss work through the existing vehicle deferred-work register.

Migration: `20260908020209_inspection_due_followups.sql`. The rollback fixture restores the prior inspection procedure and disables date rescheduling without deleting follow-up data. SQL regression fixtures run inside a rolled-back transaction. Browser tests cover bilingual copy, mobile layout, contact links, date statuses, and query scoping.
