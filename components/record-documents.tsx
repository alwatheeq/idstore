import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JourneyDate } from "@/components/journey-date";
import { StatusPill } from "@/components/status-pill";

type Scope = { type: "customer" | "vehicle"; id: string };
/** Only exact typed record bindings are used; a customer's past vehicle ownership
 * does not grant that customer's view access to a later owner's visit documents. */
export async function RecordDocuments({ organizationId, scope }: { organizationId: string; scope: Scope }) {
  const db = await createClient();
  const { data: orders, error: orderError } = await db.from("repair_orders")
    .select("id, inspections(id), invoices(id), diagnostic_sessions(id)").eq("organization_id", organizationId)
    .eq(scope.type === "customer" ? "customer_id" : "vehicle_id", scope.id);
  if (orderError) return <p role="alert">Documents could not be loaded.</p>;
  const { data: batteryReports, error: batteryError } = scope.type === "vehicle" ? await db.from("battery_health_reports")
    .select("id").eq("organization_id", organizationId).eq("vehicle_id", scope.id) : { data: [], error: null };
  if (batteryError) return <p role="alert">Documents could not be loaded.</p>;
  const targets = [
    { type: "repair_order", ids: (orders ?? []).map(o => o.id) },
    { type: "inspection", ids: (orders ?? []).flatMap(o => o.inspections.map(i => i.id)) },
    { type: "invoice", ids: (orders ?? []).flatMap(o => o.invoices.map(i => i.id)) },
    { type: "diagnostic_session", ids: (orders ?? []).flatMap(o => (o.diagnostic_sessions ?? []).map(i => i.id)) },
    { type: "battery_health_report", ids: (batteryReports ?? []).map(r => r.id) },
    ...(scope.type === "vehicle" ? [{ type: "vehicle", ids: [scope.id] }] : []),
  ];
  // Batches bound URL length, and every query remains tenant-, type- and ID-scoped.
  const requests = targets.flatMap(target => {
    const batches = [];
    for (let offset = 0; offset < target.ids.length; offset += 50) batches.push(db.from("attachments")
      .select("id, bucket, object_path, mime_type, size_bytes, classification, linked_type, linked_id, created_at")
      .eq("organization_id", organizationId).eq("linked_type", target.type).in("linked_id", target.ids.slice(offset, offset + 50)).order("created_at", { ascending: false }));
    return batches;
  });
  const results = await Promise.all(requests);
  if (results.some(result => result.error)) return <p role="alert">Documents could not be loaded.</p>;
  const files = results.flatMap(result => result.data ?? []).sort((a,b) => b.created_at.localeCompare(a.created_at));
  const signed = await Promise.all(files.map(async file => {
    const { data } = await db.storage.from(file.bucket).createSignedUrl(file.object_path, 600);
    return { ...file, url: data?.signedUrl };
  }));
  return <div className="journey-history">
    <p className="field-help">Private documents from this record and its service visits. Download links expire after ten minutes.</p>
    {scope.type === "vehicle" ? <Link className="button" href={`/records?vehicle=${scope.id}#record-upload`}>Upload document</Link> : <p className="field-help">For registration documents, open the relevant vehicle and choose Documents.</p>}
    {signed.length ? <div className="document-grid">{signed.map(file => <article className="document-card" key={file.id}>
      <strong dir="auto">{file.object_path.split("/").at(-1)?.replace(/^[0-9a-f-]{36}-/i, "") ?? file.mime_type}</strong>
      <div><StatusPill label={file.classification} tone="gray"/><span>{file.linked_type.replaceAll("_", " ")}</span></div>
      <div><JourneyDate value={file.created_at}/><span dir="ltr">{Math.ceil(file.size_bytes / 1024)} <span>kilobytes</span></span></div>
      {file.url ? <a className="button compact" href={file.url} target="_blank" rel="noreferrer">Open</a> : <span>Unavailable</span>}
    </article>)}</div> : <p>No linked documents yet.</p>}
  </div>;
}
