import Link from "next/link";
import { ClipboardCheck, Plus, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty-state";
import { InspectionCatalog, InspectionWorkflow } from "@/components/inspection-workflow";
import { InspectionCheckLabel } from "@/components/inspection-check-matrix";
import { getCurrentStaff } from "@/lib/auth/session";
import type { InspectionWorkspace } from "@/lib/inspection-workflow";
import { createClient } from "@/lib/supabase/server";
import { createInspection, saveInspectionWorkflow } from "./actions";

type Query = { new?: string; order?: string; inspection?: string; setup?: string; created?: string; error?: string };
export default async function InspectionsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: orders }, { data: inspections, error }, { data: models }] = await Promise.all([
    supabase.from("repair_orders").select("id, ro_number, branch_id, status, customer:customers(display_name), vehicle:vehicles(registration_no, model:vehicle_models(name))").eq("organization_id", staff.organizationId).not("status", "in", '("delivered","closed","cancelled")').order("opened_at", { ascending: false }),
    supabase.from("inspections").select("id, branch_id, repair_order_id, status, started_at, repair_order:repair_orders(ro_number, risk_state, customer:customers(display_name), branch:branches(city), vehicle:vehicles(vin, registration_no, model:vehicle_models(name))), inspection_items(id, sequence, result, measurement_json, finding_text)").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }),
    supabase.from("vehicle_models").select("id, name, model_code, market").or(`organization_id.is.null,organization_id.eq.${staff.organizationId}`).order("name"),
  ]);
  const visible = (inspections ?? []).filter(i => !staff.selectedBranchId || i.branch_id === staff.selectedBranchId);
  const activeOrders = new Set((inspections ?? []).filter(i => ["draft", "in_progress"].includes(i.status)).map(i => i.repair_order_id));
  const eligible = (orders ?? []).filter(o => !activeOrders.has(o.id) && (!staff.selectedBranchId || o.branch_id === staff.selectedBranchId));
  const selected = visible.find(i => i.id === query.inspection) ?? visible.find(i => i.repair_order_id === query.order && i.status === "in_progress");
  const { data: payload, error: workspaceError } = selected || (staff.role === "admin" && query.setup === "1")
    ? await supabase.rpc("inspection_workspace", { p_organization_id: staff.organizationId, ...(selected ? { p_inspection_id: selected.id } : {}) })
    : { data: null, error: null };
  const workspace = payload as unknown as InspectionWorkspace | null;
  // The catalog view always loads the full library, not one vehicle's filtered recommendations.
  const { data: catalogPayload } = staff.role === "admin" && query.setup === "1" && selected
    ? await supabase.rpc("inspection_workspace", { p_organization_id: staff.organizationId }) : { data: payload };
  const catalog = catalogPayload as unknown as InspectionWorkspace | null;
  const resultIds = new Set(workspace?.tasks.flatMap(task => task.attempts.map(a => a.inspection_item_id)) ?? []);
  const legacy = selected?.inspection_items.filter(item => !resultIds.has(item.id)) ?? [];
  return <>
    <PageHeader eyebrow="Vehicle condition" title="Digital inspections" description="Assign the vehicle, select applicable checks, record each result and review recommendations.">
      {staff.role === "admin" ? <Link className="button" href="/inspections?setup=1#check-catalog"><Settings2 />Check catalog</Link> : null}
      {eligible.length ? <Link className="button primary" href="/inspections?new=1#new-inspection"><Plus />Start inspection</Link> : null}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error || workspaceError ? "Inspection records could not be loaded." : undefined)} />
    {staff.role === "admin" && query.setup === "1" && catalog ? <InspectionCatalog checks={catalog.catalog} models={models ?? []} saveAction={saveInspectionWorkflow} /> : null}
    {(query.new === "1" || (query.order && !selected)) && eligible.length ? <section className="panel operation-form" id="new-inspection">
      <div className="panel-header"><div><div className="panel-title">Start vehicle inspection</div><div className="panel-subtitle">One active inspection is allowed per work order.</div></div><Link className="panel-link" href="/inspections">Cancel</Link></div>
      <form action={createInspection} className="form-grid panel-body"><div className="form-field form-span-2"><label htmlFor="inspection-order">Repair order</label><select id="inspection-order" name="repairOrderId" defaultValue={query.order ?? ""} required><option value="">Select repair order</option>{eligible.map(o => <option key={o.id} value={o.id}>{o.ro_number} · {o.vehicle?.model?.name} · {o.vehicle?.registration_no} · {o.customer?.display_name}</option>)}</select></div><div className="form-actions form-span-2"><button className="button primary">Start inspection</button></div></form>
    </section> : null}
    {selected && workspace?.inspection ? <section className="panel inspection-workspace" id="inspection-workspace">
      <div className="panel-header"><div><div className="panel-title">{selected.repair_order?.vehicle?.model?.name} · <bdi>{selected.repair_order?.vehicle?.registration_no}</bdi></div><div className="panel-subtitle">{selected.repair_order?.ro_number} · {selected.repair_order?.customer?.display_name} · {selected.repair_order?.branch?.city}</div></div><StatusPill label={selected.status} tone={selected.status === "completed" ? "green" : "blue"} />{selected.repair_order?.risk_state !== "normal" ? <StatusPill label={selected.repair_order?.risk_state ?? "restricted"} tone="red" /> : null}</div>
      <InspectionWorkflow key={selected.id} data={workspace} saveAction={saveInspectionWorkflow} />
      {legacy.length ? <details className="iw-section"><summary>Earlier condition records</summary><p>Existing evidence is retained separately from the generated checklist.</p>{legacy.sort((a, b) => a.sequence - b.sequence).map(item => { const meta = item.measurement_json as { check?: string; check_ar?: string }; return <article className="iw-task" key={item.id}><strong><InspectionCheckLabel labelEn={meta?.check ?? "Inspection check"} labelAr={meta?.check_ar} /></strong><StatusPill label={item.result ?? "pending"} tone={item.result === "fail" ? "red" : "gray"} />{item.finding_text ? <p>{item.finding_text}</p> : null}</article>; })}</details> : null}
      {selected.status === "completed" ? <div className="iw-section"><Link className="button" href={`/estimates?new=1&order=${selected.repair_order_id}#new-estimate`}>Create estimate</Link></div> : null}
    </section> : null}
    {!visible.length ? <EmptyState icon={ClipboardCheck} title="No inspections yet" description="Start an inspection from an active repair order and record each vehicle condition check." action={<Link className="button" href={eligible.length ? "/inspections?new=1#new-inspection" : "/work-orders?new=1#new-work-order"}>{eligible.length ? "Start inspection" : "Open work order"}</Link>} /> : <section className="panel inspection-ledger"><div className="panel-header"><div className="panel-title">Inspection ledger</div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Repair order</th><th>Customer & vehicle</th><th>Branch</th><th>Status</th><th></th></tr></thead><tbody>{visible.map(i => <tr key={i.id}><td className="mono">{i.repair_order?.ro_number}</td><td><div className="cell-main">{i.repair_order?.vehicle?.model?.name} · <bdi>{i.repair_order?.vehicle?.registration_no ?? i.repair_order?.vehicle?.vin}</bdi></div><div className="cell-sub">{i.repair_order?.customer?.display_name}</div></td><td>{i.repair_order?.branch?.city}</td><td><StatusPill label={i.status} tone={i.status === "completed" ? "green" : "blue"} /></td><td><Link className="button compact" href={`/inspections?inspection=${i.id}#inspection-workspace`}>Open</Link></td></tr>)}</tbody></table></div></section>}
  </>;
}
