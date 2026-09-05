import Link from "next/link";
import { CalendarDays, Clock3, ListPlus, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { completeVehicleCheckin, createAppointment, createWaitlistEntry, transitionAppointment, transitionWaitlistEntry } from "./actions";

type PageQuery = { new?: string; checkin?: string; created?: string; error?: string };
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
  if (status === "confirmed") return [{ value: "no_show", label: "No show" }, { value: "cancelled", label: "Cancel" }];
  if (status === "checked_in") return [{ value: "completed", label: "Complete" }];
  return [];
}

function modelScope(value: Json): string {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.model_codes)) return "All VW ID models";
  const codes = value.model_codes.filter((item): item is string => typeof item === "string");
  return codes.length ? codes.join(", ") : "All VW ID models";
}

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const now = new Date();
  const rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const rangeEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: branches }, { data: customers }, { data: vehicles }, { data: appointmentRows, error }, { data: resources }, { data: advisors }, { data: waitlistRows }, { data: operatingHours }, { data: holidays }, { data: checkins }, { data: serviceVersionRows }] = await Promise.all([
    supabase.from("branches").select("id, code, city, timezone").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("customers").select("id, display_name").eq("organization_id", staff.organizationId).eq("status", "active").order("display_name"),
    supabase.from("vehicles").select("id, vin, registration_no, model:vehicle_models(name), vehicle_ownerships(customer:customers(display_name))").eq("organization_id", staff.organizationId).eq("status", "active").order("registration_no"),
    supabase
      .from("appointments")
      .select("id, branch_id, start_at, end_at, promised_at, status, channel, notes, version, service_mode, transport_mode, recurrence_group_id, recurrence_sequence, requested_services, appointment_service_items(template_code, template_name_en, version_no, planned_minutes), branch:branches(display_name, city), customer:customers(display_name), vehicle:vehicles(registration_no, vin, model:vehicle_models(name))")
      .eq("organization_id", staff.organizationId)
      .gte("end_at", rangeStart)
      .lte("start_at", rangeEnd)
      .order("start_at"),
    supabase.from("resources").select("id, branch_id, code, name, resource_type").eq("organization_id", staff.organizationId).eq("status", "active").order("code"),
    supabase.from("technician_profiles").select("user_id, employee_no, labor_grade").eq("organization_id", staff.organizationId).eq("active", true).order("employee_no"),
    supabase.from("appointment_waitlist").select("id, branch_id, preferred_from, preferred_to, duration_minutes, service_mode, transport_mode, priority, notes, status, customer:customers(display_name), vehicle:vehicles(registration_no, vin, model:vehicle_models(name)), branch:branches(code, city)").eq("organization_id", staff.organizationId).in("status", ["waiting", "offered"]).order("priority").order("preferred_from"),
    supabase.from("branch_operating_hours").select("branch_id, day_of_week, opens_at, closes_at, is_closed").eq("organization_id", staff.organizationId).order("day_of_week"),
    supabase.from("branch_holidays").select("branch_id, holiday_date, name, is_closed, opens_at, closes_at").eq("organization_id", staff.organizationId).gte("holiday_date", new Date().toISOString().slice(0,10)).order("holiday_date").limit(12),
    supabase.from("vehicle_checkins").select("id, appointment_id, odometer_km, state_of_charge, keys_count, warning_lights, ownership_verified, diagnosis_authorized, road_test_authorized, signer_name, signature_hash, signed_at, checkin_condition_items(zone, condition, notes)").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }),
    supabase.from("service_template_versions").select("id, version_no, effective_from, effective_to, interval_months, interval_km, applicability_json, template:service_templates(code, name_en, name_ar, market), service_template_tasks(standard_minutes)").eq("organization_id", staff.organizationId).eq("status", "published").order("effective_from", { ascending: false }),
  ]);
  const appointments = staff.selectedBranchId ? (appointmentRows ?? []).filter((appointment) => appointment.branch_id === staff.selectedBranchId) : (appointmentRows ?? []);
  const waitlist = staff.selectedBranchId ? (waitlistRows ?? []).filter((entry) => entry.branch_id === staff.selectedBranchId) : (waitlistRows ?? []);

  const todayKey = day.format(now);
  const todayAppointments = appointments.filter((appointment) => day.format(new Date(appointment.start_at)) === todayKey);
  const arrivals = todayAppointments.filter((appointment) => appointment.status === "confirmed" || appointment.status === "checked_in").length;
  const pending = appointments.filter((appointment) => appointment.status === "requested").length;
  const completed = todayAppointments.filter((appointment) => appointment.status === "completed").length;
  const historical = appointments.filter((appointment) => appointment.status === "completed" || appointment.status === "no_show");
  const noShows = historical.filter((appointment) => appointment.status === "no_show").length;
  const noShowRate = historical.length ? `${(noShows / historical.length * 100).toFixed(1)}%` : "—";
  const publishedServices = serviceVersionRows ?? [];
  const setupReady = Boolean(branches?.length && customers?.length && vehicles?.length);
  const catalogReady = publishedServices.length > 0;
  const showForm = query.new === "1" && setupReady && catalogReady;
  const showWaitlistForm = query.new === "waitlist" && setupReady;
  const checkinAppointment = appointments.find((appointment) => appointment.id === query.checkin && appointment.status === "confirmed");

  return <>
    <PageHeader eyebrow="Reception planning" title="Appointments" description="Schedule arrivals by branch and move each booking through confirmation, check-in and completion.">
      <Link className="button" href="/appointments">Today</Link>
      {setupReady ? <Link className="button" href="/appointments?new=waitlist#new-waitlist"><ListPlus /> Add to waitlist</Link> : null}
      {setupReady && catalogReady ? <Link className="button primary" href="/appointments?new=1#new-appointment"><Plus /> New appointment</Link> : setupReady ? <Link className="button primary" href="/catalog?new=template#template-form"><Plus /> Create service list</Link> : <Link className="button primary" href={branches?.length ? customers?.length ? "/vehicles?new=1#new-vehicle" : "/customers?new=1#new-customer" : "/branches?new=1#new-branch"}><Plus /> Complete setup</Link>}
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
        <div className="form-field"><label htmlFor="appointment-service-mode">Service mode</label><select id="appointment-service-mode" name="serviceMode" defaultValue="workshop"><option value="workshop">Workshop</option><option value="mobile">Mobile service</option></select></div>
        <div className="form-field"><label htmlFor="appointment-transport">Transport</label><select id="appointment-transport" name="transportMode" defaultValue="customer_dropoff"><option value="customer_dropoff">Customer drop-off</option><option value="wait_on_site">Wait on site</option><option value="pickup_return">Pickup & return</option><option value="loan_vehicle">Loan vehicle</option></select></div>
        <div className="form-field"><label htmlFor="appointment-advisor">Advisor / technician</label><select id="appointment-advisor" name="advisorUserId" defaultValue=""><option value="">Unassigned</option>{advisors?.map(advisor=><option key={advisor.user_id} value={advisor.user_id}>{advisor.employee_no} · {advisor.labor_grade}</option>)}</select></div>
        <div className="form-field"><label htmlFor="appointment-resource">Primary resource</label><select id="appointment-resource" name="resourceId" defaultValue=""><option value="">Allocate later</option>{resources?.filter(resource=>!staff.selectedBranchId || resource.branch_id===staff.selectedBranchId).map(resource=><option key={resource.id} value={resource.id}>{resource.code} · {resource.name} · {resource.resource_type}</option>)}</select></div>
        <div className="form-field"><label htmlFor="appointment-recurrence">Weekly occurrences</label><input id="appointment-recurrence" name="recurrenceCount" type="number" min="1" max="12" defaultValue="1"/><span className="field-hint">Use for recurring fleet visits.</span></div>
        <fieldset className="access-fieldset form-span-2"><legend>Requested services</legend><p>Select one or more published service recipes. The database verifies the market, effective date, vehicle model and total booking duration.</p><div className="permission-grid">{publishedServices.map((version) => { const minutes = version.service_template_tasks.reduce((sum, task) => sum + task.standard_minutes, 0); return <label className="check-field" key={version.id}><input name="serviceVersionId" type="checkbox" value={version.id}/><span><strong>{version.template?.name_en ?? "Service"}</strong><small>{version.template?.code} · V{version.version_no} · {minutes} min · from {version.effective_from} · {modelScope(version.applicability_json)}</small></span></label>; })}</div></fieldset>
        <div className="form-field form-span-2"><label htmlFor="appointment-notes">Reception notes</label><textarea id="appointment-notes" name="notes" rows={3} placeholder="Requested service, symptoms or arrival instructions." /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/appointments">Cancel</Link><button className="button primary" type="submit">Schedule appointment</button></div>
      </form>
    </section> : null}

    {showWaitlistForm ? <section className="panel operation-form" id="new-waitlist"><div className="panel-header"><div><div className="panel-title">Add to appointment waitlist</div><div className="panel-subtitle">Capture a flexible service window so staff can offer the next matching opening.</div></div><Link className="panel-link" href="/appointments">Cancel</Link></div><form action={createWaitlistEntry} className="form-grid panel-body"><div className="form-field"><label htmlFor="waitlist-branch">Branch</label><select id="waitlist-branch" name="branchId" defaultValue={staff.selectedBranchId ?? ""} required><option value="">Select branch</option>{branches?.map(branch=><option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div><div className="form-field"><label htmlFor="waitlist-customer">Customer</label><select id="waitlist-customer" name="customerId" required><option value="">Select customer</option>{customers?.map(customer=><option key={customer.id} value={customer.id}>{customer.display_name}</option>)}</select></div><div className="form-field form-span-2"><label htmlFor="waitlist-vehicle">Vehicle</label><select id="waitlist-vehicle" name="vehicleId" required><option value="">Select vehicle</option>{vehicles?.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.model?.name ?? "Volkswagen ID"} · {vehicle.registration_no ?? vehicle.vin}</option>)}</select></div><div className="form-field"><label htmlFor="waitlist-from">Preferred from</label><input id="waitlist-from" name="preferredFrom" type="datetime-local" required/></div><div className="form-field"><label htmlFor="waitlist-to">Preferred through</label><input id="waitlist-to" name="preferredTo" type="datetime-local" required/></div><div className="form-field"><label htmlFor="waitlist-duration">Duration (minutes)</label><input id="waitlist-duration" name="durationMinutes" type="number" min="15" max="720" step="15" defaultValue="60" required/></div><div className="form-field"><label htmlFor="waitlist-priority">Priority</label><select id="waitlist-priority" name="priority" defaultValue="3"><option value="1">1 · Urgent</option><option value="2">2 · High</option><option value="3">3 · Normal</option><option value="4">4 · Flexible</option><option value="5">5 · Lowest</option></select></div><div className="form-field"><label htmlFor="waitlist-service">Service mode</label><select id="waitlist-service" name="serviceMode" defaultValue="workshop"><option value="workshop">Workshop</option><option value="mobile">Mobile service</option></select></div><div className="form-field"><label htmlFor="waitlist-transport">Transport</label><select id="waitlist-transport" name="transportMode" defaultValue="customer_dropoff"><option value="customer_dropoff">Customer drop-off</option><option value="wait_on_site">Wait on site</option><option value="pickup_return">Pickup & return</option><option value="loan_vehicle">Loan vehicle</option></select></div><div className="form-field form-span-2"><label htmlFor="waitlist-notes">Requested work / constraints</label><textarea id="waitlist-notes" name="notes" rows={2}/></div><div className="form-actions form-span-2"><button className="button primary" type="submit">Add to waitlist</button></div></form></section> : null}

    {checkinAppointment ? <section className="panel operation-form" id="vehicle-checkin"><div className="panel-header"><div><div className="panel-title">Guided vehicle check-in</div><div className="panel-subtitle">{checkinAppointment.customer?.display_name} · {checkinAppointment.vehicle?.model?.name} · {checkinAppointment.vehicle?.registration_no ?? checkinAppointment.vehicle?.vin}</div></div><Link className="panel-link" href="/appointments">Cancel</Link></div><form action={completeVehicleCheckin} className="form-grid panel-body"><input type="hidden" name="appointmentId" value={checkinAppointment.id}/><input type="hidden" name="version" value={checkinAppointment.version}/><div className="form-field"><label htmlFor="checkin-odometer">Odometer (km)</label><input id="checkin-odometer" name="odometerKm" type="number" min="0" required/></div><div className="form-field"><label htmlFor="checkin-soc">State of charge (%)</label><input id="checkin-soc" name="stateOfCharge" type="number" min="0" max="100" step="0.1"/></div><div className="form-field"><label htmlFor="checkin-keys">Keys received</label><input id="checkin-keys" name="keysCount" type="number" min="0" max="10" defaultValue="1" required/></div><div className="form-field"><label htmlFor="checkin-warning">Warning lights</label><input id="checkin-warning" name="warningLights" placeholder="Battery, airbag, brake"/></div><div className="form-field form-span-2"><label htmlFor="checkin-accessories">Accessories left with vehicle</label><input id="checkin-accessories" name="accessories" placeholder="Charging cable, adapter, child seat"/></div>{["front","rear","left","right","roof","interior","wheels","cargo"].map(zone=><div className="form-field" key={zone}><label htmlFor={`${zone}-condition`}>{zone[0].toUpperCase()+zone.slice(1)} condition</label><select id={`${zone}-condition`} name={`${zone}Condition`} defaultValue="clear"><option value="clear">Clear</option><option value="noted">Noted</option><option value="damaged">Damaged</option></select><input name={`${zone}Notes`} placeholder="Condition notes" aria-label={`${zone} condition notes`}/></div>)}<div className="form-field form-span-2"><label htmlFor="checkin-odometer-reason">Odometer correction reason</label><input id="checkin-odometer-reason" name="odometerCorrectionReason" placeholder="Required for an administrator recording a lower reading"/></div><label className="check-field form-span-2"><input name="ownershipVerified" type="checkbox" required/><span>Customer identity and ownership / authority verified</span></label><label className="check-field form-span-2"><input name="diagnosisAuthorized" type="checkbox" required/><span>Customer authorizes diagnosis and approved workshop handling</span></label><label className="check-field form-span-2"><input name="roadTestAuthorized" type="checkbox"/><span>Customer authorizes a road test when technically required</span></label><div className="form-field form-span-2"><label htmlFor="checkin-signer">Signer name</label><input id="checkin-signer" name="signerName" required/><span className="field-hint">Submitting creates a tamper-evident SHA-256 authorization record.</span></div><div className="form-actions form-span-2"><button className="button primary" type="submit">Sign and check in vehicle</button></div></form></section> : null}

    {operatingHours?.length || holidays?.length ? <section className="panel"><div className="panel-header"><div><div className="panel-title">Branch calendar rules</div><div className="panel-subtitle">Bookings are validated against configured opening hours and holiday exceptions.</div></div></div><div className="consent-ledger">{branches?.map(branch=>{const hours=operatingHours?.filter(hour=>hour.branch_id===branch.id)??[];const nextHoliday=holidays?.find(holiday=>holiday.branch_id===branch.id);return <article key={branch.id}><div><strong>{branch.city} · {branch.code}</strong><span>{hours.length ? `${hours.filter(hour=>!hour.is_closed).length} operating days configured` : "No hours restriction configured"}</span></div><span>{nextHoliday ? `${nextHoliday.holiday_date} · ${nextHoliday.name}` : "No upcoming holiday"}</span></article>;})}</div></section> : null}

    <MetricStrip metrics={[
      { label: "Arrivals today", value: String(arrivals), note: `${todayAppointments.length} bookings today`, icon: CalendarDays },
      { label: "Pending requests", value: String(pending), note: "Awaiting confirmation", noteTone: pending ? "warn" : "good", icon: Clock3 },
      { label: "Completed today", value: String(completed), note: "Reception cycle complete", noteTone: "good", icon: CalendarDays },
      { label: "No-show rate", value: noShowRate, note: "Completed appointment history", noteTone: noShows ? "warn" : "good", icon: CalendarDays },
    ]} />

    {waitlist.length ? <section className="panel"><div className="panel-header"><div><div className="panel-title">Appointment waitlist</div><div className="panel-subtitle">Priority queue for matching new capacity and cancellations.</div></div><span className="status-pill amber">{waitlist.length} waiting</span></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Priority</th><th>Customer & vehicle</th><th>Preferred window</th><th>Mode</th><th>Status / action</th></tr></thead><tbody>{waitlist.map(entry=><tr key={entry.id}><td className="mono">P{entry.priority}</td><td><div className="cell-main">{entry.customer?.display_name}</div><div className="cell-sub">{entry.vehicle?.model?.name} · {entry.vehicle?.registration_no ?? entry.vehicle?.vin}</div></td><td><div>{appointmentDate.format(new Date(entry.preferred_from))} – {appointmentDate.format(new Date(entry.preferred_to))}</div><div className="cell-sub">{entry.duration_minutes} min · {entry.branch?.city}</div></td><td>{entry.service_mode} · {entry.transport_mode.replaceAll("_"," ")}</td><td><form action={transitionWaitlistEntry} className="inline-actions"><input type="hidden" name="waitlistId" value={entry.id}/><input type="hidden" name="reason" value="Scheduling team update"/><select name="status" defaultValue={entry.status==="waiting"?"offered":"cancelled"}><option value="offered">Offer slot</option><option value="cancelled">Cancel</option><option value="expired">Expire</option></select><button className="button compact" type="submit">Apply</button></form></td></tr>)}</tbody></table></div></section> : null}

    {!appointments?.length ? <EmptyState icon={CalendarDays} title="No appointments scheduled" description={setupReady ? catalogReady ? "Schedule the first customer arrival using a published catalog service." : "Publish at least one service recipe before scheduling customer work." : "Create a branch, customer and vehicle before scheduling an appointment."} action={setupReady ? catalogReady ? <Link className="button primary" href="/appointments?new=1#new-appointment">Schedule first appointment</Link> : <Link className="button primary" href="/catalog?new=template#template-form">Create service list</Link> : undefined} /> : <section className="panel">
      <div className="panel-header"><div><div className="panel-title">Arrival ledger</div><div className="panel-subtitle">Recent and upcoming appointments · Asia/Amman display time</div></div></div>
      <div className="data-scroll"><table className="data-table appointment-ledger"><thead><tr><th>Date & time</th><th>Customer & vehicle</th><th>Branch</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{appointments.map((appointment) => {
        const actions = nextActions(appointment.status);
        const checkin = checkins?.find((item) => item.appointment_id === appointment.id);
        return <tr key={appointment.id}><td className="nowrap"><div className="cell-main">{appointmentDate.format(new Date(appointment.start_at))}</div><div className="cell-sub mono">{appointmentTime.format(new Date(appointment.start_at))}–{appointmentTime.format(new Date(appointment.end_at))}{appointment.recurrence_group_id ? ` · Series ${appointment.recurrence_sequence}` : ""}</div></td><td><div className="cell-main">{appointment.vehicle?.model?.name ?? "Volkswagen ID"} · {appointment.vehicle?.registration_no ?? appointment.vehicle?.vin}</div><div className="cell-sub">{appointment.customer?.display_name ?? "Unknown customer"}{checkin ? ` · ${checkin.odometer_km.toLocaleString()} km · signed ${checkin.signer_name}` : ""}</div></td><td>{appointment.branch?.city ?? appointment.branch?.display_name ?? "—"}</td><td><StatusPill label={appointment.status} tone={statusTone(appointment.status)} /></td><td><div className="cell-main">{appointment.appointment_service_items.length ? appointment.appointment_service_items.map((service) => service.template_name_en).join(", ") : "Legacy service request"}</div><span className="cell-sub">{appointment.appointment_service_items.length ? `${appointment.appointment_service_items.reduce((sum, service) => sum + service.planned_minutes, 0)} planned min · ` : ""}{appointment.service_mode} · {appointment.transport_mode.replaceAll("_", " ")}{appointment.notes ? ` · ${appointment.notes}` : ""}</span></td><td><div className="inline-actions">{appointment.status === "confirmed" ? <Link className="button compact primary" href={`/appointments?checkin=${appointment.id}#vehicle-checkin`}>Guided check-in</Link> : null}{actions.map((action) => <form action={transitionAppointment} key={action.value}><input type="hidden" name="appointmentId" value={appointment.id} /><input type="hidden" name="version" value={appointment.version} /><input type="hidden" name="toStatus" value={action.value} /><button className={`button compact ${action.value === "confirmed" || action.value === "completed" ? "primary" : ""}`} type="submit">{action.label}</button></form>)}</div></td></tr>;
      })}</tbody></table></div>
    </section>}
  </>;
}
