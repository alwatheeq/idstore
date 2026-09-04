import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { SearchFilters } from "@/components/search-filters";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createWorkOrder } from "./actions";

type PageQuery = { new?: string; created?: string; error?: string };
type PillTone = "blue" | "green" | "amber" | "red" | "gray";

const progressByStatus: Record<string, number> = {
  draft: 3, checked_in: 8, diagnosis: 18, awaiting_approval: 32, approved: 42,
  in_progress: 64, qc: 86, ready: 96, delivered: 100, closed: 100,
  cancelled: 100, on_hold: 48,
};

function statusTone(status: string): PillTone {
  if (["ready", "delivered", "closed"].includes(status)) return "green";
  if (["awaiting_approval", "qc", "on_hold"].includes(status)) return "amber";
  if (status === "cancelled") return "gray";
  return "blue";
}

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: branches }, { data: customers }, { data: vehicles }, { data: workOrders, error }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("customers").select("id, display_name").eq("organization_id", staff.organizationId).eq("status", "active").order("display_name"),
    supabase.from("vehicles").select("id, vin, registration_no, model:vehicle_models(name), vehicle_ownerships(customer:customers(display_name))").eq("organization_id", staff.organizationId).eq("status", "active").order("registration_no"),
    supabase
      .from("repair_orders")
      .select("id, ro_number, status, risk_state, odometer_km, state_of_charge, customer_concern, opened_at, promised_at, customer:customers(display_name), vehicle:vehicles(registration_no, model:vehicle_models(name)), branch:branches(display_name, city)")
      .eq("organization_id", staff.organizationId)
      .order("opened_at", { ascending: false }),
  ]);

  const setupReady = Boolean(branches?.length && customers?.length && vehicles?.length);
  const showForm = query.new === "1" || Boolean(query.error);

  return <>
    <PageHeader eyebrow="Workshop" title="Work orders" description="Control every job from reception and diagnosis through approval, repair, quality control and handover.">
      {setupReady ? <Link className="button primary" href="/work-orders?new=1#new-work-order"><Plus /> New work order</Link> : <Link className="button primary" href={branches?.length ? customers?.length ? "/vehicles?new=1#new-vehicle" : "/customers?new=1#new-customer" : "/branches?new=1#new-branch"}><Plus /> Complete setup</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Work orders could not be loaded." : undefined)} />

    {showForm && setupReady ? <section className="panel operation-form" id="new-work-order">
      <div className="panel-header"><div><div className="panel-title">Open a work order</div><div className="panel-subtitle">Allocates the next branch repair-order number and records vehicle intake.</div></div><Link className="panel-link" href="/work-orders">Cancel</Link></div>
      <form action={createWorkOrder} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="work-branch">Branch</label><select id="work-branch" name="branchId" required><option value="">Select branch</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="work-customer">Customer</label><select id="work-customer" name="customerId" required><option value="">Select customer</option>{customers?.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}</option>)}</select></div>
        <div className="form-field form-span-2"><label htmlFor="work-vehicle">Vehicle</label><select id="work-vehicle" name="vehicleId" required><option value="">Select vehicle</option>{vehicles?.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.model?.name ?? "Volkswagen ID"} · {vehicle.registration_no ?? vehicle.vin} · {vehicle.vehicle_ownerships[0]?.customer?.display_name ?? "No owner"}</option>)}</select></div>
        <div className="form-field"><label htmlFor="work-odometer">Odometer (km)</label><input id="work-odometer" name="odometerKm" type="number" min="0" step="1" /></div>
        <div className="form-field"><label htmlFor="work-charge">State of charge (%)</label><input id="work-charge" name="stateOfCharge" type="number" min="0" max="100" step="0.1" /></div>
        <div className="form-field"><label htmlFor="work-promise">Promised handover</label><input id="work-promise" name="promisedAt" type="datetime-local" /></div>
        <div className="form-field form-span-2"><label htmlFor="work-concern">Customer concern</label><textarea id="work-concern" name="customerConcern" rows={3} placeholder="Describe symptoms in the customer's words." /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/work-orders">Cancel</Link><button className="button primary" type="submit">Open work order</button></div>
      </form>
    </section> : null}

    {!workOrders?.length ? <EmptyState icon={ClipboardList} title="No work orders open" description={setupReady ? "Open the first work order when a vehicle arrives for service." : "A branch, customer and registered vehicle are required first."} action={setupReady ? <Link className="button primary" href="/work-orders?new=1#new-work-order">Open first work order</Link> : undefined} /> : <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search RO, customer, VIN or registration…" filters={["All statuses", "All branches", "All risk levels"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Order</th><th>Customer & vehicle</th><th>Branch</th><th>Status</th><th>Promise</th><th>Risk</th><th>Progress</th></tr></thead><tbody>{workOrders.map((order) => {
      const progress = progressByStatus[order.status] ?? 0;
      return <tr key={order.id}><td><div className="cell-main mono">{order.ro_number}</div><div className="cell-sub">Opened {new Date(order.opened_at).toLocaleDateString("en-JO")}</div></td><td><div className="cell-main">{order.vehicle?.model?.name ?? "Volkswagen ID"} · {order.vehicle?.registration_no ?? "No registration"}</div><div className="cell-sub">{order.customer?.display_name ?? "Unknown customer"}</div></td><td>{order.branch?.city ?? order.branch?.display_name ?? "—"}</td><td><StatusPill label={order.status} tone={statusTone(order.status)} /></td><td className="mono nowrap">{order.promised_at ? new Date(order.promised_at).toLocaleString("en-JO", { dateStyle: "medium", timeStyle: "short" }) : "Not set"}</td><td><StatusPill label={order.risk_state} tone={order.risk_state === "quarantine" || order.risk_state === "emergency_escalation" ? "red" : order.risk_state === "restricted" ? "amber" : "gray"} /></td><td style={{ minWidth: 120 }}><div className="cell-sub mono">{progress}%</div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div></td></tr>;
    })}</tbody></table></div></section>}
  </>;
}
