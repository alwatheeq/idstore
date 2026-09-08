import { LocalizedContent } from "@/components/localized-content";
import { SubmissionKey } from "@/components/submission-key";
import { MasterRecordActions } from "@/components/master-record-actions"; import { RecordAction } from "@/components/record-action"; import Link from "next/link";
import { AlertTriangle, Boxes, Plus } from "lucide-react";
import { BranchField } from "@/components/branch-field";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { configurePartCatalog, createPart, postInventoryMovement, recordInventoryDisposition } from "./actions";

type PageQuery = { new?: "part" | "movement"; catalog?: string; dispose?: string; created?: string; error?: string };

const money = new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD" });
const dateTime = new Intl.DateTimeFormat("en-JO", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });

export default async function InventoryPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: branches }, { data: parts }, { data: bins }, { data: balances, error }, { data: movements }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("parts").select("id, part_number, description_en, unit, tracking, hazardous_classification, sale_price, status, part_barcodes(barcode, barcode_type, is_primary), old_part:part_supersessions!part_supersessions_old_part_id_fkey(new_part:parts!part_supersessions_new_part_id_fkey(part_number)), part_alternatives!part_alternatives_part_id_fkey(alternative_part:parts!part_alternatives_alternative_part_id_fkey(part_number))").eq("organization_id", staff.organizationId).in("status", ["active", "superseded"]).order("part_number"),
    supabase.from("bins").select("id, code, bin_type, branch_id, branch:branches(code, city), warehouse:warehouses(name)").eq("organization_id", staff.organizationId).eq("status", "active").order("code"),
    supabase.from("stock_balances").select("id, part_id, bin_id, branch_id, lot_id, on_hand, reserved, average_cost, part:parts(part_number, description_en, unit), bin:bins(code), lot:stock_lots(supplier_lot, serial_no), branch:branches(code, city)").eq("organization_id", staff.organizationId).order("updated_at", { ascending: false }),
    supabase.from("stock_movements").select("id, quantity, unit_cost, movement_type, posted_at, part:parts(part_number), from_bin:bins!stock_movements_from_bin_id_fkey(code), to_bin:bins!stock_movements_to_bin_id_fkey(code), branch:branches(code, city)").eq("organization_id", staff.organizationId).order("posted_at", { ascending: false }).limit(25),
  ]);

  const stockValue = (balances ?? []).reduce((total, balance) => total + Number(balance.on_hand) * Number(balance.average_cost), 0);
  const reservedValue = (balances ?? []).reduce((total, balance) => total + Number(balance.reserved) * Number(balance.average_cost), 0);
  const outOfStock = (parts ?? []).filter((part) => !(balances ?? []).some((balance) => balance.part_id === part.id && Number(balance.on_hand) > 0)).length;
  const activeBins = bins?.length ?? 0;
  const showPartForm = query.new === "part" || (Boolean(query.error) && !parts?.length);
  const showMovementForm = query.new === "movement" && Boolean(parts?.length && bins?.length);
  const catalogPart = parts?.find((part) => part.id === query.catalog);
  const dispositionBalance = balances?.find((balance) => balance.id === query.dispose);

  return <LocalizedContent>{<>
    <PageHeader eyebrow="Parts operations" title="Inventory" description="Maintain the branch parts catalog and post every receipt or adjustment to the immutable movement ledger.">
      {branches?.length ? <Link className="button" href="/inventory?new=part#new-part"><Plus /> Add part</Link> : <Link className="button" href="/branches?new=1#new-branch"><Plus /> Create a branch first</Link>}
      {parts?.length && bins?.length ? <Link className="button primary" href="/inventory?new=movement#new-movement"><Plus /> Post stock movement</Link> : null}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Inventory records could not be loaded." : undefined)} />

    {showPartForm && branches?.length ? <section className="panel operation-form" id="new-part">
      <div className="panel-header"><div><div className="panel-title">Add a catalog part</div><div className="panel-subtitle">The first part also initializes standard stock, receiving, quarantine and returns bins.</div></div><Link className="panel-link" href="/inventory">Cancel</Link></div>
      <form action={createPart} className="form-grid panel-body">
        <BranchField id="part-branch" label="Setup branch" branches={branches} selectedBranchId={staff.selectedBranchId} />
        <div className="form-field"><label htmlFor="part-number">Part number</label><input className="mono" id="part-number" name="partNumber" required /></div>
        <div className="form-field form-span-2"><label htmlFor="part-description">English description</label><input id="part-description" name="description" required /></div>
        <div className="form-field"><label htmlFor="part-unit">Stock unit</label><select id="part-unit" name="unit" defaultValue="ea"><option value="ea">Each</option><option value="l">Litre</option><option value="kg">Kilogram</option><option value="set">Set</option></select></div>
        <div className="form-field"><label htmlFor="part-tracking">Traceability</label><select id="part-tracking" name="tracking" defaultValue="none"><option value="none">Standard stock</option><option value="lot">Supplier lot</option><option value="serial">Individual serial</option></select></div>
        <div className="form-field"><label htmlFor="part-price">Sale price (JOD)</label><input id="part-price" name="salePrice" type="number" min="0" step="0.001" required /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/inventory">Cancel</Link><button className="button primary" type="submit">Create part</button></div>
      </form>
    </section> : null}

    {showMovementForm ? <section className="panel operation-form" id="new-movement">
      <div className="panel-header"><div><div className="panel-title">Post a stock movement</div><div className="panel-subtitle">Receipts and gains add stock; losses use the current moving-average cost.</div></div><Link className="panel-link" href="/inventory">Cancel</Link></div>
      <form action={postInventoryMovement} className="form-grid panel-body"><SubmissionKey />
        <div className="form-field"><label htmlFor="movement-part">Part</label><select id="movement-part" name="partId" required><option value="">Select part</option>{parts?.filter((part) => part.tracking === "none").map((part) => <option key={part.id} value={part.id}>{part.part_number} · {part.description_en}</option>)}</select><span className="field-help">Lot and serial workflows will be added with purchasing.</span></div>
        <div className="form-field"><label htmlFor="movement-bin">Branch bin</label><select id="movement-bin" name="binId" required><option value="">Select bin</option>{bins?.filter((bin) => !staff.selectedBranchId || bin.branch_id === staff.selectedBranchId).map((bin) => <option key={bin.id} value={bin.id}>{bin.branch?.city} · {bin.warehouse?.name} · {bin.code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="movement-type">Movement</label><select id="movement-type" name="movementType" defaultValue="receipt"><option value="receipt">Receive stock</option><option value="adjustment_gain">Adjustment gain</option><option value="adjustment_loss">Adjustment loss</option></select></div>
        <div className="form-field"><label htmlFor="movement-quantity">Quantity</label><input id="movement-quantity" name="quantity" type="number" min="0.001" step="0.001" required /></div>
        <div className="form-field"><label htmlFor="movement-cost">Unit cost (JOD)</label><input id="movement-cost" name="unitCost" type="number" min="0" step="0.001" required /><span className="field-help">Ignored for a loss; the recorded average cost is used.</span></div>
        <div className="form-actions form-span-2"><Link className="button" href="/inventory">Cancel</Link><button className="button primary" type="submit">Post movement</button></div>
      </form>
    </section> : null}

    {catalogPart && staff.role === "admin" ? <section className="panel operation-form" id="catalog-controls"><div className="panel-header"><div><div className="panel-title">Catalog governance · {catalogPart.part_number}</div><div className="panel-subtitle">Add scan identity, dangerous-goods classification, supersession or an approved alternative.</div></div><Link className="panel-link" href="/inventory">Cancel</Link></div><form action={configurePartCatalog} className="form-grid panel-body"><input type="hidden" name="partId" value={catalogPart.id}/><div className="form-field"><label htmlFor="hazard">Hazard classification</label><input id="hazard" name="hazardousClassification" defaultValue={catalogPart.hazardous_classification ?? ""} placeholder="e.g. UN3480"/></div><div className="form-field"><label htmlFor="barcode">Barcode</label><input className="mono" id="barcode" name="barcode"/></div><div className="form-field"><label htmlFor="barcode-type">Barcode type</label><select id="barcode-type" name="barcodeType" defaultValue="code128"><option value="ean13">EAN-13</option><option value="upc">UPC</option><option value="code128">Code 128</option><option value="qr">QR</option><option value="other">Other</option></select></div><div className="form-field"><label htmlFor="related-part">Related part</label><select id="related-part" name="relatedPartId"><option value="">No relationship</option>{parts?.filter(part=>part.id!==catalogPart.id).map(part=><option key={part.id} value={part.id}>{part.part_number} · {part.description_en}</option>)}</select></div><div className="form-field"><label htmlFor="relationship">Relationship</label><select id="relationship" name="relationship"><option value="alternative">Approved alternative</option><option value="superseded_by">Superseded by</option></select></div><div className="form-field form-span-2"><label htmlFor="catalog-notes">Source / notes</label><input id="catalog-notes" name="notes"/></div><div className="form-actions form-span-2"><button className="button primary" type="submit">Save catalog controls</button></div></form></section> : null}

    {dispositionBalance ? <section className="panel operation-form" id="stock-disposition"><div className="panel-header"><div><div className="panel-title">Dispose {dispositionBalance.part?.part_number}</div><div className="panel-subtitle">Available {(Number(dispositionBalance.on_hand)-Number(dispositionBalance.reserved)).toLocaleString()} · {dispositionBalance.bin?.code}</div></div><Link className="panel-link" href="/inventory">Cancel</Link></div><form action={recordInventoryDisposition} className="form-grid panel-body"><SubmissionKey /><input type="hidden" name="stockBalanceId" value={dispositionBalance.id}/><div className="form-field"><label htmlFor="disposition-type">Disposition</label><select id="disposition-type" name="dispositionType"><option value="supplier_return">Return to supplier</option><option value="scrap">Scrap</option></select></div><div className="form-field"><label htmlFor="disposition-quantity">Quantity</label><input id="disposition-quantity" name="quantity" type="number" min="0.001" max={Number(dispositionBalance.on_hand)-Number(dispositionBalance.reserved)} step="0.001" required/></div><div className="form-field"><label htmlFor="supplier-reference">Supplier reference</label><input id="supplier-reference" name="supplierReference"/></div><div className="form-field form-span-2"><label htmlFor="disposition-reason">Required reason</label><textarea id="disposition-reason" name="reason" rows={2} required/></div><div className="form-actions form-span-2"><button className="button primary" type="submit">Post disposition</button></div></form></section> : null}

    <MetricStrip metrics={[
      { label: "Stock value", value: money.format(stockValue), note: "Moving-average valuation", icon: Boxes },
      { label: "Catalog parts", value: String(parts?.length ?? 0), note: "Active part numbers", icon: Boxes },
      { label: "Out of stock", value: String(outOfStock), note: "No positive balance", noteTone: outOfStock ? "warn" : "good", icon: AlertTriangle },
      { label: "Reserved value", value: money.format(reservedValue), note: `${activeBins} active bins`, icon: Boxes },
    ]} />

    {!parts?.length ? <EmptyState icon={Boxes} title="No parts in the catalog" description={branches?.length ? "Add the first part to initialize the stockroom and begin receiving inventory." : "Create a service branch before setting up its stockroom."} action={branches?.length ? <Link className="button primary" href="/inventory?new=part#new-part">Add first part</Link> : undefined} /> : <div className="stack">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Branch balances</div><div className="panel-subtitle">Available quantity and moving-average valuation by bin</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Part</th><th>Branch & bin</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Status</th><th className="align-right">Value</th><th></th></tr></thead><tbody>{(balances ?? []).map((balance) => {
        const available = Number(balance.on_hand) - Number(balance.reserved);
        return <tr key={balance.id}><td><div className="cell-main mono">{balance.part?.part_number}</div><div className="cell-sub">{balance.part?.description_en}</div></td><td><div className="cell-main">{balance.branch?.city} · {balance.branch?.code}</div><div className="cell-sub mono">{balance.bin?.code}{balance.lot ? ` · ${balance.lot.serial_no ?? balance.lot.supplier_lot ?? "tracked"}` : ""}</div></td><td className="mono">{Number(balance.on_hand).toLocaleString()}</td><td className="mono">{Number(balance.reserved).toLocaleString()}</td><td className="mono">{available.toLocaleString()}</td><td><StatusPill label={available <= 0 ? "allocated" : "available"} tone={available <= 0 ? "red" : "green"} /></td><td className="align-right cell-main mono">{money.format(Number(balance.on_hand) * Number(balance.average_cost))}</td><td>{available>0?<Link className="button compact" href={`/inventory?dispose=${balance.id}#stock-disposition`}>Return / scrap</Link>:null}</td></tr>;
      })}{!balances?.length ? <tr><td colSpan={8}><div className="table-empty">No balances yet. Post a receipt to put a part into stock.</div></td></tr> : null}</tbody></table></div></section>

      <section className="panel"><div className="panel-header"><div><div className="panel-title">Catalog identity</div>{staff.role === "admin" ? <RecordAction kind="archive" label="Archived records" href="/records/manage?kind=part" /> : null}<div className="panel-subtitle">Barcode, dangerous-goods and approved replacement controls</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Part</th><th>Tracking</th><th>Barcode</th><th>Hazard</th><th>Relationship</th><th></th></tr></thead><tbody>{parts.map(part=><tr key={part.id}><td><div className="cell-main mono">{part.part_number}</div><div className="cell-sub">{part.description_en}</div></td><td><StatusPill label={part.tracking} tone={part.tracking==="serial"?"red":part.tracking==="lot"?"amber":"gray"}/></td><td className="mono">{part.part_barcodes.find(code=>code.is_primary)?.barcode ?? "—"}</td><td>{part.hazardous_classification ?? "—"}</td><td>{part.old_part[0]?.new_part?.part_number ? `Superseded by ${part.old_part[0].new_part.part_number}` : part.part_alternatives[0]?.alternative_part?.part_number ? `Alternative ${part.part_alternatives[0].alternative_part.part_number}` : "—"}</td><td>{staff.role==="admin"?<div className="record-actions"><MasterRecordActions kind="part" id={part.id} /><Link className="button compact" href={`/inventory?catalog=${part.id}#catalog-controls`}>Configure</Link></div>:null}</td></tr>)}</tbody></table></div></section>

      <section className="panel"><div className="panel-header"><div><div className="panel-title">Movement ledger</div><div className="panel-subtitle">Latest 25 posted inventory transactions</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Posted</th><th>Part</th><th>Branch</th><th>Movement</th><th>Route</th><th>Quantity</th><th className="align-right">Unit cost</th></tr></thead><tbody>{(movements ?? []).map((movement) => <tr key={movement.id}><td className="nowrap">{dateTime.format(new Date(movement.posted_at))}</td><td className="cell-main mono">{movement.part?.part_number}</td><td>{movement.branch?.city} · {movement.branch?.code}</td><td><StatusPill label={movement.movement_type} tone={movement.movement_type.includes("loss") || movement.movement_type === "issue" ? "amber" : "blue"} /></td><td className="mono">{movement.from_bin?.code ?? "External"} → {movement.to_bin?.code ?? "External"}</td><td className="mono">{Number(movement.quantity).toLocaleString()}</td><td className="align-right mono">{money.format(Number(movement.unit_cost))}</td></tr>)}{!movements?.length ? <tr><td colSpan={7}><div className="table-empty">No stock movements posted.</div></td></tr> : null}</tbody></table></div></section>
    </div>}
  </>}</LocalizedContent>;
}
