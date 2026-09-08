import { LocalizedContent } from "@/components/localized-content";
import Link from "next/link";
import { LabeledControl } from "@/components/labeled-control";
import { FileCheck2, LockKeyhole, MessageSquareText, Paperclip, Send, ShieldCheck } from "lucide-react";
import { BranchField } from "@/components/branch-field";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { queueCustomerMessage, uploadEvidence } from "./actions";

type PageQuery = { vehicle?: string; created?: string; error?: string };
const dateTime = new Intl.DateTimeFormat("en-JO", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });
const size = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

export default async function RecordsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  if (query.vehicle && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.vehicle)) return <LocalizedContent>{<RecordFeedback error="The selected vehicle is unavailable."/>}</LocalizedContent>;
  let vehicleQuery = supabase.from("vehicles").select("id, vin, registration_no, model:vehicle_models(name)").eq("organization_id", staff.organizationId);
  vehicleQuery = query.vehicle ? vehicleQuery.eq("id", query.vehicle) : vehicleQuery.eq("status", "active");
  let attachmentQuery = supabase.from("attachments").select("id, bucket, object_path, sha256, mime_type, size_bytes, classification, linked_type, linked_id, created_at, branch:branches(code, city)").eq("organization_id", staff.organizationId);
  if (query.vehicle) attachmentQuery = attachmentQuery.eq("linked_type", "vehicle").eq("linked_id", query.vehicle);
  const [{ data: branches }, { data: customers }, { data: vehicles }, { data: orders }, { data: inspections }, { data: invoices }, { data: attachments, error }, { data: messages }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("customers").select("id, display_name").eq("organization_id", staff.organizationId).eq("status", "active").order("display_name"),
    vehicleQuery.order("created_at", { ascending: false }).limit(100),
    supabase.from("repair_orders").select("id, ro_number, branch:branches(code), vehicle:vehicles(registration_no, vin)").eq("organization_id", staff.organizationId).order("opened_at", { ascending: false }).limit(100),
    supabase.from("inspections").select("id, repair_order:repair_orders(ro_number)").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("invoices").select("id, invoice_number, status").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }).limit(100),
    attachmentQuery.order("created_at", { ascending: false }).limit(50),
    supabase.from("messages").select("id, template_code, channel, dedupe_key, status, created_at, branch:branches(code, city), customer:customers(display_name)").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (query.vehicle && !vehicles?.some(v => v.id === query.vehicle)) return <LocalizedContent>{<RecordFeedback error="The selected vehicle is unavailable."/>}</LocalizedContent>;
  const secured = await Promise.all((attachments ?? []).map(async (item) => {
    const { data } = await supabase.storage.from(item.bucket).createSignedUrl(item.object_path, 600);
    return { ...item, signedUrl: data?.signedUrl };
  }));
  const targetGroups = [
    { type: "vehicle", label: "Vehicle", items: (vehicles ?? []).map((v) => ({ id: v.id, label: `${v.model?.name ?? "Volkswagen ID"} · ${v.registration_no ?? v.vin ?? "unregistered"}` })) },
    { type: "repair_order", label: "Repair order", items: (orders ?? []).map((o) => ({ id: o.id, label: `${o.ro_number} · ${o.vehicle?.registration_no ?? o.vehicle?.vin ?? "vehicle"}` })) },
    { type: "inspection", label: "Inspection", items: (inspections ?? []).map((i) => ({ id: i.id, label: `${i.repair_order?.ro_number ?? "Inspection"} · ${i.id.slice(0, 8)}` })) },
    { type: "invoice", label: "Invoice", items: (invoices ?? []).map((i) => ({ id: i.id, label: `${i.invoice_number ?? "Draft invoice"} · ${i.status}` })) },
  ].filter((group) => group.items.length && (!query.vehicle || group.type === "vehicle"));
  const queued = (messages ?? []).filter((message) => message.status === "queued").length;

  return <LocalizedContent>{<>
    <PageHeader eyebrow="Controlled records" title="Evidence & communications" description="Keep technical proof private, traceable and linked to the exact business record; queue customer notifications once for reliable provider delivery." />
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Controlled records could not be loaded." : undefined)} />
    {query.vehicle ? <div className="journey-context"><Link href={`/vehicles?manage=${query.vehicle}&tab=documents#vehicle-controls`}>Back to vehicle</Link><strong dir="ltr">{vehicles?.[0]?.model?.name} · {vehicles?.[0]?.registration_no ?? vehicles?.[0]?.vin}</strong></div> : null}
    {!query.vehicle ? <MetricStrip metrics={[
      { label: "Evidence objects", value: String(secured.length), note: "Private, signed access", icon: LockKeyhole },
      { label: "Restricted", value: String(secured.filter((item) => item.classification === "restricted").length), note: "Highest handling class", icon: ShieldCheck },
      { label: "Messages queued", value: String(queued), note: "Awaiting provider adapter", noteTone: queued ? "warn" : "good", icon: Send },
      { label: "Delivered", value: String((messages ?? []).filter((item) => item.status === "delivered").length), note: "Provider-confirmed", icon: MessageSquareText },
    ]} /> : null}

    {!query.vehicle ? <div className="records-grid">
      <section className="panel evidence-form"><div className="panel-header"><div><div className="panel-title">Evidence protocol</div><div className="panel-subtitle">Three controls are applied to every upload.</div></div><Paperclip /></div>
        <ol className="evidence-protocol"><li><b>1</b><div><strong>Private object</strong><span>No public bucket URLs.</span></div></li><li><b>2</b><div><strong>Record binding</strong><span>Tenant, branch and target verified in SQL.</span></div></li><li><b>3</b><div><strong>Integrity proof</strong><span>SHA-256 digest retained with metadata.</span></div></li></ol>
      </section>
      <section className="panel message-form"><div className="panel-header"><div><div className="panel-title">Queue customer message</div><div className="panel-subtitle">One message per stable business reference.</div></div><MessageSquareText /></div>
        <form action={queueCustomerMessage} className="form-grid panel-body"><div className="form-field"><label htmlFor="message-customer">Customer</label><select id="message-customer" name="customerId" required><option value="">Select customer</option>{customers?.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}</option>)}</select></div><BranchField id="message-branch" label="Branch" branches={branches} selectedBranchId={staff.selectedBranchId} /><div className="form-field"><label htmlFor="message-template">Template code</label><select id="message-template" name="templateCode" defaultValue="appointment_reminder"><option value="appointment_confirmation">Appointment confirmation</option><option value="appointment_reminder">Appointment reminder</option><option value="estimate_ready">Estimate ready</option><option value="vehicle_ready">Vehicle ready</option><option value="invoice_issued">Invoice issued</option><option value="service_follow_up">Service follow-up</option></select></div><div className="form-field"><label htmlFor="message-channel">Channel</label><select id="message-channel" name="channel" defaultValue="sms"><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="push">Push</option></select></div><div className="form-field form-span-2"><label htmlFor="message-reference">Business reference</label><input className="mono" id="message-reference" name="dedupeKey" placeholder="APPT-12345-REMINDER-1" required /><span className="field-hint">Retries with the same reference never create a duplicate message.</span></div><div className="form-actions form-span-2"><button className="button dark" type="submit"><Send /> Queue message</button></div></form>
      </section>
    </div> : null}

    {!secured.length ? <EmptyState icon={FileCheck2} title="No evidence registered" description="Use Attach on a vehicle, work order, inspection or invoice below." /> : <section className="panel"><div className="panel-header"><div><div className="panel-title">Evidence chain</div><div className="panel-subtitle">Signed links expire after ten minutes. The checksum remains permanent.</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Record</th><th>File</th><th>Scope</th><th>SHA-256</th><th>Class</th><th></th></tr></thead><tbody>{secured.map((item) => <tr key={item.id}><td><div className="cell-main">{item.linked_type.replaceAll("_", " ")}</div><div className="cell-sub mono">{item.linked_id.slice(0, 8)}</div></td><td><div className="cell-main">{item.mime_type}</div><div className="cell-sub">{size.format(item.size_bytes / 1024)} KB · {dateTime.format(new Date(item.created_at))}</div></td><td>{item.branch ? `${item.branch.city} · ${item.branch.code}` : "Organization"}</td><td><code className="checksum">{item.sha256}</code></td><td><StatusPill label={item.classification} tone={item.classification === "restricted" ? "red" : item.classification === "confidential" ? "amber" : "blue"} /></td><td>{item.signedUrl ? <a className="button compact" href={item.signedUrl} target="_blank" rel="noreferrer">Open</a> : "Unavailable"}</td></tr>)}</tbody></table></div></section>}

    {!query.vehicle ? <section className="panel"><div className="panel-header"><div><div className="panel-title">Communication ledger</div><div className="panel-subtitle">Provider delivery is asynchronous; no request is sent twice.</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Customer</th><th>Template</th><th>Channel</th><th>Branch</th><th>Reference</th><th>Status</th></tr></thead><tbody>{messages?.length ? messages.map((message) => <tr key={message.id}><td>{message.customer?.display_name}</td><td className="mono">{message.template_code}</td><td>{message.channel}</td><td>{message.branch ? `${message.branch.city} · ${message.branch.code}` : "Organization"}</td><td className="mono">{message.dedupe_key}</td><td><StatusPill label={message.status} tone={message.status === "delivered" ? "green" : message.status === "failed" ? "red" : "amber"} /></td></tr>) : <tr><td colSpan={6} className="table-empty">No messages queued.</td></tr>}</tbody></table></div></section> : null}

    <section className="panel" id="record-upload"><div className="panel-header"><div><div className="panel-title">Attach to an available record</div><div className="panel-subtitle">These compact upload forms bind type and identifier server-side.</div></div></div><div className="record-targets">{targetGroups.flatMap((group) => group.items.map((item) => <form action={uploadEvidence} className="record-target" key={`${group.type}:${item.id}`}><input type="hidden" name="linkedType" value={group.type} /><input type="hidden" name="linkedId" value={item.id} /><div><span>{group.label}</span><strong>{item.label}</strong></div><LabeledControl label="Classification"><select name="classification" defaultValue="confidential" aria-label="Classification"><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></LabeledControl><LabeledControl label="Evidence file"><input name="file" type="file" accept=".pdf,.json,.txt,.jpg,.jpeg,.png,.webp,.bin" aria-label="Evidence file" required /></LabeledControl><button className="button compact" type="submit">Attach</button></form>))}</div></section>
  </>}</LocalizedContent>;
}
