import { BatteryCharging, CarFront, Plus } from "lucide-react";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { SearchFilters } from "@/components/search-filters";
import { StatusPill } from "@/components/status-pill";
import { vehicles } from "@/lib/demo-data";

export default function VehiclesPage() {
  return <><PageHeader eyebrow="Vehicle registry" title="VW ID vehicles" description="VIN-led service history, ownership, odometer, battery health and technical diagnostics."><button className="button primary"><Plus /> Register vehicle</button></PageHeader>
    <MetricStrip metrics={[{ label: "Registered vehicles", value: "1,972", note: "Across 1,284 customers", icon: CarFront },{ label: "Average battery SOH", value: "92.8%", note: "Network fleet average", noteTone: "good", icon: BatteryCharging },{ label: "Service due", value: "68", note: "Within next 30 days", noteTone: "warn", icon: CarFront },{ label: "Open DTC alerts", value: "14", note: "3 safety-related", noteTone: "warn", icon: BatteryCharging }]} />
    <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search VIN, registration or customer…" filters={["All models", "All branches", "Service status"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Vehicle</th><th>VIN</th><th>Customer</th><th>Mileage</th><th>Battery SOH</th><th>Next service</th><th>Home branch</th></tr></thead><tbody>{vehicles.map((vehicle) => <tr key={vehicle.id}><td><div className="cell-main">{vehicle.model}</div><div className="cell-sub">{vehicle.registration}</div></td><td className="mono">{vehicle.vin}</td><td>{vehicle.customer}</td><td className="mono">{vehicle.mileage}</td><td><StatusPill label={`${vehicle.soh}%`} tone={vehicle.soh >= 90 ? "green" : "amber"} /></td><td>{vehicle.nextService}</td><td>{vehicle.branch}</td></tr>)}</tbody></table></div></section></>;
}
