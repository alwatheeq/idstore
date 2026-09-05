import Link from "next/link";
import { CalendarDays, Clock3, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAppointment, transitionAppointment } from "./actions";

type PageQuery = { new?: string; created?: string; error?: string };
type PillTone = "blue" | "green" | "amber" | "red" | "gray";

const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" });
const appointmentDate = new Intl.DateTimeFormat("en-JO", { timeZone: "Asia/Amman", weekday: "short", day: "numeric", month: "short" });
const appointmentTime = new Intl.DateTimeFormat("en-JO", { timeZone: "Asia/Amman", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function statusTone(status: string): PillTone {
  if (["checked_in", "completed"].includes(status)) return "green";
  if (status === "requested") return "amber";
  if (["cancelled", "no_show"].includes(status)) return "gray";
  return "blue";
}

function nextActions(status: string) {
  if (status === "requested") return [{ value: "confirmed", label: "Confirm" }, { value: "cancelled", label: "Cancel" }];
  if (status === "confirmed") return [{ value: "checked_in", label: "Check in" }, { value: "no_show", label: "No show" }, { value: "cancelled", label: "Cancel" }];
  if (status === "checked_in") return [{ value: "completed", label: "Complete" }];
  return [];
}

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const now = new Date();
  const rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const rangeEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: branches }, { data: customers }, { data: vehicles }, { data: appointmentRows, error }] = await Promise.all([
    supabase.from("branches").select("id, code, city, timezone").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("customers").select("id, display_name").eq("organization_id", staff.organizationId).eq("status", "active").order("display_name"),
    supabase.from("vehicles").select("id, vin, registration_no, model:vehicle_models(name), vehicle_ownerships(customer:customers(display_name))").eq("organization_id", staff.organizationId).eq("status", "active").order("registration_no"),
    supabase
      .from("appointments")
      .select("id, branch_id, start_at, end_at, promised_at, status, channel, notes, version, branch:branches(display_name, city), customer:customers(display_name), vehicle:vehicles(registration_no, vin, model:vehicle_models(name))")
      .eq("organization_id", staff.organizationId)
      .gte("end_at", rangeStart)
      .lte("start_at", rangeEnd)
      .order("start_at"),
  ]);
  const appointments = staff.selectedBranchId ? (appointmentRows ?? []).filter((appointment) => appointment.branch_id === staff.selectedBranchId) : (appointmentRows ?? []);

  const todayKey = day.format(now);
  const todayAppointments = appointments.filter((appointment) => day.format(new Date(appointment.start_at)) === todayKey);
  const arrivals = todayAppointments.filter((appointment) => appointment.status === "confirmed" || appointment.status === "checked_in").length;
  const pending = appointments.filter((appointment) => appointment.status === "requested").length;
  const completed = todayAppointments.filter((appointment) => appointment.status === "completed").length;
  const historical = appointments.filter((appointment) => appointment.status === "completed" || appointment.status === "no_show");
  const noShows = historical.filter((appointment) => appointment.status === "no_show").length;
  const noShowRate = historical.length ? `${(noShows / historical.length * 100).toFixed(1)}%` : "—";
  const setupReady = Boolean(branches?.length && customers?.length && vehicles?.length);
  const showForm = (query.new === "1" || Boolean(query.error)) && setupReady;

  return <>
    <PageHeader eyebrow="Reception planning" title="Appointments" description="Schedule arrivals by branch and move each booking through confirmation, check-in and completion.">
      <Link className="button" href="/appointments">Today</Link>
      {setupReady ? <Link className="button primary" href="/appointments?new=1#new-appointment"><Plus /> New appointment</Link> : <Link className="button primary" href={branches?.length ? customers?.length ? "/vehicles?new=1#new-vehicle" : "/customers?new=1#new-customer" : "/branches?new=1#new-branch"}><Plus /> Complete setup</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Appointments could not be loaded." : undefined)} />

    {showForm ? <section className="panel operation-form" id="new-appointment">
      <div className="panel-header"><div><div className="panel-title">Schedule an appointment</div><div className="panel-subtitle">Times are interpreted in the selected branch’s time zone.</div></div><Link className="panel-link" href="/appointments">Cancel</Link></div>
      <form action={createAppointment} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="appointment-branch">Branch</label><select id="appointment-branch" name="branchId" defaultValue={staff.selectedBranchId ?? ""} required><option value="">Select branch</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="appointment-customer">Customer</label><select id="appointment-customer" name="customerId" required><option value="">Select customer</option>{customers?.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}</option>)}</select></div>
        <div className="form-field form-span-2"><label htmlFor="appointment-vehicle">Vehicle</label><select id="appointment-vehicle" name="vehicleId" required><option value="">Select vehicle</option>{vehicles?.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.model?.name ?? "Volkswagen ID"} · {vehicle.registration_no ?? vehicle.vin} · {vehicle.vehicle_ownerships[0]?.customer?.display_name ?? "No owner"}</option>)}</select></div>
        <div className="form-field"><label htmlFor="appointment-start">Starts</label><input id="appointment-start" name="startAt" type="datetime-local" required /></div>
        <div className="form-field"><label htmlFor="appointment-end">Ends</label><input id="appointment-end" name="endAt" type="datetime-local" required /></div>
        <div className="form-field"><label htmlFor="appointment-promise">Promised handover</label><input id="appointment-promise" name="promisedAt" type="datetime-local" /></div>
        <div className="form-field form-span-2"><label htmlFor="appointment-notes">Reception notes</label><textarea id="appointment-notes" name="notes" rows={3} placeholder="Requested service, symptoms or arrival instructions." /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/appointments">Cancel</Link><button className="button primary" type="submit">Schedule appointment</button></div>
      </form>
    </section> : null}

    <MetricStrip metrics={[
      { label: "Arrivals today", value: String(arrivals), note: `${todayAppointments.length} bookings today`, icon: CalendarDays },
      { label: "Pending requests", value: String(pending), note: "Awaiting confirmation", noteTone: pending ? "warn" : "good", icon: Clock3 },
      { label: "Completed today", value: String(completed), note: "Reception cycle complete", noteTone: "good", icon: CalendarDays },
      { label: "No-show rate", value: noShowRate, note: "Completed appointment history", noteTone: noShows ? "warn" : "good", icon: CalendarDays },
    ]} />

    {!appointments?.length ? <EmptyState icon={CalendarDays} title="No appointments scheduled" description={setupReady ? "Schedule the first customer arrival and confirm it from this queue." : "Create a branch, customer and vehicle before scheduling an appointment."} action={setupReady ? <Link className="button primary" href="/appointments?new=1#new-appointment">Schedule first appointment</Link> : undefined} /> : <section className="panel">
      <div className="panel-header"><div><div className="panel-title">Arrival ledger</div><div className="panel-subtitle">Recent and upcoming appointments · Asia/Amman display time</div></div></div>
      <div className="data-scroll"><table className="data-table appointment-ledger"><thead><tr><th>Date & time</th><th>Customer & vehicle</th><th>Branch</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{appointments.map((appointment) => {
        const actions = nextActions(appointment.status);
        return <tr key={appointment.id}><td className="nowrap"><div className="cell-main">{appointmentDate.format(new Date(appointment.start_at))}</div><div className="cell-sub mono">{appointmentTime.format(new Date(appointment.start_at))}–{appointmentTime.format(new Date(appointment.end_at))}</div></td><td><div className="cell-main">{appointment.vehicle?.model?.name ?? "Volkswagen ID"} · {appointment.vehicle?.registration_no ?? appointment.vehicle?.vin}</div><div className="cell-sub">{appointment.customer?.display_name ?? "Unknown customer"}</div></td><td>{appointment.branch?.city ?? appointment.branch?.display_name ?? "—"}</td><td><StatusPill label={appointment.status} tone={statusTone(appointment.status)} /></td><td><span className="cell-sub">{appointment.notes || "—"}</span></td><td><div className="inline-actions">{actions.map((action) => <form action={transitionAppointment} key={action.value}><input type="hidden" name="appointmentId" value={appointment.id} /><input type="hidden" name="version" value={appointment.version} /><input type="hidden" name="toStatus" value={action.value} /><button className={`button compact ${action.value === "confirmed" || action.value === "checked_in" || action.value === "completed" ? "primary" : ""}`} type="submit">{action.label}</button></form>)}</div></td></tr>;
      })}</tbody></table></div>
    </section>}
  </>;
}
