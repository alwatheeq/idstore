import Link from "next/link";
import { BatteryCharging, CarFront, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { SearchFilters } from "@/components/search-filters";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createRecommendation, createVehicle, transitionRecommendation } from "./actions";

type PageQuery = { new?: string; created?: string; error?: string };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: branches }, { data: customers }, { data: models }, { data: vehicles, error }, { data: recommendations }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("customers").select("id, display_name").eq("organization_id", staff.organizationId).eq("status", "active").order("display_name"),
    supabase.from("vehicle_models").select("id, name, model_code").or(`organization_id.is.null,organization_id.eq.${staff.organizationId}`).order("name"),
    supabase
      .from("vehicles")
      .select("id, vin, registration_no, model_year, trim, battery_kwh, status, model:vehicle_models(name), vehicle_ownerships(customer:customers(display_name)), odometer_readings(reading_km, recorded_at), battery_health_reports(soh_percent, measured_at)")
      .eq("organization_id", staff.organizationId)
      .order("created_at", { ascending: false }),
    supabase.from("vehicle_recommendations").select("id, vehicle_id, branch_id, description, severity, status, due_date, due_odometer_km, created_at, vehicle:vehicles(registration_no, vin, model:vehicle_models(name)), branch:branches(code, city)").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }),
  ]);

  const latestSoh = (vehicles ?? []).flatMap((vehicle) => vehicle.battery_health_reports.map((report) => report.soh_percent).filter((value): value is number => value !== null));
  const averageSoh = latestSoh.length ? latestSoh.reduce((sum, value) => sum + Number(value), 0) / latestSoh.length : null;
  const quarantined = (vehicles ?? []).filter((vehicle) => vehicle.status === "quarantine").length;
  const openRecommendations = (recommendations ?? []).filter((item) => item.status === "open" || item.status === "scheduled");
  const safetyAlerts = openRecommendations.filter((item) => item.severity === "red" || item.severity === "safety_stop").length;
  const setupReady = Boolean(branches?.length && customers?.length && models?.length);
  const showForm = query.new === "1";

  return <>
    <PageHeader eyebrow="Vehicle registry" title="VW ID vehicles" description="VIN-led service history, ownership, odometer, battery health and technical diagnostics.">
      {vehicles?.length && branches?.length ? <Link className="button" href="/vehicles?new=recommendation#new-recommendation"><Plus /> Add deferred work</Link> : null}{setupReady ? <Link className="button primary" href="/vehicles?new=1#new-vehicle"><Plus /> Register vehicle</Link> : <Link className="button primary" href={branches?.length ? "/customers?new=1#new-customer" : "/branches?new=1#new-branch"}><Plus /> Complete setup</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Vehicle records could not be loaded." : undefined)} />

    {showForm && setupReady ? <section className="panel operation-form" id="new-vehicle">
      <div className="panel-header"><div><div className="panel-title">Register a VW ID vehicle</div><div className="panel-subtitle">Creates the vehicle, ownership link and initial odometer reading together.</div></div><Link className="panel-link" href="/vehicles">Cancel</Link></div>
      <form action={createVehicle} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="vehicle-branch">Intake branch</label><select id="vehicle-branch" name="branchId" required><option value="">Select branch</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="vehicle-customer">Owner</label><select id="vehicle-customer" name="customerId" required><option value="">Select customer</option>{customers?.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}</option>)}</select></div>
        <div className="form-field"><label htmlFor="vehicle-model">VW ID model</label><select id="vehicle-model" name="modelId" required><option value="">Select model</option>{models?.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.model_code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="vehicle-year">Model year</label><input id="vehicle-year" name="modelYear" type="number" min="2019" max={new Date().getFullYear() + 1} /></div>
        <div className="form-field form-span-2"><label htmlFor="vehicle-vin">VIN</label><input className="mono" id="vehicle-vin" name="vin" minLength={17} maxLength={17} pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" placeholder="WVWZZZE1ZNP012418" required /></div>
        <div className="form-field"><label htmlFor="vehicle-registration">Registration number</label><input id="vehicle-registration" name="registrationNo" required /></div>
        <div className="form-field"><label htmlFor="vehicle-trim">Trim</label><input id="vehicle-trim" name="trim" placeholder="Pro Performance" /></div>
        <div className="form-field"><label htmlFor="vehicle-battery">Battery capacity (kWh)</label><input id="vehicle-battery" name="batteryKwh" type="number" min="1" step="0.01" /></div>
        <div className="form-field"><label htmlFor="vehicle-odometer">Odometer (km)</label><input id="vehicle-odometer" name="odometerKm" type="number" min="0" step="1" /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/vehicles">Cancel</Link><button className="button primary" type="submit">Register vehicle</button></div>
      </form>
    </section> : null}

    {query.new === "recommendation" && vehicles?.length && branches?.length ? <section className="panel operation-form recommendation-form" id="new-recommendation"><div className="panel-header"><div><div className="panel-title">Record deferred work</div><div className="panel-subtitle">Keep declined or future work visible across every city visit.</div></div><Link className="panel-link" href="/vehicles">Cancel</Link></div><form action={createRecommendation} className="form-grid panel-body"><div className="form-field"><label htmlFor="recommendation-vehicle">Vehicle</label><select id="recommendation-vehicle" name="vehicleId" required><option value="">Select vehicle</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.model?.name ?? "Volkswagen ID"} · {v.registration_no ?? v.vin}</option>)}</select></div><div className="form-field"><label htmlFor="recommendation-branch">Recording branch</label><select id="recommendation-branch" name="branchId" required><option value="">Select branch</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.city} · {b.code}</option>)}</select></div><div className="form-field form-span-2"><label htmlFor="recommendation-description">Recommended work</label><input id="recommendation-description" name="description" required /></div><div className="form-field"><label htmlFor="recommendation-severity">Severity</label><select id="recommendation-severity" name="severity"><option value="amber">Advisory</option><option value="red">Urgent</option><option value="safety_stop">Safety stop</option></select></div><div className="form-field"><label htmlFor="recommendation-date">Due date</label><input id="recommendation-date" name="dueDate" type="date" /></div><div className="form-field"><label htmlFor="recommendation-km">Due odometer (km)</label><input id="recommendation-km" name="dueOdometerKm" type="number" min="0" /></div><div className="form-actions form-span-2"><button className="button primary" type="submit">Record deferred work</button></div></form></section> : null}

    <MetricStrip metrics={[
      { label: "Registered vehicles", value: String(vehicles?.length ?? 0), note: "Live registry", icon: CarFront },
      { label: "Average battery SOH", value: averageSoh === null ? "—" : `${averageSoh.toFixed(1)}%`, note: latestSoh.length ? `${latestSoh.length} measured vehicles` : "No battery tests yet", noteTone: averageSoh !== null && averageSoh >= 90 ? "good" : undefined, icon: BatteryCharging },
      { label: "Quarantined", value: String(quarantined), note: "Safety-restricted vehicles", noteTone: quarantined ? "warn" : "good", icon: CarFront },
      { label: "Open safety alerts", value: String(safetyAlerts), note: "Red or safety-stop", noteTone: safetyAlerts ? "warn" : "good", icon: BatteryCharging },
    ]} />

    {!vehicles?.length ? <EmptyState icon={CarFront} title="No vehicles registered" description={setupReady ? "Register the first vehicle and link it to its owner." : "A branch and customer are required before registering vehicles."} action={setupReady ? <Link className="button primary" href="/vehicles?new=1#new-vehicle">Register first vehicle</Link> : <Link className="button" href={branches?.length ? "/customers?new=1#new-customer" : "/branches?new=1#new-branch"}>Complete setup</Link>} /> : <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search VIN, registration or customer…" filters={["All models", "All statuses"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Vehicle</th><th>VIN</th><th>Customer</th><th>Mileage</th><th>Battery SOH</th><th>Battery</th><th>Status</th></tr></thead><tbody>{vehicles.map((vehicle) => {
      const ownership = vehicle.vehicle_ownerships[0];
      const odometer = [...vehicle.odometer_readings].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
      const health = [...vehicle.battery_health_reports].sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0];
      return <tr key={vehicle.id}><td><div className="cell-main">{vehicle.model?.name ?? "Volkswagen ID"}{vehicle.trim ? ` · ${vehicle.trim}` : ""}</div><div className="cell-sub">{vehicle.registration_no ?? "No registration"}{vehicle.model_year ? ` · ${vehicle.model_year}` : ""}</div></td><td className="mono">{vehicle.vin ?? "—"}</td><td>{ownership?.customer?.display_name ?? "Unassigned"}</td><td className="mono">{odometer ? `${Number(odometer.reading_km).toLocaleString()} km` : "—"}</td><td>{health?.soh_percent !== null && health?.soh_percent !== undefined ? <StatusPill label={`${health.soh_percent}%`} tone={Number(health.soh_percent) >= 90 ? "green" : "amber"} /> : "—"}</td><td>{vehicle.battery_kwh ? `${vehicle.battery_kwh} kWh` : "—"}</td><td><StatusPill label={vehicle.status} tone={vehicle.status === "active" ? "green" : vehicle.status === "quarantine" ? "red" : "amber"} /></td></tr>;
    })}</tbody></table></div></section>}
    {recommendations?.length ? <section className="panel" style={{ marginTop: 20 }}><div className="panel-header"><div><div className="panel-title">Deferred-work register</div><div className="panel-subtitle">Organization-wide follow-up with originating branch provenance</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Vehicle</th><th>Recommendation</th><th>Recorded at</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{recommendations.map((item) => <tr key={item.id}><td><div className="cell-main">{item.vehicle?.model?.name ?? "VW ID"} · {item.vehicle?.registration_no ?? item.vehicle?.vin}</div></td><td><div className="cell-main">{item.description}</div><div className="cell-sub"><StatusPill label={item.severity} tone={item.severity === "safety_stop" || item.severity === "red" ? "red" : "amber"} /></div></td><td>{item.branch?.city} · {item.branch?.code}</td><td>{item.due_date ?? "—"}{item.due_odometer_km ? ` · ${Number(item.due_odometer_km).toLocaleString()} km` : ""}</td><td><StatusPill label={item.status} tone={item.status === "completed" ? "green" : item.status === "dismissed" ? "gray" : "amber"} /></td><td>{["open", "scheduled"].includes(item.status) ? <div className="inline-actions">{item.status === "open" ? <form action={transitionRecommendation}><input type="hidden" name="recommendationId" value={item.id} /><input type="hidden" name="status" value="scheduled" /><button className="button compact" type="submit">Schedule</button></form> : null}<form action={transitionRecommendation}><input type="hidden" name="recommendationId" value={item.id} /><input type="hidden" name="status" value="completed" /><button className="button compact primary" type="submit">Complete</button></form><form action={transitionRecommendation}><input type="hidden" name="recommendationId" value={item.id} /><input type="hidden" name="status" value="dismissed" /><button className="button compact" type="submit">Dismiss</button></form></div> : "—"}</td></tr>)}</tbody></table></div></section> : null}
  </>;
}
