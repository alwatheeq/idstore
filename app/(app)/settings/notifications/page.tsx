import { ResponsiveTable } from "@/components/responsive-table";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LocalizedContent } from "@/components/localized-content";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { saveNotificationWebhook, testNotificationWebhook, retryNotificationWebhook } from "./actions";

type Settings = {
  config: { endpoint: string; enabled: boolean; version: number; secret_configured: boolean };
  deliveries: Array<{ id: string; is_test: boolean; state: string; attempts: number; status_code: number | null; error_code: string | null; created_at: string; config_version: number | null }>;
};
const errors: Record<string, string> = {
  http_error: "The receiver returned an unsuccessful response.", network_or_timeout: "The receiver could not be reached or timed out.",
  customer_or_consent: "Customer inactive or channel consent not granted.", recipient_or_template: "No matching contact address or supported template.",
  message_not_queued: "This message is no longer queued.", settings_changed: "Settings changed. Send a new test.",
};
export default async function NotificationSettingsPage({ searchParams }: { searchParams: Promise<{ created?: string; error?: string }> }) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect("/dashboard");
  const query = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("notification_webhook_settings", { p_organization_id: staff.organizationId });
  if (error || !data) throw new Error("Notification settings could not be loaded.");
  const { config, deliveries } = data as unknown as Settings;
  return <LocalizedContent><>
    <PageHeader eyebrow="Settings" title="Customer notifications" description="Connect your customer notification workflow. Only administrators can change this webhook.">
      <Link className="button" href="/settings/notifications">Refresh status</Link>
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error}/>
    <section className="panel"><div className="panel-header"><div className="panel-title">Notification webhook</div><StatusPill label={config.enabled ? "Enabled" : "Paused"} tone={config.enabled ? "green" : "gray"}/></div>
      <form action={saveNotificationWebhook} className="form-grid panel-body">
        <input type="hidden" name="version" value={config.version}/>
        <div className="form-field form-span-2"><label htmlFor="notification-url">Webhook URL</label><input id="notification-url" name="endpoint" type="url" defaultValue={config.endpoint} placeholder="Webhook URL" dir="ltr" maxLength={2048} required autoComplete="off"/><span className="field-hint">Use the public HTTPS address supplied by your notification service.</span></div>
        <div className="form-field form-span-2"><label htmlFor="notification-secret">Signing secret</label><input id="notification-secret" name="secret" type="password" minLength={32} maxLength={256} required={!config.secret_configured} autoComplete="new-password"/><span className="field-hint">Use the same secret in your receiving workflow. At least 32 characters. Leave blank to keep the saved secret.</span></div>
        <label className="form-span-2"><input type="checkbox" name="enabled" defaultChecked={config.enabled}/> Enable customer notification delivery</label>
        <p className="field-help form-span-2">Enabling sends eligible queued and future customer notifications. Payment and fiscal events are excluded. The receiving service handles the final customer delivery.</p>
        <div className="form-actions form-span-2"><button className="button primary" type="submit">Save notification settings</button></div>
      </form>
    </section>
    {config.secret_configured ? <section className="panel panel-body"><p>Save changes first, then send a test without customer details. Tests also work while delivery is paused.</p><form action={testNotificationWebhook}><input type="hidden" name="version" value={config.version}/><button className="button" type="submit">Send test webhook</button></form></section> : null}
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Recent delivery attempts</div><div className="panel-subtitle">Accepted means the webhook received the event, not that the customer received a message. Failed requests retry automatically up to five times.</div></div></div>
      <div className="data-scroll"><ResponsiveTable className="data-table"><thead><tr><th>Time</th><th>Type</th><th>Status</th><th>Attempts</th><th>Response</th><th>Actions</th></tr></thead><tbody>
        {deliveries.length ? deliveries.map(delivery => <tr key={delivery.id}><td>{new Date(delivery.created_at).toLocaleString("en-JO", { timeZone: "Asia/Amman" })}</td><td>{delivery.is_test ? "Test" : "Customer notification"}</td><td><StatusPill label={delivery.state} tone={delivery.state === "accepted" ? "green" : delivery.state === "failed" ? "red" : "amber"}/></td><td>{delivery.attempts}</td><td>{delivery.status_code ?? "—"}{delivery.error_code ? <p>{errors[delivery.error_code] ?? "Delivery needs attention."}</p> : null}</td><td>{delivery.state === "failed" && !delivery.is_test ? <form action={retryNotificationWebhook}><input type="hidden" name="deliveryId" value={delivery.id}/><button className="button compact" type="submit">Retry notification</button></form> : "—"}</td></tr>) : <tr><td colSpan={6} className="table-empty">No delivery attempts yet.</td></tr>}
      </tbody></ResponsiveTable></div>
    </section>
  </></LocalizedContent>;
}
