import { Download, Plus, Users } from "lucide-react";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { SearchFilters } from "@/components/search-filters";
import { customers } from "@/lib/demo-data";

export default function CustomersPage() {
  return <><PageHeader eyebrow="Customer management" title="Customers" description="A single customer record across branches, vehicles, consent history, visits, estimates and invoices."><button className="button"><Download /> Export</button><button className="button primary"><Plus /> Add customer</button></PageHeader>
    <MetricStrip metrics={[{ label: "Active customers", value: "1,284", note: "+38 this month", noteTone: "good", icon: Users },{ label: "Fleet accounts", value: "23", note: "214 managed vehicles", icon: Users },{ label: "Returning rate", value: "72%", note: "+4.2% over 90 days", noteTone: "good", icon: Users },{ label: "Consent complete", value: "96.8%", note: "41 records to review", noteTone: "warn", icon: Users }]} />
    <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search name, mobile or account…" filters={["All cities", "All customer types"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Vehicles</th><th>Last visit</th><th className="align-right">Lifetime value</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><div className="cell-main">{customer.name}</div><div className="cell-sub mono">{customer.id.toUpperCase()}</div></td><td className="mono">{customer.phone}</td><td>{customer.city}</td><td className="mono">{customer.vehicles}</td><td>{customer.lastVisit}</td><td className="align-right cell-main mono">{customer.value}</td></tr>)}</tbody></table></div></section></>;
}
