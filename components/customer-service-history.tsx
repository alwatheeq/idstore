import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerConcernText } from "@/components/customer-concern-text";
import { StatusPill } from "@/components/status-pill";
import { JourneyDate } from "@/components/journey-date";

type HistoryScope = { customerId: string; vehicleId?: never } | { vehicleId: string; customerId?: never };
/** Explicit customer OR vehicle scope, always behind organization and RLS filters. */
export async function CustomerServiceHistory({ organizationId, customerId, vehicleId, view = "all" }: { organizationId: string; view?: "all" | "quotes" | "invoices" } & HistoryScope) {
  const supabase = await createClient();
  const { data: visits, error } = await supabase.from("repair_orders")
    .select("id, ro_number, status, opened_at, odometer_km, customer_concern, branch:branches(city, code), vehicle:vehicles(id, vin, registration_no, model:vehicle_models(name)), estimate_versions(id, version_no, status, currency, grand_total), invoices(id, invoice_number, status, currency, grand_total, paid_total, payment_allocations(amount, payment:payments(id, receipt_number, status, method, received_at)))")
    .eq("organization_id", organizationId).eq(customerId ? "customer_id" : "vehicle_id", customerId ?? vehicleId!).order("opened_at", { ascending: false });
  if (error) return <p role="alert">Service history could not be loaded. Please try again.</p>;
  if (!visits?.length) return <p className="customer-ledger-empty">No service visits recorded for this record.</p>;
  const money = (amount: number, currency: string) => new Intl.NumberFormat("en-JO", { style: "currency", currency }).format(amount);
  const balances = new Map<string, number>();
  for (const visit of visits) for (const invoice of visit.invoices) {
    if (["posted", "partially_paid"].includes(invoice.status)) balances.set(invoice.currency,
      (balances.get(invoice.currency) ?? 0) + Math.max(0, Number(invoice.grand_total) - Number(invoice.paid_total)));
  }
  const visibleVisits = visits.filter(visit => view === "quotes" ? visit.estimate_versions.length > 0 : view === "invoices" ? visit.invoices.length > 0 : true);
  return <div className="journey-history">
    <div className="journey-summary"><div><span>Service visits</span><strong dir="ltr">{visits.length}</strong></div><div><span>Last visit</span><strong><JourneyDate value={visits[0].opened_at}/></strong></div><div><span>Outstanding balance</span><strong dir="ltr">{balances.size ? [...balances].map(([currency, value]) => money(value, currency)).join(" / ") : "—"}</strong></div></div>
    <p className="field-help">Only records accessible to your account are shown. Payment amounts below are allocations to each invoice.</p>
    {!visibleVisits.length ? <p>No matching records yet.</p> : null}
    {visibleVisits.map(visit => <article className="journey-visit" key={visit.id}>
      <header><div><Link className="cell-main" dir="ltr" href={`/work-orders?order=${visit.id}#order-${visit.id}`}>{visit.ro_number}</Link><p><JourneyDate value={visit.opened_at}/> · {visit.branch?.city} · <span dir="ltr">{visit.odometer_km ?? "—"} km</span></p></div><StatusPill label={visit.status} tone="blue" /></header>
      {visit.vehicle ? <Link className="journey-vehicle" href={`/vehicles?manage=${visit.vehicle.id}&tab=service#vehicle-controls`}><bdi dir="ltr">{visit.vehicle.model?.name}</bdi><bdi dir="ltr">{visit.vehicle.registration_no ?? visit.vehicle.vin}</bdi></Link> : null}
      <p><CustomerConcernText value={visit.customer_concern} /></p>
      <nav className="journey-actions" aria-label="Visit records"><Link className="button compact" href={`/inspections?order=${visit.id}#inspection-workspace`}>Inspections</Link><Link className="button compact" href={`/estimates?order=${visit.id}`}>Estimates</Link></nav>
      {view !== "invoices" && visit.estimate_versions.length ? <section><h3>Quotations</h3><div className="journey-records">{[...visit.estimate_versions].sort((a,b) => b.version_no-a.version_no).map(estimate => <Link key={estimate.id} href={`/estimates?estimate=${estimate.id}#estimate-workspace`}><span>Version <bdi dir="ltr">{estimate.version_no}</bdi></span><StatusPill label={estimate.status} tone="gray"/><bdi dir="ltr">{money(Number(estimate.grand_total), estimate.currency)}</bdi></Link>)}</div></section> : null}
      {view !== "quotes" && visit.invoices.length ? <section><h3>Invoices & payments</h3>{visit.invoices.map(invoice => <div className="journey-invoice" key={invoice.id}>
        <Link href={`/invoices#invoice-${invoice.id}`}><strong dir="ltr">{invoice.invoice_number ?? "Draft"}</strong><StatusPill label={invoice.status} tone="gray"/><bdi dir="ltr">{money(Number(invoice.grand_total), invoice.currency)}</bdi></Link>
        {invoice.payment_allocations.map((allocation, index) => <div className="journey-payment" key={`${allocation.payment?.id}-${index}`}><span dir="ltr">{allocation.payment?.receipt_number ?? "—"}</span><StatusPill label={allocation.payment?.status ?? "unknown"} tone="gray"/>{allocation.payment?.received_at ? <JourneyDate value={allocation.payment.received_at}/> : "—"}<bdi dir="ltr">{money(Number(allocation.amount), invoice.currency)}</bdi></div>)}
      </div>)}</section> : null}
    </article>)}
  </div>;
}
