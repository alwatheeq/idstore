import { AlertTriangle, Boxes, Download, Plus } from "lucide-react";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { SearchFilters } from "@/components/search-filters";
import { StatusPill } from "@/components/status-pill";
import { inventory } from "@/lib/demo-data";

export default function InventoryPage() {
  return <><PageHeader eyebrow="Parts operations" title="Inventory" description="Branch warehouses, reservations, purchasing, transfers and an immutable stock movement ledger."><button className="button"><Download /> Stock report</button><button className="button primary"><Plus /> Purchase order</button></PageHeader>
    <MetricStrip metrics={[{ label: "Stock value", value: "JOD 86.4k", note: "Across 3 branches", icon: Boxes },{ label: "Low stock", value: "18", note: "5 service-critical", noteTone: "warn", icon: AlertTriangle },{ label: "Reserved", value: "JOD 7.2k", note: "For 42 open jobs", icon: Boxes },{ label: "Open purchase orders", value: "9", note: "2 overdue deliveries", noteTone: "warn", icon: Boxes }]} />
    <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search part number or description…" filters={["All branches", "All stock states", "All suppliers"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Part</th><th>Description</th><th>Branch</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Status</th><th className="align-right">Value</th></tr></thead><tbody>{inventory.map((item) => { const available = item.onHand - item.reserved; const low = item.onHand <= item.reorderAt; return <tr key={item.id}><td className="cell-main mono">{item.partNumber}</td><td>{item.description}</td><td>{item.branch}</td><td className="mono">{item.onHand}</td><td className="mono">{item.reserved}</td><td className="mono">{available}</td><td><StatusPill label={available === 0 ? "allocated" : low ? "reorder" : "healthy"} tone={available === 0 ? "red" : low ? "amber" : "green"} /></td><td className="align-right cell-main mono">{item.value}</td></tr>; })}</tbody></table></div></section></>;
}
