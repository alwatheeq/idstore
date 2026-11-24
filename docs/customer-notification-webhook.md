# Customer notification webhook

Administrators configure **Settings → Customer notifications** (`/settings/notifications`). Save a public HTTPS URL and a shared signing secret (32–256 characters), send a test, then enable delivery. A blank secret on later saves preserves the existing one. Saving a URL does not send a test automatically. Pausing stops new customer requests; already submitted HTTP requests may complete. Test sends still work while paused and contain no customer details.

Only `message.queued` events are forwarded. Payments, refunds, fiscal invoices and other integration events are excluded. The receiving workflow is responsible for formatting the selected template and delivering the final email, SMS or WhatsApp message. This does not implement automatic reminder scheduling or provider delivery callbacks.

The transport uses [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) and [Supabase Cron](https://supabase.com/docs/guides/cron). Every minute it reconciles prior responses and submits a bounded batch. Requests time out after 10 seconds. Failures retry with increasing delays, up to five attempts; an admin can retry a failed customer notification after correcting its cause. Results usually become visible within two minutes. Refresh the settings screen to update the table.

A 2xx response marks the event **accepted** and the message **sent**, never **delivered**. A receiver should acknowledge only after durably storing the event. Delivery is at least once: deduplicate using `event_id`, including after timeouts. Redirect responses and other non-2xx responses are failures. Settings history records configuration changes without URLs or secrets.

## Receiver contract

POST with JSON, `Content-Type: application/json`:

```json
{
  "schema_version": 1,
  "event_id": "stable-event-uuid",
  "event_type": "message.queued",
  "organization_id": "organization-uuid",
  "created_at": "2026-09-23T00:00:00+00:00",
  "data": {
    "message_id": "message-uuid",
    "customer_id": "customer-uuid",
    "customer_name": "Customer name",
    "branch_id": "branch-uuid",
    "channel": "email",
    "recipient": "customer@example.com",
    "template_code": "VEHICLE_READY",
    "template_version": 1,
    "reference": "business-reference"
  }
}
```

Headers:

- `X-IDstore-Event-ID`: stable event ID.
- `X-IDstore-Timestamp`: Unix seconds for this attempt.
- `X-IDstore-Signature`: `sha256=` followed by lowercase hex HMAC-SHA256 of `timestamp + "." + raw UTF-8 request body`, using the shared secret. Verify against the raw bytes, not parsed/re-serialized JSON; compare signatures in constant time and reject stale timestamps (for example, older than five minutes).

A test uses `event_type: notification.test`, a delivery ID, and `data: {"message":"IDstore webhook test"}`. It contains no customer or recipient fields.

The dispatch allowlist supports `APPOINTMENT_CONFIRMATION`, `APPOINTMENT_REMINDER`, `ESTIMATE_READY`, `VEHICLE_READY`, `INVOICE_ISSUED`, and `SERVICE_FOLLOW_UP`. SMS uses a mobile contact, email an email contact, and WhatsApp a WhatsApp contact. Missing contacts or unsupported templates fail visibly. Active customers require the latest granted channel consent: `appointment_reminders` for appointment reminders, otherwise `service_updates`. Consent is checked on every attempt; missing/withdrawn consent suppresses the message. Suppressed messages are not automatically replayed after a later consent grant; queue a new message with a new business reference.

Endpoint configuration accepts HTTPS on port 443 with a domain name; direct IP addresses, local/internal hostnames, URL credentials, fragments and whitespace are rejected. Only a trusted organization administrator can configure the endpoint. Do not point it at a domain that resolves to private infrastructure; the database HTTP transport follows the configured hostname's DNS. Endpoint and secret tables, raw HTTP transport tables and worker functions are unavailable to ordinary authenticated roles.

## Verification

`tests/customer-notification-webhook.sql` exercises admin/tenant isolation, secret redaction, invalid URLs, stale saves, signing, test payloads, disabled delivery, event filtering, acceptance, retries and consent withdrawal. It requires the offline transport in `tests/fixtures/notification-transport-shims.sql` and refuses the real pg_net schema. Use only a disposable local database; omit the two extension creation lines and cron scheduling when loading the migration with shims. No live external endpoint was called during implementation.


Applied migration: `20260922222327_customer_notification_webhook`. The recurring worker is installed in the connected project. No webhook configuration is created by the migration, so it cannot dispatch customer data until an administrator saves and enables the endpoint.

Validation completed: production build and type/lint checks passed; 309 desktop/mobile tests passed with 1 existing skip; offline SQL transport regressions passed. The signed-in Arabic settings page renders with an empty URL and delivery disabled. The scheduled database worker ran successfully with no endpoint configured.
