import { CircleDollarSign, Download, FileCheck2, Plus } from "lucide-react";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { SearchFilters } from "@/components/search-filters";
import { StatusPill } from "@/components/status-pill";
import { invoices } from "@/lib/demo-data";

const statusTone = { paid: "green", partially_paid: "amber", posted: "blue", draft: "gray" } as const;
const eInvoiceTone = { accepted: "green", queued: "amber", rejected: "red", not_submitted: "gray" } as const;

export default function InvoicesPage() {
  return <><PageHeader eyebrow="Billing & tax" title="Invoices" description="Branch-numbered invoices, payments, credit notes and electronic fiscal submission status."><button className="button"><Download /> Export ledger</button><button className="button primary"><Plus /> New invoice</button></PageHeader>
    <MetricStrip metrics={[{ label: "Revenue this month", value: "JOD 94.7k", note: "+9.8% month over month", noteTone: "good", icon: CircleDollarSign },{ label: "Outstanding", value: "JOD 12.4k", note: "37 open invoices", noteTone: "warn", icon: CircleDollarSign },{ label: "Collected today", value: "JOD 4.8k", note: "19 payments", noteTone: "good", icon: CircleDollarSign },{ label: "E-invoice success", value: "99.2%", note: "1 item needs review", noteTone: "warn", icon: FileCheck2 }]} />
    <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search invoice, customer or work order…" filters={["All branches", "All payment states", "E-invoice status"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Branch</th><th>Date</th><th>Status</th><th>E-invoice</th><th className="align-right">Total</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td className="cell-main mono">{invoice.number}</td><td>{invoice.customer}</td><td>{invoice.branch}</td><td>{invoice.date}</td><td><StatusPill label={invoice.status} tone={statusTone[invoice.status]} /></td><td><StatusPill label={invoice.eInvoice} tone={eInvoiceTone[invoice.eInvoice]} /></td><td className="align-right cell-main mono">{invoice.amount}</td></tr>)}</tbody></table></div></section></>;
}
