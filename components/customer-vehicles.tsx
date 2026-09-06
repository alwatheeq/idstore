import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JourneyDate } from "@/components/journey-date";
import { StatusPill } from "@/components/status-pill";

export async function CustomerVehicles({ organizationId, customerId }: { organizationId: string; customerId: string }) {
  const db = await createClient();
  const [{ data: links, error }, { data: visits, error: visitError }] = await Promise.all([
    db.from("vehicle_ownerships").select("id, valid_from, valid_to, relationship, vehicle:vehicles(id, model_year, vin, registration_no, color, model:vehicle_models(name), odometer_readings(reading_km, recorded_at))")
      .eq("organization_id", organizationId).eq("customer_id", customerId).order("valid_from", { ascending: false }),
    db.from("repair_orders").select("vehicle_id, opened_at, status").eq("organization_id", organizationId).eq("customer_id", customerId).neq("status", "cancelled").order("opened_at", { ascending: false }),
  ]);
  if (error || visitError) return <p role="alert">Linked vehicles could not be loaded.</p>;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
  return <div className="journey-history"><div className="journey-actions"><Link className="button primary" href={`/vehicles?new=1&customer=${customerId}#new-vehicle`}>Add vehicle</Link></div>
    {links?.length ? <div className="document-grid">{links.map(link => {
      const v = link.vehicle; if (!v) return null;
      const current = link.valid_from <= today && (!link.valid_to || link.valid_to >= today);
      const latest = [...v.odometer_readings].sort((a,b) => b.recorded_at.localeCompare(a.recorded_at))[0];
      const visit = visits?.find(visit => visit.vehicle_id === v.id);
      return <article className="document-card" key={link.id}><Link href={`/vehicles?manage=${v.id}#vehicle-controls`}><strong><bdi dir="ltr">{v.model?.name} · {v.model_year ?? "—"}</bdi></strong></Link>
        <span dir="ltr">{v.registration_no ?? v.vin ?? "—"}</span><StatusPill label={current ? "Current" : "Historical"} tone={current ? "blue" : "gray"}/>
        <dl className="record-card-facts"><div><dt>Odometer (km)</dt><dd dir="ltr">{latest?.reading_km ?? "—"}</dd></div><div><dt>Last visit</dt><dd>{visit ? <JourneyDate value={visit.opened_at}/> : "—"}</dd></div><div><dt>Relationship</dt><dd>{link.relationship}</dd></div></dl>
        <div className="journey-actions"><Link className="button compact" href={`/vehicles?manage=${v.id}&tab=documents#vehicle-controls`}>Documents</Link>{current ? <Link className="button compact" href={`/work-orders?new=1&customer=${customerId}&vehicle=${v.id}#new-work-order`}>New visit</Link> : null}</div>
      </article>;
    })}</div> : <p>No linked vehicles</p>}
  </div>;
}
