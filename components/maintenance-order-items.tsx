import { RecordAction } from "@/components/record-action";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { servicePrice } from "@/lib/service-catalog";
import { isMaintenanceTask } from "@/lib/maintenance-order";
import { OrderItemForm } from "@/components/order-item-form";
import { prepareOrderItems, removeOrderItem } from "@/app/(app)/work-orders/item-actions";
import { StatusPill } from "@/components/status-pill";

export async function MaintenanceOrderItems({ orderId, organizationId, status, branchLocked, orderType = "maintenance" }: {
  orderId: string; organizationId: string; status: string; branchLocked: boolean; orderType?: string;
}) {
  const supabase = await createClient();
  const { data: estimates, error } = await supabase.from("estimate_versions")
    .select("id, version_no, status, currency, subtotal, discount_total, tax_total, grand_total, estimate_lines(id, line_no, line_type, description_snapshot, quantity, unit_price, line_total)")
    .eq("organization_id", organizationId).eq("repair_order_id", orderId).order("version_no", { ascending: false }).limit(1);
  if (error) return <section className="panel panel-body" role="alert">Order items could not be loaded. Refresh and try again.</section>;
  // Older orders may have been invoiced directly, without an estimate.
  // Reuse that ledger rather than inventing a second price list.
  const { data: invoices, error: invoiceError } = !estimates?.length ? await supabase.from("invoices")
    .select("id, version, status, currency, subtotal, discount_total, tax_total, grand_total, invoice_lines(id, line_no, line_type, description_snapshot, quantity, unit_price, line_total)")
    .eq("organization_id", organizationId).eq("repair_order_id", orderId).order("created_at", { ascending: false }).limit(1) : { data: null, error: null };
  if (invoiceError) return <section className="panel panel-body" role="alert">Order items could not be loaded. Refresh and try again.</section>;
  const invoice = invoices?.[0];
  const estimate = estimates?.[0] ?? (invoice ? { ...invoice, estimate_lines: invoice.invoice_lines } : undefined);
  const closed = ["delivered", "closed", "cancelled"].includes(status);
  const editable = !closed && !branchLocked && estimate?.status === "draft";
  const recommendations = editable ? await supabase.from("work_order_service_choices").select("service_version_id, description_en, description_ar").eq("organization_id", organizationId).eq("repair_order_id", orderId) : { data: [], error: null };
  const selectedServiceIds = new Set(recommendations.data?.map(choice => choice.service_version_id) ?? []);
  const [{ data: services, error: serviceError }, { data: parts, error: partError }] = editable ? await Promise.all([
    selectedServiceIds.size ? supabase.from("service_template_versions").select("id, applicability_json, template:service_templates!inner(name_en, name_ar, work_order_type), service_template_tasks(result_schema)")
      .eq("template.work_order_type", orderType)
      .eq("organization_id", organizationId).in("status", ["published", "retired"]).in("id", [...selectedServiceIds]) : Promise.resolve({ data: [], error: null }),
    supabase.from("parts").select("id, part_number, description_en, description_ar, sale_price").eq("organization_id", organizationId).eq("status", "active").order("part_number"),
  ]) : [{ data: null, error: null }, { data: null, error: null }];
  const lines = [...(estimate?.estimate_lines ?? [])].sort((a, b) => a.line_no - b.line_no);
  const money = (value: number) => `${estimate?.currency ?? ""} ${value.toFixed(3)}`;
  return <section className="panel" id="order-items">
    <div className="panel-header"><div><div className="panel-title">Services & spare parts</div><div className="panel-subtitle">One order, with quantities, prices and a clear total.</div></div>{estimate ? <StatusPill label={estimate.status} tone={estimate.status === "draft" ? "gray" : "blue"} /> : null}</div>
    <div className="panel-body stack">
      {branchLocked ? <p className="field-help">{"Select this order's branch to make changes."}</p> : null}
      {!estimate ? <><p>No services or spare parts added yet.</p>{!closed && !branchLocked && ["checked_in", "diagnosis", "approved", "on_hold", "in_progress", "qc", "ready"].includes(status) ? <form action={prepareOrderItems}><input type="hidden" name="repairOrderId" value={orderId} /><button className="button primary" type="submit">Prepare order</button></form> : null}</> : <>
        {invoice ? <p className="field-help">These items use the existing invoice. Posted invoices cannot be changed here.</p> : !editable ? <p className="field-help">This price list is read-only. Manage approval or revisions in Estimates.</p> : null}
        {serviceError || partError || recommendations.error ? <p role="alert">The catalog could not be loaded. Refresh and try again.</p> : null}
        {(["labor", "part", "other"] as const).map(type => {
          const items = lines.filter(line => type === "other" ? !["labor", "part"].includes(line.line_type) : line.line_type === type);
          if (type === "other" && !items.length) return null;
          return <section className="order-items-section" key={type}>
            <h3>{type === "labor" ? "Services" : type === "part" ? "Spare parts" : "Other charges"}</h3>
            {items.length ? <div className="order-item-list">{items.map(line => <article className="order-item-row" key={line.id}>
              <strong className="order-item-description">{line.description_snapshot}</strong>
              <div><span className="field-label">Quantity</span><span dir="ltr">{line.quantity}</span></div>
              <div><span className="field-label">Unit price</span><span dir="ltr">{money(line.unit_price)}</span></div>
              <div><span className="field-label">Total</span><strong dir="ltr">{money(line.line_total)}</strong></div>
              {editable ? <form action={removeOrderItem}><input type="hidden" name="repairOrderId" value={orderId} /><input type="hidden" name="lineId" value={line.id} />{invoice ? <><input type="hidden" name="ledger" value="invoice" /><input type="hidden" name="version" value={invoice.version} /></> : null}<RecordAction kind="delete" label="Remove" type="submit" aria-label={`Remove ${line.description_snapshot}`} confirmation="Remove this record? Linked history will be preserved where required." /></form> : null}
            </article>)}</div> : <p className="field-help">{type === "labor" ? "No services added." : "No spare parts added."}</p>}
            {editable && type === "labor" && !selectedServiceIds.size ? <p className="field-help">Complete the inspection and select the required services first.</p> : null}
            {editable && type !== "other" && !(type === "labor" ? serviceError || recommendations.error || !selectedServiceIds.size : partError) ? <details className="order-add-item"><summary>{type === "labor" ? "Add service" : "Add part"}</summary>
              <OrderItemForm orderId={orderId} estimateId={estimate.id} invoiceVersion={invoice?.version} currency={estimate.currency} type={type} choices={type === "labor"
                ? (services ?? []).filter(service => selectedServiceIds.has(service.id) && service.template && service.service_template_tasks.every(task => isMaintenanceTask(task.result_schema))).map(service => { const snapshot = recommendations.data?.find(choice => choice.service_version_id === service.id); return { id: service.id, name: snapshot?.description_en ?? service.template!.name_en, nameAr: snapshot?.description_ar ?? service.template!.name_ar, price: estimate.currency === "JOD" ? servicePrice(service.applicability_json) : null }; })
                : (parts ?? []).map(part => ({ id: part.id, name: `${part.part_number} · ${part.description_en}`, nameAr: part.description_ar ? `${part.part_number} · ${part.description_ar}` : null, price: estimate.currency === "JOD" ? part.sale_price : null }))} />
            </details> : null}
          </section>;
        })}
        <dl className="order-price-summary">
          <div><dt>Subtotal</dt><dd dir="ltr">{money(estimate.subtotal)}</dd></div>
          {estimate.discount_total ? <div><dt>Discount</dt><dd dir="ltr">{money(estimate.discount_total)}</dd></div> : null}
          <div><dt>Tax</dt><dd dir="ltr">{money(estimate.tax_total)}</dd></div>
          <div className="order-grand-total"><dt>Total</dt><dd dir="ltr">{money(estimate.grand_total)}</dd></div>
        </dl>
        <p className="field-help">Adding a spare part prices it only. Stock is issued separately from inventory.</p>
        <div className="inline-actions"><Link className="button" href={invoice ? `/invoices?line=${invoice.id}#${invoice.status === "draft" ? "add-line" : `invoice-${invoice.id}`}` : `/estimates?estimate=${estimate.id}#estimate-workspace`}>Approval & billing</Link><Link className="button" href="/inventory">Inventory</Link></div>
      </>}
    </div>
  </section>;
}
