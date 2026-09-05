import Link from "next/link";
import { PackageCheck, Plus, ShoppingCart, Truck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  addPurchaseOrderLine,
  createPurchaseOrder,
  createSupplier,
  receivePurchaseOrderLine,
  transitionPurchaseOrder,
} from "./actions";

type PageQuery = { new?: "supplier" | "order"; line?: string; receive?: string; created?: string; error?: string };
type PillTone = "blue" | "green" | "amber" | "red" | "gray";

const money = new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD" });
const dateTime = new Intl.DateTimeFormat("en-JO", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });
const stages = ["draft", "submitted", "confirmed", "partially_received", "received", "closed"];

function statusTone(status: string): PillTone {
  if (["received", "closed", "posted"].includes(status)) return "green";
  if (["partially_received", "submitted"].includes(status)) return "amber";
  if (status === "cancelled") return "gray";
  return "blue";
}

function purchaseOrderActions(status: string) {
  const map: Record<string, { value: string; label: string }[]> = {
    draft: [{ value: "submitted", label: "Submit" }, { value: "cancelled", label: "Cancel" }],
    submitted: [{ value: "confirmed", label: "Confirm" }, { value: "draft", label: "Return to draft" }, { value: "cancelled", label: "Cancel" }],
    confirmed: [{ value: "cancelled", label: "Cancel" }],
    partially_received: [{ value: "closed", label: "Close short" }],
    received: [{ value: "closed", label: "Close order" }],
  };
  return map[status] ?? [];
}

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: branches }, { data: suppliers }, { data: parts }, { data: bins }, { data: orders, error }, { data: receipts }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("suppliers").select("id, name, tax_number, phone, email, status").eq("organization_id", staff.organizationId).eq("status", "active").order("name"),
    supabase.from("parts").select("id, part_number, description_en, tracking").eq("organization_id", staff.organizationId).eq("status", "active").order("part_number"),
    supabase.from("bins").select("id, code, bin_type, branch_id, branch:branches(code, city), warehouse:warehouses(name)").eq("organization_id", staff.organizationId).eq("status", "active").in("bin_type", ["receiving", "storage"]).order("code"),
    supabase.from("purchase_orders").select("id, po_number, status, currency, subtotal, tax_total, grand_total, ordered_at, created_at, branch_id, supplier:suppliers(name), branch:branches(code, city), purchase_order_lines(id, line_no, part_id, ordered_quantity, received_quantity, unit_cost, tax_rate, part:parts(part_number, description_en, tracking))").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }),
    supabase.from("goods_receipts").select("id, receipt_number, status, supplier_document_no, received_at, purchase_order:purchase_orders(po_number), goods_receipt_lines(id, quantity, unit_cost, lot:stock_lots(supplier_lot, serial_no), purchase_order_line:purchase_order_lines(part:parts(part_number)))").eq("organization_id", staff.organizationId).order("received_at", { ascending: false }).limit(25),
  ]);

  const setupReady = Boolean(branches?.length && suppliers?.length && parts?.length);
  const allLines = (orders ?? []).flatMap((order) => order.purchase_order_lines.map((line) => ({ ...line, order })));
  const selectedLine = allLines.find((line) => line.id === query.receive);
  const lineOrder = orders?.find((order) => order.id === query.line);
  const receivingBins = bins?.filter((bin) => bin.branch_id === selectedLine?.order.branch_id) ?? [];
  const openOrders = (orders ?? []).filter((order) => !["closed", "cancelled"].includes(order.status));
  const outstandingValue = openOrders.reduce((total, order) => total + order.purchase_order_lines.reduce(
    (lineTotal, line) => lineTotal + Math.max(0, Number(line.ordered_quantity) - Number(line.received_quantity)) * Number(line.unit_cost), 0,
  ), 0);
  const awaitingReceipt = openOrders.filter((order) => ["confirmed", "partially_received"].includes(order.status)).length;

  return <>
    <PageHeader eyebrow="Supply chain" title="Purchasing" description="Issue branch purchase orders and receive every part into a traceable stock lot and immutable ledger entry.">
      <Link className="button" href="/purchasing?new=supplier#new-supplier"><Plus /> Add supplier</Link>
      {setupReady ? <Link className="button primary" href="/purchasing?new=order#new-order"><ShoppingCart /> New purchase order</Link> : null}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Purchasing records could not be loaded." : undefined)} />

    {query.new === "supplier" ? <section className="panel operation-form" id="new-supplier">
      <div className="panel-header"><div><div className="panel-title">Add a supplier</div><div className="panel-subtitle">Create the trading partner before raising a purchase order.</div></div><Link className="panel-link" href="/purchasing">Cancel</Link></div>
      <form action={createSupplier} className="form-grid panel-body">
        <div className="form-field form-span-2"><label htmlFor="supplier-name">Supplier name</label><input id="supplier-name" name="name" required /></div>
        <div className="form-field"><label htmlFor="supplier-tax">Tax number</label><input className="mono" id="supplier-tax" name="taxNumber" /></div>
        <div className="form-field"><label htmlFor="supplier-phone">Phone</label><input id="supplier-phone" name="phone" type="tel" /></div>
        <div className="form-field form-span-2"><label htmlFor="supplier-email">Email</label><input id="supplier-email" name="email" type="email" /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/purchasing">Cancel</Link><button className="button primary" type="submit">Create supplier</button></div>
      </form>
    </section> : null}

    {query.new === "order" && setupReady ? <section className="panel operation-form" id="new-order">
      <div className="panel-header"><div><div className="panel-title">Create a purchase order</div><div className="panel-subtitle">The first line starts a draft; add more lines before submitting.</div></div><Link className="panel-link" href="/purchasing">Cancel</Link></div>
      <form action={createPurchaseOrder} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="po-branch">Receiving branch</label><select id="po-branch" name="branchId" defaultValue={staff.selectedBranchId ?? ""} required><option value="">Select branch</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="po-supplier">Supplier</label><select id="po-supplier" name="supplierId" required><option value="">Select supplier</option>{suppliers?.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
        <div className="form-field form-span-2"><label htmlFor="po-part">First part</label><select id="po-part" name="partId" required><option value="">Select part</option>{parts?.map((part) => <option key={part.id} value={part.id}>{part.part_number} · {part.description_en} · {part.tracking}</option>)}</select></div>
        <div className="form-field"><label htmlFor="po-quantity">Quantity</label><input id="po-quantity" name="quantity" type="number" min="0.001" step="0.001" required /></div>
        <div className="form-field"><label htmlFor="po-cost">Unit cost (JOD)</label><input id="po-cost" name="unitCost" type="number" min="0" step="0.001" required /></div>
        <div className="form-field"><label htmlFor="po-tax">Tax rate (%)</label><input id="po-tax" name="taxRate" type="number" min="0" max="100" step="0.0001" defaultValue="16" required /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/purchasing">Cancel</Link><button className="button primary" type="submit">Create draft</button></div>
      </form>
    </section> : null}

    {lineOrder?.status === "draft" ? <section className="panel operation-form" id="add-line">
      <div className="panel-header"><div><div className="panel-title">Add line to {lineOrder.po_number}</div><div className="panel-subtitle">Draft totals recalculate immediately.</div></div><Link className="panel-link" href="/purchasing">Cancel</Link></div>
      <form action={addPurchaseOrderLine} className="form-grid panel-body">
        <input type="hidden" name="purchaseOrderId" value={lineOrder.id} />
        <div className="form-field form-span-2"><label htmlFor="line-part">Part</label><select id="line-part" name="partId" required><option value="">Select part</option>{parts?.map((part) => <option key={part.id} value={part.id}>{part.part_number} · {part.description_en}</option>)}</select></div>
        <div className="form-field"><label htmlFor="line-quantity">Quantity</label><input id="line-quantity" name="quantity" type="number" min="0.001" step="0.001" required /></div>
        <div className="form-field"><label htmlFor="line-cost">Unit cost (JOD)</label><input id="line-cost" name="unitCost" type="number" min="0" step="0.001" required /></div>
        <div className="form-field"><label htmlFor="line-tax">Tax rate (%)</label><input id="line-tax" name="taxRate" type="number" min="0" max="100" step="0.0001" defaultValue="16" required /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/purchasing">Cancel</Link><button className="button primary" type="submit">Add line</button></div>
      </form>
    </section> : null}

    {selectedLine && ["confirmed", "partially_received"].includes(selectedLine.order.status) ? <section className="panel operation-form" id="receive-line">
      <div className="panel-header"><div><div className="panel-title">Receive {selectedLine.part?.part_number}</div><div className="panel-subtitle">{selectedLine.order.po_number} has {(Number(selectedLine.ordered_quantity) - Number(selectedLine.received_quantity)).toLocaleString()} outstanding · tracking: {selectedLine.part?.tracking}</div></div><Link className="panel-link" href="/purchasing">Cancel</Link></div>
      <form action={receivePurchaseOrderLine} className="form-grid panel-body">
        <input type="hidden" name="lineId" value={selectedLine.id} />
        <div className="form-field"><label htmlFor="receipt-bin">Destination bin</label><select id="receipt-bin" name="destinationBinId" required><option value="">Select bin</option>{receivingBins.map((bin) => <option key={bin.id} value={bin.id}>{bin.branch?.city} · {bin.warehouse?.name} · {bin.code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="receipt-quantity">Received quantity</label><input id="receipt-quantity" name="quantity" type="number" min="0.001" max={Number(selectedLine.ordered_quantity) - Number(selectedLine.received_quantity)} step={selectedLine.part?.tracking === "serial" ? "1" : "0.001"} defaultValue={selectedLine.part?.tracking === "serial" ? 1 : Number(selectedLine.ordered_quantity) - Number(selectedLine.received_quantity)} required /></div>
        <div className="form-field"><label htmlFor="receipt-document">Supplier document</label><input className="mono" id="receipt-document" name="supplierDocumentNo" /></div>
        <div className="form-field"><label htmlFor="receipt-lot">Supplier lot</label><input className="mono" id="receipt-lot" name="supplierLot" required={selectedLine.part?.tracking === "lot"} disabled={selectedLine.part?.tracking === "none"} /></div>
        <div className="form-field"><label htmlFor="receipt-serial">Serial number</label><input className="mono" id="receipt-serial" name="serialNo" required={selectedLine.part?.tracking === "serial"} disabled={selectedLine.part?.tracking !== "serial"} /></div>
        <div className="form-field"><label htmlFor="receipt-expiry">Expiry date</label><input id="receipt-expiry" name="expiryDate" type="date" disabled={selectedLine.part?.tracking === "none"} /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/purchasing">Cancel</Link><button className="button primary" type="submit">Post goods receipt</button></div>
      </form>
    </section> : null}

    <MetricStrip metrics={[
      { label: "Open purchase orders", value: String(openOrders.length), note: "Across accessible branches", icon: ShoppingCart },
      { label: "Awaiting receipt", value: String(awaitingReceipt), note: "Confirmed or partially received", noteTone: awaitingReceipt ? "warn" : "good", icon: Truck },
      { label: "Outstanding value", value: money.format(outstandingValue), note: "Before tax", icon: ShoppingCart },
      { label: "Posted receipts", value: String(receipts?.length ?? 0), note: "Latest receiving documents", icon: PackageCheck },
    ]} />

    {!orders?.length ? <EmptyState icon={ShoppingCart} title="No purchase orders" description={!branches?.length ? "Create a branch before ordering parts." : !parts?.length ? "Add catalog parts before ordering stock." : !suppliers?.length ? "Add the first supplier to start purchasing." : "Create a draft purchase order for the next supplier delivery."} action={!suppliers?.length ? <Link className="button primary" href="/purchasing?new=supplier#new-supplier">Add first supplier</Link> : setupReady ? <Link className="button primary" href="/purchasing?new=order#new-order">Create purchase order</Link> : undefined} /> : <div className="stack">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Purchase-order control</div><div className="panel-subtitle">Order state and commercial totals</div></div></div><div className="data-scroll"><table className="data-table purchase-order-ledger"><thead><tr><th>Purchase order</th><th>Supplier</th><th>Branch</th><th>Status rail</th><th className="align-right">Total</th><th>Next action</th></tr></thead><tbody>{orders.map((order) => {
        const currentStage = stages.indexOf(order.status);
        return <tr key={order.id}><td><div className="cell-main mono">{order.po_number}</div><div className="cell-sub">{order.purchase_order_lines.length} line{order.purchase_order_lines.length === 1 ? "" : "s"} · {order.ordered_at ? `sent ${dateTime.format(new Date(order.ordered_at))}` : "not submitted"}</div></td><td className="cell-main">{order.supplier?.name}</td><td>{order.branch?.city} · {order.branch?.code}</td><td><div className="po-state"><StatusPill label={order.status} tone={statusTone(order.status)} /><div className="po-rail" aria-label={`Purchase order status ${order.status}`}>{stages.slice(0, 5).map((stage, index) => <span className={order.status !== "cancelled" && index <= currentStage ? "complete" : ""} key={stage} />)}</div></div></td><td className="align-right"><div className="cell-main mono">{money.format(Number(order.grand_total))}</div><div className="cell-sub">Tax {money.format(Number(order.tax_total))}</div></td><td><div className="inline-actions">{order.status === "draft" ? <Link className="button compact" href={`/purchasing?line=${order.id}#add-line`}>Add line</Link> : null}{purchaseOrderActions(order.status).map((action, index) => <form action={transitionPurchaseOrder} key={action.value}><input type="hidden" name="purchaseOrderId" value={order.id} /><input type="hidden" name="toStatus" value={action.value} /><button className={`button compact ${index === 0 ? "primary" : ""}`} type="submit">{action.label}</button></form>)}</div></td></tr>;
      })}</tbody></table></div></section>

      <section className="panel"><div className="panel-header"><div><div className="panel-title">Receiving rail</div><div className="panel-subtitle">Ordered, received and outstanding quantities by part</div></div></div><div className="data-scroll"><table className="data-table receiving-ledger"><thead><tr><th>PO / line</th><th>Part</th><th>Tracking</th><th>Quantity rail</th><th className="align-right">Unit cost</th><th>Receive</th></tr></thead><tbody>{allLines.map((line) => {
        const ordered = Number(line.ordered_quantity);
        const received = Number(line.received_quantity);
        const outstanding = Math.max(0, ordered - received);
        const percentage = ordered ? Math.min(100, received / ordered * 100) : 0;
        const canReceive = outstanding > 0 && ["confirmed", "partially_received"].includes(line.order.status);
        return <tr key={line.id}><td><div className="cell-main mono">{line.order.po_number}</div><div className="cell-sub">Line {line.line_no}</div></td><td><div className="cell-main mono">{line.part?.part_number}</div><div className="cell-sub">{line.part?.description_en}</div></td><td><StatusPill label={line.part?.tracking ?? "none"} tone={line.part?.tracking === "serial" ? "red" : line.part?.tracking === "lot" ? "amber" : "gray"} /></td><td><div className="quantity-copy"><span>{received.toLocaleString()} received</span><strong>{outstanding.toLocaleString()} due</strong></div><div className="receiving-track"><div className="receiving-fill" style={{ width: `${percentage}%` }} /></div><div className="cell-sub">Ordered {ordered.toLocaleString()}</div></td><td className="align-right mono">{money.format(Number(line.unit_cost))}</td><td>{canReceive ? <Link className="button compact primary" href={`/purchasing?receive=${line.id}#receive-line`}>Receive</Link> : line.order.status === "draft" || line.order.status === "submitted" ? <span className="cell-sub">Confirm PO first</span> : <StatusPill label={outstanding === 0 ? "complete" : line.order.status} tone={outstanding === 0 ? "green" : "gray"} />}</td></tr>;
      })}</tbody></table></div></section>

      <section className="panel"><div className="panel-header"><div><div className="panel-title">Goods receipt ledger</div><div className="panel-subtitle">Latest 25 posted receiving documents</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Receipt</th><th>Purchase order</th><th>Part</th><th>Trace</th><th>Quantity</th><th className="align-right">Value</th></tr></thead><tbody>{(receipts ?? []).flatMap((receipt) => receipt.goods_receipt_lines.map((line) => <tr key={line.id}><td><div className="cell-main mono">{receipt.receipt_number}</div><div className="cell-sub">{dateTime.format(new Date(receipt.received_at))}</div></td><td><div className="cell-main mono">{receipt.purchase_order?.po_number}</div><div className="cell-sub">{receipt.supplier_document_no ?? "No supplier reference"}</div></td><td className="mono">{line.purchase_order_line?.part?.part_number}</td><td className="mono">{line.lot?.serial_no ?? line.lot?.supplier_lot ?? "Not tracked"}</td><td className="mono">{Number(line.quantity).toLocaleString()}</td><td className="align-right mono">{money.format(Number(line.quantity) * Number(line.unit_cost))}</td></tr>))}{!receipts?.length ? <tr><td colSpan={6}><div className="table-empty">No goods receipts posted.</div></td></tr> : null}</tbody></table></div></section>
    </div>}
  </>;
}
