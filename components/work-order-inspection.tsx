import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/status-pill";
import { InspectionCheckLabel } from "@/components/inspection-check-matrix";

export async function WorkOrderInspection({ orderId, organizationId }: { orderId: string; organizationId: string }) {
  const supabase = await createClient();
  const [inspections, choices] = await Promise.all([
    supabase.from("inspections").select("id, status, started_at").eq("organization_id", organizationId).eq("repair_order_id", orderId).order("created_at", { ascending: false }),
    supabase.from("work_order_service_choices").select("id, inspection_id, service_code, description_en, description_ar, note").eq("organization_id", organizationId).eq("repair_order_id", orderId).order("created_at"),
  ]);
  if (inspections.error || choices.error) return <section className="panel panel-body" role="alert">The order inspection could not be loaded.</section>;
  const latest = inspections.data?.[0];
  return <section className="panel">
    <div className="panel-header"><div><div className="panel-title">Inspection & required services</div><div className="panel-subtitle">Validate the reported issues, then select the required services.</div></div>
      <Link className="button primary" href={latest ? `/inspections?inspection=${latest.id}#inspection-workspace` : `/inspections?order=${orderId}#new-inspection`}>{latest?.status === "completed" ? "Select services" : latest ? "Continue inspection" : "Assign inspection"}</Link>
    </div>
    <div className="panel-body stack">
      {latest ? <StatusPill label={latest.status} tone={latest.status === "completed" ? "green" : "blue"} /> : <p className="field-help">{"Assign a checklist to validate this order's reported issues."}</p>}
      {choices.data?.length ? <div className="order-item-list">{choices.data.map(choice => <article className="simple-service-row" key={choice.id}><div className="simple-service-name"><bdi dir="ltr">{choice.service_code}</bdi><strong><InspectionCheckLabel labelEn={choice.description_en} labelAr={choice.description_ar ?? undefined} /></strong>{choice.note ? <span>{choice.note}</span> : null}</div><Link className="button compact" href={`/inspections?inspection=${choice.inspection_id}#inspection-workspace`}>Inspection evidence</Link></article>)}</div> : <p className="field-help">No services selected by the technician yet.</p>}
    </div>
  </section>;
}
