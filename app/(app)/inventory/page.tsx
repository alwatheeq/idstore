import Link from "next/link";
import { AlertTriangle, Boxes, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createPart, postInventoryMovement } from "./actions";

type PageQuery = { new?: "part" | "movement"; created?: string; error?: string };

const money = new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD" });
const dateTime = new Intl.DateTimeFormat("en-JO", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });

export default async function InventoryPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: branches }, { data: parts }, { data: bins }, { data: balances, error }, { data: movements }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("parts").select("id, part_number, description_en, unit, tracking, sale_price, status").eq("organization_id", staff.organizationId).eq("status", "active").order("part_number"),
    supabase.from("bins").select("id, code, bin_type, branch_id, branch:branches(code, city), warehouse:warehouses(name)").eq("organization_id", staff.organizationId).eq("status", "active").order("code"),
    supabase.from("stock_balances").select("id, part_id, bin_id, branch_id, on_hand, reserved, average_cost, part:parts(part_number, description_en, unit), bin:bins(code), branch:branches(code, city)").eq("organization_id", staff.organizationId).order("updated_at", { ascending: false }),
    supabase.from("stock_movements").select("id, quantity, unit_cost, movement_type, posted_at, part:parts(part_number), from_bin:bins!stock_movements_from_bin_id_fkey(code), to_bin:bins!stock_movements_to_bin_id_fkey(code), branch:branches(code, city)").eq("organization_id", staff.organizationId).order("posted_at", { ascending: false }).limit(25),
  ]);

  const stockValue = (balances ?? []).reduce((total, balance) => total + Number(balance.on_hand) * Number(balance.average_cost), 0);
  const reservedValue = (balances ?? []).reduce((total, balance) => total + Number(balance.reserved) * Number(balance.average_cost), 0);
  const outOfStock = (parts ?? []).filter((part) => !(balances ?? []).some((balance) => balance.part_id === part.id && Number(balance.on_hand) > 0)).length;
  const activeBins = bins?.length ?? 0;
  const showPartForm = query.new === "part" || (Boolean(query.error) && !parts?.length);
  const showMovementForm = query.new === "movement" && Boolean(parts?.length && bins?.length);

  return <>
    <PageHeader eyebrow="Parts operations" title="Inventory" description="Maintain the branch parts catalog and post every receipt or adjustment to the immutable movement ledger.">
      {branches?.length ? <Link className="button" href="/inventory?new=part#new-part"><Plus /> Add part</Link> : <Link className="button" href="/branches?new=1#new-branch"><Plus /> Create a branch first</Link>}
      {parts?.length && bins?.length ? <Link className="button primary" href="/inventory?new=movement#new-movement"><Plus /> Post stock movement</Link> : null}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Inventory records could not be loaded." : undefined)} />

    {showPartForm && branches?.length ? <section className="panel operation-form" id="new-part">
      <div className="panel-header"><div><div className="panel-title">Add a catalog part</div><div className="panel-subtitle">The first part also initializes standard stock, receiving, quarantine and returns bins.</div></div><Link className="panel-link" href="/inventory">Cancel</Link></div>
      <form action={createPart} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="part-branch">Setup branch</label><select id="part-branch" name="branchId" required><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
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
      <form action={postInventoryMovement} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="movement-part">Part</label><select id="movement-part" name="partId" required><option value="">Select part</option>{parts?.filter((part) => part.tracking === "none").map((part) => <option key={part.id} value={part.id}>{part.part_number} · {part.description_en}</option>)}</select><span className="field-help">Lot and serial workflows will be added with purchasing.</span></div>
        <div className="form-field"><label htmlFor="movement-bin">Branch bin</label><select id="movement-bin" name="binId" required><option value="">Select bin</option>{bins?.map((bin) => <option key={bin.id} value={bin.id}>{bin.branch?.city} · {bin.warehouse?.name} · {bin.code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="movement-type">Movement</label><select id="movement-type" name="movementType" defaultValue="receipt"><option value="receipt">Receive stock</option><option value="adjustment_gain">Adjustment gain</option><option value="adjustment_loss">Adjustment loss</option></select></div>
        <div className="form-field"><label htmlFor="movement-quantity">Quantity</label><input id="movement-quantity" name="quantity" type="number" min="0.001" step="0.001" required /></div>
        <div className="form-field"><label htmlFor="movement-cost">Unit cost (JOD)</label><input id="movement-cost" name="unitCost" type="number" min="0" step="0.001" required /><span className="field-help">Ignored for a loss; the recorded average cost is used.</span></div>
        <div className="form-actions form-span-2"><Link className="button" href="/inventory">Cancel</Link><button className="button primary" type="submit">Post movement</button></div>
      </form>
    </section> : null}

    <MetricStrip metrics={[
      { label: "Stock value", value: money.format(stockValue), note: "Moving-average valuation", icon: Boxes },
      { label: "Catalog parts", value: String(parts?.length ?? 0), note: "Active part numbers", icon: Boxes },
      { label: "Out of stock", value: String(outOfStock), note: "No positive balance", noteTone: outOfStock ? "warn" : "good", icon: AlertTriangle },
      { label: "Reserved value", value: money.format(reservedValue), note: `${activeBins} active bins`, icon: Boxes },
    ]} />

    {!parts?.length ? <EmptyState icon={Boxes} title="No parts in the catalog" description={branches?.length ? "Add the first part to initialize the stockroom and begin receiving inventory." : "Create a service branch before setting up its stockroom."} action={branches?.length ? <Link className="button primary" href="/inventory?new=part#new-part">Add first part</Link> : undefined} /> : <div className="stack">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Branch balances</div><div className="panel-subtitle">Available quantity and moving-average valuation by bin</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Part</th><th>Branch & bin</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Status</th><th className="align-right">Value</th></tr></thead><tbody>{(balances ?? []).map((balance) => {
        const available = Number(balance.on_hand) - Number(balance.reserved);
        return <tr key={balance.id}><td><div className="cell-main mono">{balance.part?.part_number}</div><div className="cell-sub">{balance.part?.description_en}</div></td><td><div className="cell-main">{balance.branch?.city} · {balance.branch?.code}</div><div className="cell-sub mono">{balance.bin?.code}</div></td><td className="mono">{Number(balance.on_hand).toLocaleString()}</td><td className="mono">{Number(balance.reserved).toLocaleString()}</td><td className="mono">{available.toLocaleString()}</td><td><StatusPill label={available <= 0 ? "allocated" : "available"} tone={available <= 0 ? "red" : "green"} /></td><td className="align-right cell-main mono">{money.format(Number(balance.on_hand) * Number(balance.average_cost))}</td></tr>;
      })}{!balances?.length ? <tr><td colSpan={7}><div className="table-empty">No balances yet. Post a receipt to put a part into stock.</div></td></tr> : null}</tbody></table></div></section>

      <section className="panel"><div className="panel-header"><div><div className="panel-title">Movement ledger</div><div className="panel-subtitle">Latest 25 posted inventory transactions</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Posted</th><th>Part</th><th>Branch</th><th>Movement</th><th>Route</th><th>Quantity</th><th className="align-right">Unit cost</th></tr></thead><tbody>{(movements ?? []).map((movement) => <tr key={movement.id}><td className="nowrap">{dateTime.format(new Date(movement.posted_at))}</td><td className="cell-main mono">{movement.part?.part_number}</td><td>{movement.branch?.city} · {movement.branch?.code}</td><td><StatusPill label={movement.movement_type} tone={movement.movement_type.includes("loss") || movement.movement_type === "issue" ? "amber" : "blue"} /></td><td className="mono">{movement.from_bin?.code ?? "External"} → {movement.to_bin?.code ?? "External"}</td><td className="mono">{Number(movement.quantity).toLocaleString()}</td><td className="align-right mono">{money.format(Number(movement.unit_cost))}</td></tr>)}{!movements?.length ? <tr><td colSpan={7}><div className="table-empty">No stock movements posted.</div></td></tr> : null}</tbody></table></div></section>
    </div>}
  </>;
}
