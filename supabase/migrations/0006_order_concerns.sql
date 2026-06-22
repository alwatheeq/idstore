-- ===== Structured reported concerns =====
-- Replace the single free-text concern with a preset checklist whose items can
-- be validated/checked off during the job. Stored as jsonb: [{ key, checked }].
-- The existing service_orders.reported_concerns text is kept for free-text notes.

alter table service_orders add column concerns jsonb not null default '[]'::jsonb;

-- ===== Apply to prod with explicit authorization (like 0002–0005). =====
