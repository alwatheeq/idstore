import Link from "next/link";
import { Banknote, CircleDollarSign, FileCheck2, Printer, Plus, ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addInvoiceLine, createInvoice, postInvoice, receivePayment, removeInvoiceLine } from "./actions";

type PageQuery = { new?: string; line?: string; pay?: string; created?: string; error?: string };
type PillTone = "blue" | "green" | "amber" | "red" | "gray";

const money = new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD" });
const dateTime = new Intl.DateTimeFormat("en-JO", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" });
const monthKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Amman" });

function statusTone(status: string): PillTone {
  if (status === "paid") return "green";
  if (status === "partially_paid") return "amber";
  if (status === "posted") return "blue";
  if (status === "credited") return "red";
  return "gray";
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: repairOrders }, { data: invoices, error }, { data: payments }] = await Promise.all([
    supabase.from("repair_orders").select("id, ro_number, status, customer:customers(display_name), vehicle:vehicles(registration_no, model:vehicle_models(name)), branch:branches(city, code)").eq("organization_id", staff.organizationId).neq("status", "cancelled").order("opened_at", { ascending: false }),
    supabase.from("invoices").select("id, invoice_number, status, currency, subtotal, discount_total, tax_total, grand_total, paid_total, posted_at, created_at, version, repair_order_id, customer:customers(display_name), branch:branches(city, code), repair_order:repair_orders(ro_number), invoice_lines(id, line_no, line_type, description_snapshot, quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total), payment_allocations(amount, payment:payments(receipt_number, method, received_at, provider_ref, status))").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }),
    supabase.from("payments").select("id, receipt_number, method, amount, currency, provider_ref, status, received_at, payment_allocations(amount, invoice:invoices(invoice_number, repair_order:repair_orders(ro_number), customer:customers(display_name)))").eq("organization_id", staff.organizationId).order("received_at", { ascending: false }).limit(40),
  ]);

  const invoicedOrderIds = new Set((invoices ?? []).map((invoice) => invoice.repair_order_id).filter(Boolean));
  const eligibleOrders = (repairOrders ?? []).filter((order) => !invoicedOrderIds.has(order.id));
  const selectedDraft = invoices?.find((invoice) => invoice.id === query.line && invoice.status === "draft");
  const selectedPayable = invoices?.find((invoice) => invoice.id === query.pay && ["posted", "partially_paid"].includes(invoice.status));
  const openInvoices = (invoices ?? []).filter((invoice) => ["posted", "partially_paid"].includes(invoice.status));
  const outstanding = openInvoices.reduce((total, invoice) => total + Number(invoice.grand_total) - Number(invoice.paid_total), 0);
  const now = new Date();
  const currentMonth = monthKey.format(now);
  const monthRevenue = (invoices ?? []).filter((invoice) => invoice.posted_at && ["posted", "partially_paid", "paid"].includes(invoice.status) && monthKey.format(new Date(invoice.posted_at)) === currentMonth).reduce((total, invoice) => total + Number(invoice.grand_total), 0);
  const today = dayKey.format(now);
  const collectedToday = (payments ?? []).filter((payment) => dayKey.format(new Date(payment.received_at)) === today && payment.status === "received").reduce((total, payment) => total + Number(payment.amount), 0);

  return <>
    <PageHeader eyebrow="Billing & tax" title="Invoices" description="Build the service invoice, lock its commercial snapshot at posting, and allocate branch payments against the exact balance.">
      {eligibleOrders.length ? <Link className="button primary" href="/invoices?new=1#new-invoice"><Plus /> New invoice</Link> : null}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Invoice records could not be loaded." : undefined)} />

    {query.new === "1" && eligibleOrders.length ? <section className="panel operation-form" id="new-invoice">
      <div className="panel-header"><div><div className="panel-title">Create a draft invoice</div><div className="panel-subtitle">Seller and customer identity are snapshotted from the selected repair order.</div></div><Link className="panel-link" href="/invoices">Cancel</Link></div>
      <form action={createInvoice} className="form-grid panel-body">
        <div className="form-field form-span-2"><label htmlFor="invoice-order">Repair order</label><select id="invoice-order" name="repairOrderId" required><option value="">Select repair order</option>{eligibleOrders.map((order) => <option key={order.id} value={order.id}>{order.ro_number} · {order.customer?.display_name} · {order.vehicle?.model?.name ?? "Volkswagen ID"} {order.vehicle?.registration_no ?? ""} · {order.branch?.city}</option>)}</select></div>
        <div className="form-actions form-span-2"><Link className="button" href="/invoices">Cancel</Link><button className="button primary" type="submit">Create draft</button></div>
      </form>
    </section> : null}

    {selectedDraft ? <section className="panel operation-form" id="add-line">
      <div className="panel-header"><div><div className="panel-title">Add line to {selectedDraft.repair_order?.ro_number}</div><div className="panel-subtitle">Tax is calculated on the line value after discount, rounded to three decimals.</div></div><Link className="panel-link" href="/invoices">Cancel</Link></div>
      <form action={addInvoiceLine} className="form-grid panel-body">
        <input type="hidden" name="invoiceId" value={selectedDraft.id} /><input type="hidden" name="version" value={selectedDraft.version} />
        <div className="form-field"><label htmlFor="invoice-line-type">Line type</label><select id="invoice-line-type" name="lineType" defaultValue="labor"><option value="labor">Labor</option><option value="part">Part</option><option value="fee">Fee</option><option value="warranty">Warranty</option><option value="goodwill">Goodwill</option></select></div>
        <div className="form-field form-span-2"><label htmlFor="invoice-description">Description</label><input id="invoice-description" name="description" required /></div>
        <div className="form-field"><label htmlFor="invoice-quantity">Quantity</label><input id="invoice-quantity" name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></div>
        <div className="form-field"><label htmlFor="invoice-price">Unit price (JOD)</label><input id="invoice-price" name="unitPrice" type="number" min="0" step="0.001" required /></div>
        <div className="form-field"><label htmlFor="invoice-discount">Line discount (JOD)</label><input id="invoice-discount" name="discountAmount" type="number" min="0" step="0.001" defaultValue="0" required /></div>
        <div className="form-field"><label htmlFor="invoice-tax">Tax rate (%)</label><input id="invoice-tax" name="taxRate" type="number" min="0" max="100" step="0.0001" defaultValue="16" required /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/invoices">Cancel</Link><button className="button primary" type="submit">Add invoice line</button></div>
      </form>
    </section> : null}

    {selectedPayable ? <section className="panel operation-form" id="receive-payment">
      <div className="panel-header"><div><div className="panel-title">Receive payment for {selectedPayable.invoice_number}</div><div className="panel-subtitle">Outstanding balance: {money.format(Number(selectedPayable.grand_total) - Number(selectedPayable.paid_total))}</div></div><Link className="panel-link" href="/invoices">Cancel</Link></div>
      <form action={receivePayment} className="form-grid panel-body">
        <input type="hidden" name="invoiceId" value={selectedPayable.id} />
        <div className="form-field"><label htmlFor="payment-amount">Amount (JOD)</label><input id="payment-amount" name="amount" type="number" min="0.001" max={Number(selectedPayable.grand_total) - Number(selectedPayable.paid_total)} step="0.001" defaultValue={Number(selectedPayable.grand_total) - Number(selectedPayable.paid_total)} required /></div>
        <div className="form-field"><label htmlFor="payment-method">Method</label><select id="payment-method" name="method" defaultValue="card"><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="payment_link">Payment link</option><option value="fleet_account">Fleet account</option><option value="other">Other</option></select></div>
        <div className="form-field form-span-2"><label htmlFor="payment-reference">Provider reference</label><input className="mono" id="payment-reference" name="providerRef" /><span className="field-help">Use the terminal, bank, link or fleet reference when available.</span></div>
        <div className="form-actions form-span-2"><Link className="button" href="/invoices">Cancel</Link><button className="button primary" type="submit">Receive payment</button></div>
      </form>
    </section> : null}

    <MetricStrip metrics={[
      { label: "Posted this month", value: money.format(monthRevenue), note: "Gross invoice value", icon: CircleDollarSign },
      { label: "Outstanding", value: money.format(outstanding), note: `${openInvoices.length} open invoice${openInvoices.length === 1 ? "" : "s"}`, noteTone: outstanding ? "warn" : "good", icon: CircleDollarSign },
      { label: "Collected today", value: money.format(collectedToday), note: "Received payments", noteTone: collectedToday ? "good" : undefined, icon: Banknote },
      { label: "Draft documents", value: String((invoices ?? []).filter((invoice) => invoice.status === "draft").length), note: "Not yet fiscal documents", icon: FileCheck2 },
    ]} />

    {!invoices?.length ? <EmptyState icon={ReceiptText} title="No invoices" description={eligibleOrders.length ? "Create the first draft from a repair order, then add the approved labor and parts." : "Open a repair order before creating its service invoice."} action={eligibleOrders.length ? <Link className="button primary" href="/invoices?new=1#new-invoice">Create first invoice</Link> : <Link className="button primary" href="/work-orders?new=1#new-work-order">Open work order</Link>} /> : <div className="stack">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Invoice control</div><div className="panel-subtitle">Drafts remain editable; posting fixes the document number, identity snapshot and commercial values.</div></div></div><div className="data-scroll"><table className="data-table invoice-ledger"><thead><tr><th>Invoice / work order</th><th>Customer</th><th>Branch</th><th>Status</th><th>Document balance</th><th>Fiscal adapter</th><th>Action</th></tr></thead><tbody>{invoices.map((invoice) => {
        const total = Number(invoice.grand_total);
        const paid = Number(invoice.paid_total);
        const due = Math.max(0, total - paid);
        const paidPercent = total ? Math.min(100, paid / total * 100) : 0;
        return <tr key={invoice.id}><td><div className="cell-main mono">{invoice.invoice_number ?? "Draft"}</div><div className="cell-sub mono">{invoice.repair_order?.ro_number}</div></td><td className="cell-main">{invoice.customer?.display_name}</td><td>{invoice.branch?.city} · {invoice.branch?.code}</td><td><StatusPill label={invoice.status} tone={statusTone(invoice.status)} /></td><td><div className="invoice-balance-copy"><span>Total {money.format(total)}</span><strong>{money.format(due)} due</strong></div><div className="invoice-balance-track"><div className="invoice-balance-paid" style={{ width: `${paidPercent}%` }} /></div><div className="cell-sub">Subtotal {money.format(Number(invoice.subtotal))} · tax {money.format(Number(invoice.tax_total))} · paid {money.format(paid)}</div></td><td>{invoice.status === "draft" ? <StatusPill label="not queued" tone="gray" /> : <StatusPill label="adapter pending" tone="amber" />}</td><td><div className="inline-actions"><a className="button compact" href={`/api/documents/invoice/${invoice.id}`} target="_blank" rel="noreferrer"><Printer /> Print</a>{invoice.status === "draft" ? <><Link className="button compact" href={`/invoices?line=${invoice.id}#add-line`}>Add line</Link>{invoice.invoice_lines.length ? <form action={postInvoice}><input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="version" value={invoice.version} /><button className="button compact primary" type="submit">Post invoice</button></form> : null}</> : ["posted", "partially_paid"].includes(invoice.status) ? <Link className="button compact primary" href={`/invoices?pay=${invoice.id}#receive-payment`}>Receive payment</Link> : null}</div></td></tr>;
      })}</tbody></table></div></section>

      <section className="panel"><div className="panel-header"><div><div className="panel-title">Invoice line ledger</div><div className="panel-subtitle">Calculated line values and locked tax snapshots</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Invoice</th><th>Line</th><th>Description</th><th>Quantity</th><th className="align-right">Gross</th><th className="align-right">Discount</th><th className="align-right">Tax</th><th className="align-right">Total</th><th></th></tr></thead><tbody>{invoices.flatMap((invoice) => invoice.invoice_lines.map((line) => <tr key={line.id}><td className="mono">{invoice.invoice_number ?? invoice.repair_order?.ro_number}</td><td><div className="cell-main">{line.line_type}</div><div className="cell-sub">#{line.line_no}</div></td><td>{line.description_snapshot}</td><td className="mono">{Number(line.quantity).toLocaleString()}</td><td className="align-right mono">{money.format(Number(line.quantity) * Number(line.unit_price))}</td><td className="align-right mono">{money.format(Number(line.discount_amount))}</td><td className="align-right"><div className="cell-main mono">{money.format(Number(line.tax_amount))}</div><div className="cell-sub">{Number(line.tax_rate)}%</div></td><td className="align-right cell-main mono">{money.format(Number(line.line_total))}</td><td>{invoice.status === "draft" ? <form action={removeInvoiceLine}><input type="hidden" name="invoiceLineId" value={line.id} /><input type="hidden" name="version" value={invoice.version} /><button className="button compact" type="submit">Remove</button></form> : null}</td></tr>))}{!(invoices ?? []).some((invoice) => invoice.invoice_lines.length) ? <tr><td colSpan={9}><div className="table-empty">No invoice lines yet. Add the first line to a draft.</div></td></tr> : null}</tbody></table></div></section>

      <section className="panel"><div className="panel-header"><div><div className="panel-title">Payment allocation ledger</div><div className="panel-subtitle">Latest 40 branch receipts and their invoice allocation</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Receipt</th><th>Received</th><th>Invoice / customer</th><th>Method</th><th>Provider reference</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{(payments ?? []).map((payment) => {
        const allocation = payment.payment_allocations[0];
        return <tr key={payment.id}><td className="cell-main mono">{payment.receipt_number}</td><td className="nowrap">{dateTime.format(new Date(payment.received_at))}</td><td><div className="cell-main mono">{allocation?.invoice?.invoice_number ?? allocation?.invoice?.repair_order?.ro_number}</div><div className="cell-sub">{allocation?.invoice?.customer?.display_name}</div></td><td><StatusPill label={payment.method} tone="blue" /></td><td className="mono">{payment.provider_ref ?? "—"}</td><td><StatusPill label={payment.status} tone={payment.status === "received" ? "green" : "gray"} /></td><td className="align-right cell-main mono">{money.format(Number(allocation?.amount ?? payment.amount))}</td></tr>;
      })}{!payments?.length ? <tr><td colSpan={7}><div className="table-empty">No payments received.</div></td></tr> : null}</tbody></table></div></section>
    </div>}
  </>;
}
