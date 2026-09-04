import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, ListChecks, Plus, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { addInspectionItem, completeInspection, createInspection, removeInspectionItem } from "./actions";

type PageQuery = { new?: string; order?: string; inspection?: string; created?: string; error?: string };
type PillTone = "blue" | "green" | "amber" | "red" | "gray";

const dateTime = new Intl.DateTimeFormat("en-JO", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });

function tone(value: string): PillTone {
  if (["completed", "pass", "green", "resolved"].includes(value)) return "green";
  if (["warn", "amber", "in_progress", "estimated"].includes(value)) return "amber";
  if (["fail", "red", "safety_stop", "quarantine"].includes(value)) return "red";
  if (["cancelled", "not_applicable"].includes(value)) return "gray";
  return "blue";
}

function itemMeta(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { check: "Inspection check", measurement: undefined };
  return {
    check: typeof value.check === "string" ? value.check : "Inspection check",
    measurement: typeof value.measurement === "string" ? value.measurement : undefined,
  };
}

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: orders }, { data: inspections, error }] = await Promise.all([
    supabase.from("repair_orders").select("id, ro_number, status, risk_state, branch:branches(code, city), customer:customers(display_name), vehicle:vehicles(vin, registration_no, model:vehicle_models(name))").eq("organization_id", staff.organizationId).not("status", "in", '("delivered","closed","cancelled")').order("opened_at", { ascending: false }),
    supabase.from("inspections").select("id, repair_order_id, status, started_at, completed_at, created_at, repair_order:repair_orders(ro_number, status, risk_state, branch:branches(code, city), customer:customers(display_name), vehicle:vehicles(vin, registration_no, model:vehicle_models(name))), inspection_items(id, sequence, result, measurement_json, finding_text, customer_text, findings(id, severity, status))").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }),
  ]);
  const activeOrderIds = new Set((inspections ?? []).filter((inspection) => ["draft", "in_progress"].includes(inspection.status)).map((inspection) => inspection.repair_order_id));
  const eligibleOrders = (orders ?? []).filter((order) => !activeOrderIds.has(order.id));
  const requestedOrderInspection = inspections?.find((inspection) => inspection.repair_order_id === query.order && ["draft", "in_progress"].includes(inspection.status));
  const selected = inspections?.find((inspection) => inspection.id === query.inspection) ?? requestedOrderInspection;
  const selectedOrder = eligibleOrders.find((order) => order.id === query.order);
  const showNewForm = (query.new === "1" || Boolean(query.order && !requestedOrderInspection)) && eligibleOrders.length > 0;
  const active = (inspections ?? []).filter((inspection) => inspection.status === "in_progress");
  const completed = (inspections ?? []).filter((inspection) => inspection.status === "completed");
  const allFindings = (inspections ?? []).flatMap((inspection) => inspection.inspection_items.flatMap((item) => item.findings));
  const openFindings = allFindings.filter((finding) => ["open", "estimated"].includes(finding.status));
  const safetyStops = openFindings.filter((finding) => finding.severity === "safety_stop");

  return <>
    <PageHeader eyebrow="Vehicle condition" title="Digital inspections" description="Record evidence-led checks, escalate safety findings and hand approved work into an estimate.">
      {eligibleOrders.length ? <Link className="button primary" href="/inspections?new=1#new-inspection"><Plus /> Start inspection</Link> : null}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Inspection records could not be loaded." : undefined)} />

    {showNewForm ? <section className="panel operation-form" id="new-inspection">
      <div className="panel-header"><div><div className="panel-title">Start vehicle inspection</div><div className="panel-subtitle">One active inspection is allowed per work order.</div></div><Link className="panel-link" href="/inspections">Cancel</Link></div>
      <form action={createInspection} className="form-grid panel-body"><div className="form-field form-span-2"><label htmlFor="inspection-order">Repair order</label><select id="inspection-order" name="repairOrderId" defaultValue={selectedOrder?.id ?? ""} required><option value="">Select repair order</option>{eligibleOrders.map((order) => <option key={order.id} value={order.id}>{order.ro_number} · {order.vehicle?.model?.name ?? "Volkswagen ID"} {order.vehicle?.registration_no ?? ""} · {order.customer?.display_name} · {order.branch?.city}</option>)}</select></div><div className="form-actions form-span-2"><Link className="button" href="/inspections">Cancel</Link><button className="button primary" type="submit">Start inspection</button></div></form>
    </section> : null}

    <MetricStrip metrics={[
      { label: "Active inspections", value: String(active.length), note: "Checks still editable", noteTone: active.length ? "warn" : "good", icon: ListChecks },
      { label: "Completed", value: String(completed.length), note: "Locked inspection records", icon: CheckCircle2 },
      { label: "Open findings", value: String(openFindings.length), note: `${allFindings.length} total findings`, noteTone: openFindings.length ? "warn" : "good", icon: AlertTriangle },
      { label: "Safety stops", value: String(safetyStops.length), note: "Vehicle quarantine required", noteTone: safetyStops.length ? "warn" : "good", icon: ShieldAlert },
    ]} />

    {selected ? <section className="inspection-workspace" id="inspection-workspace">
      <div className="inspection-context">
        <div><span className="inspection-kicker">{selected.repair_order?.branch?.city} · {selected.repair_order?.ro_number}</span><h2>{selected.repair_order?.vehicle?.model?.name ?? "Volkswagen ID"} <small>{selected.repair_order?.vehicle?.registration_no ?? selected.repair_order?.vehicle?.vin}</small></h2><p>{selected.repair_order?.customer?.display_name} · Started {selected.started_at ? dateTime.format(new Date(selected.started_at)) : "not started"}</p></div>
        <div className="inspection-context-state"><StatusPill label={selected.status} tone={tone(selected.status)} />{selected.repair_order?.risk_state !== "normal" ? <StatusPill label={selected.repair_order?.risk_state ?? "restricted"} tone="red" /> : null}</div>
      </div>

      <div className="inspection-path" aria-label="Inspection workflow"><span className="complete">Vehicle</span><span className={selected.inspection_items.length ? "complete" : "current"}>Checks</span><span className={selected.inspection_items.some((item) => item.findings.length) ? "attention" : ""}>Findings</span><span className={selected.status === "completed" ? "complete" : ""}>Locked record</span></div>

      {selected.status === "in_progress" ? <section className="panel operation-form inspection-entry">
        <div className="panel-header"><div><div className="panel-title">Add condition check</div><div className="panel-subtitle">Warning and failed checks require a finding; safety stops quarantine the repair order.</div></div></div>
        <form action={addInspectionItem} className="form-grid panel-body"><input type="hidden" name="inspectionId" value={selected.id} />
          <div className="form-field"><label htmlFor="check-label">Area or check</label><input id="check-label" name="checkLabel" placeholder="High-voltage battery enclosure" required /></div>
          <div className="form-field"><label htmlFor="check-result">Result</label><select id="check-result" name="result" defaultValue="pass"><option value="pass">Pass</option><option value="warn">Warning</option><option value="fail">Fail</option><option value="not_applicable">Not applicable</option></select></div>
          <div className="form-field"><label htmlFor="check-measurement">Measurement</label><input id="check-measurement" name="measurement" placeholder="e.g. 4.2 mm or 94%" /></div>
          <div className="form-field"><label htmlFor="check-severity">Finding severity</label><select id="check-severity" name="severity" defaultValue="amber"><option value="amber">Amber — advise</option><option value="red">Red — repair required</option><option value="safety_stop">Safety stop — quarantine</option></select></div>
          <div className="form-field form-span-2"><label htmlFor="finding-text">Technical finding</label><input id="finding-text" name="findingText" placeholder="Required for warning and failed checks" /></div>
          <div className="form-field form-span-2"><label htmlFor="customer-text">Customer explanation</label><textarea id="customer-text" name="customerText" rows={2} placeholder="Plain-language explanation for the estimate" /></div>
          <div className="form-actions form-span-2"><button className="button primary" type="submit">Save check</button></div>
        </form>
      </section> : null}

      <section className="panel inspection-sheet"><div className="panel-header"><div><div className="panel-title">Condition record</div><div className="panel-subtitle">{selected.inspection_items.length} completed check{selected.inspection_items.length === 1 ? "" : "s"}</div></div>{selected.status === "in_progress" ? <form action={completeInspection}><input type="hidden" name="inspectionId" value={selected.id} /><button className="button dark" type="submit"><ClipboardCheck /> Complete and lock</button></form> : <Link className="button" href={`/estimates?new=1&order=${selected.repair_order_id}#new-estimate`}>Create estimate</Link>}</div>
        {selected.inspection_items.length ? <div className="condition-list">{selected.inspection_items.sort((a, b) => a.sequence - b.sequence).map((item) => { const meta = itemMeta(item.measurement_json); const finding = item.findings[0]; return <article className={`condition-row condition-${item.result ?? "pending"}`} key={item.id}><span className="condition-sequence mono">{String(item.sequence).padStart(2, "0")}</span><div><strong>{meta.check}</strong><span>{meta.measurement ?? item.customer_text ?? "No measurement recorded"}</span>{item.finding_text ? <p>{item.finding_text}</p> : null}</div><div className="condition-status"><StatusPill label={item.result ?? "pending"} tone={tone(item.result ?? "pending")} />{finding ? <StatusPill label={finding.severity} tone={tone(finding.severity)} /> : null}</div>{selected.status === "in_progress" ? <form action={removeInspectionItem}><input type="hidden" name="inspectionId" value={selected.id} /><input type="hidden" name="inspectionItemId" value={item.id} /><button className="button compact" type="submit">Remove</button></form> : null}</article>; })}</div> : <div className="table-empty">No checks recorded. Add the first condition result above.</div>}
      </section>
    </section> : null}

    {!inspections?.length ? <EmptyState icon={ClipboardCheck} title="No inspections yet" description={orders?.length ? "Start an inspection from an active repair order and record each vehicle condition check." : "Open a repair order before beginning a vehicle inspection."} action={eligibleOrders.length ? <Link className="button primary" href="/inspections?new=1#new-inspection">Start first inspection</Link> : <Link className="button" href="/work-orders?new=1#new-work-order">Open work order</Link>} /> : <section className="panel inspection-ledger"><div className="panel-header"><div><div className="panel-title">Inspection ledger</div><div className="panel-subtitle">Active and completed vehicle condition records</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Repair order</th><th>Customer & vehicle</th><th>Branch</th><th>Checks</th><th>Findings</th><th>Status</th><th></th></tr></thead><tbody>{inspections.map((inspection) => { const findings = inspection.inspection_items.flatMap((item) => item.findings); return <tr key={inspection.id}><td><div className="cell-main mono">{inspection.repair_order?.ro_number}</div><div className="cell-sub">{inspection.started_at ? dateTime.format(new Date(inspection.started_at)) : "Not started"}</div></td><td><div className="cell-main">{inspection.repair_order?.vehicle?.model?.name ?? "Volkswagen ID"} · {inspection.repair_order?.vehicle?.registration_no ?? inspection.repair_order?.vehicle?.vin}</div><div className="cell-sub">{inspection.repair_order?.customer?.display_name}</div></td><td>{inspection.repair_order?.branch?.city}</td><td className="mono">{inspection.inspection_items.length}</td><td><StatusPill label={`${findings.length} finding${findings.length === 1 ? "" : "s"}`} tone={findings.some((finding) => ["red", "safety_stop"].includes(finding.severity)) ? "red" : findings.length ? "amber" : "green"} /></td><td><StatusPill label={inspection.status} tone={tone(inspection.status)} /></td><td><Link className="button compact" href={`/inspections?inspection=${inspection.id}#inspection-workspace`}>Open</Link></td></tr>; })}</tbody></table></div></section>}
  </>;
}
