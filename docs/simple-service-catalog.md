# Simple service setup

`/catalog` now opens the Services tab. Admins choose Add service, enter a name, customer price in JOD, and estimated whole minutes, then save once. An optional Arabic name is under Additional details. Workshop capacity and detailed, versioned templates remain separate tabs.

The customer price is a catalog reference, not an internal cost or a posted invoice. Existing estimate/invoice pricing workflows are unchanged. The form explicitly explains this distinction. Existing catalog records without a price show Not set, never a fabricated zero.

## Persistence and access

Migration `20260906235708_simple_service_catalog.sql` was applied to IDstore through the Supabase migration tool (the local CLI was unavailable). Its security-invoker RPC calls the existing catalog creation, task and publishing commands within one transaction. It checks active admin membership and retains the existing organization permission checks. Anonymous execution is revoked.

Prices are stored in the existing version's `applicability_json.service_pricing` with currency JOD. Duration is stored as the service task's standard minutes, so existing appointment selection and workshop planning continue to work. The source is explicitly an internal admin-defined workshop service, not a manufacturer procedure. No existing tables or historical records were removed or modified.

Validation: nonblank names up to 160 characters, price 0–999999.999 with at most three decimals, and duration 1–1440 whole minutes. A save failure returns an inline error without redirecting away from the form. The button is disabled while saving.

## Verification

Database transactions exercised admin creation, persistence/readback, zero price, invalid price/duration, non-admin and cross-organization rejection. Creation was also tested as the authenticated SQL role. Every test transaction was rolled back; the original service count remained one. Anonymous RPC access was verified false. The advisor scan reported existing security-definer RPC warnings and disabled leaked-password protection; the new security-invoker function did not add one of those warnings.

Browser fixtures render the actual form/list in Arabic and English on mobile and desktop, verify the three visible primary fields, optional details, native validation, numeric LTR direction, localized names/prices and containment. Server-action tests verify one RPC call, authorization, validation and recoverable failures. These fixture tests do not submit real customer bookings or invoices.

To disable the new entry point without removing catalog data, revoke execute on `public.create_simple_service(uuid,text,text,numeric,integer)` from authenticated and remove its UI link. Existing records remain available through the versioned catalog.
