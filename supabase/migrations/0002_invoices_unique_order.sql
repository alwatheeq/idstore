-- ===== Enforce one invoice per service order =====
-- Closes a race in generateInvoice (src/features/invoices/api.ts): two concurrent
-- calls could both pass the JS existing-invoice check and insert duplicate rows.
--
-- This UNIQUE constraint makes the database the authoritative idempotency guard.
-- After this lands, the JS check in generateInvoice is a fast-path optimisation only
-- (it avoids an unnecessary round-trip); the constraint is the real safety net,
-- failing the second concurrent insert with a unique_violation regardless of timing.
alter table invoices add constraint invoices_service_order_id_key unique (service_order_id);
