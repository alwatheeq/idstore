import { Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SearchFilters } from "@/components/search-filters";
import { StatusPill } from "@/components/status-pill";
import { workOrders } from "@/lib/demo-data";

const tones = { diagnosis: "blue", awaiting_approval: "amber", in_progress: "blue", qc: "amber", ready: "green" } as const;

export default function WorkOrdersPage() {
  return <><PageHeader eyebrow="Workshop" title="Work orders" description="Control every job from reception and diagnosis through approval, repair, quality control and handover."><button className="button"><Download /> Export</button><button className="button primary"><Plus /> New work order</button></PageHeader>
    <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search RO, customer, VIN or registration…" filters={["All statuses", "All advisors", "All risk levels"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Order</th><th>Customer & vehicle</th><th>Status</th><th>Advisor</th><th>Promise</th><th>Risk</th><th>Progress</th></tr></thead><tbody>{workOrders.map((order) => <tr key={order.id}><td><div className="cell-main mono">{order.number}</div></td><td><div className="cell-main">{order.vehicle} · {order.registration}</div><div className="cell-sub">{order.customer}</div></td><td><StatusPill label={order.status} tone={tones[order.status]} /></td><td>{order.advisor}</td><td className="mono">{order.promise}</td><td><StatusPill label={order.risk} tone={order.risk === "quarantine" ? "red" : order.risk === "restricted" ? "amber" : "gray"} /></td><td style={{ minWidth: 120 }}><div className="cell-sub mono">{order.progress}%</div><div className="progress-track"><div className="progress-fill" style={{ width: `${order.progress}%` }} /></div></td></tr>)}</tbody></table></div></section></>;
}
