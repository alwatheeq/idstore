import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/read-all";
import { SubmissionKey } from "@/components/submission-key";
import { manageOrderStock } from "@/app/(app)/work-orders/stock-actions";

export async function OrderStock({ orderId, branchId, status }: { orderId: string; branchId: string; status: string }) {
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const canManage = (staff.role === "admin" || staff.permissionCodes.includes("inventory.manage")) && (!staff.selectedBranchId || staff.selectedBranchId === branchId);
  const active = !["ready", "delivered", "closed", "cancelled"].includes(status);
  const [stock, reservations] = await Promise.all([
    readAll(supabase.from("stock_balances").select("id, on_hand, reserved, part:parts(part_number, description_en), bin:bins(code), lot:stock_lots(serial_no, supplier_lot)").eq("organization_id", staff.organizationId).eq("branch_id", branchId)),
    readAll(supabase.from("order_stock").select("id, stock_balance_id, quantity, returned_quantity, status, version").eq("organization_id", staff.organizationId).eq("repair_order_id", orderId)),
  ]);
  const label = (id: string) => { const b = stock.data.find(row => row.id === id); return b ? `${b.part?.part_number} · ${b.bin?.code}${b.lot ? ` · ${b.lot.serial_no ?? b.lot.supplier_lot}` : ""}` : id; };
  return <section className="panel" id="order-stock"><div className="panel-header"><div><div className="panel-title">Workshop stock</div><div className="panel-subtitle">Reserve parts, issue them to this order, and record unused returns.</div></div></div><div className="panel-body stack">
    {canManage && active ? <form action={manageOrderStock} className="form-grid"><SubmissionKey /><input type="hidden" name="repairOrderId" value={orderId}/><input type="hidden" name="stockAction" value="reserve"/>
      <div className="form-field"><label htmlFor="order-stock-balance">Available part and bin</label><select id="order-stock-balance" name="balanceId" required><option value="">Select stock</option>{stock.data.filter(b => b.on_hand > b.reserved).map(b => <option key={b.id} value={b.id}>{label(b.id)} · {b.on_hand-b.reserved}</option>)}</select></div>
      <div className="form-field"><label htmlFor="order-stock-quantity">Quantity</label><input id="order-stock-quantity" name="quantity" type="number" min="0.001" step="0.001" required/></div><div className="form-actions"><button className="button" type="submit">Reserve parts</button></div>
    </form> : null}
    {reservations.data.map(row => <article key={row.id} className="stack"><strong>{label(row.stock_balance_id)}</strong><span>{row.status} · {row.quantity} · Returned: {row.returned_quantity}</span>
      {canManage && row.status === "reserved" ? <div className="inline-actions">{(active ? ["issue", "release"] : ["release"]).map(action => <form key={action} action={manageOrderStock}><SubmissionKey /><input type="hidden" name="repairOrderId" value={orderId}/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="version" value={row.version}/><input type="hidden" name="stockAction" value={action}/><button className="button compact" type="submit">{action === "issue" ? "Issue parts" : "Release reservation"}</button></form>)}</div> : null}
      {canManage && row.status === "issued" && row.returned_quantity < row.quantity ? <form action={manageOrderStock} className="inline-actions"><SubmissionKey /><input type="hidden" name="repairOrderId" value={orderId}/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="version" value={row.version}/><input type="hidden" name="stockAction" value="return"/><label htmlFor={`return-${row.id}`}>Unused quantity</label><input id={`return-${row.id}`} name="quantity" type="number" min="0.001" max={row.quantity-row.returned_quantity} step="0.001" required/><button className="button compact" type="submit">Return unused parts</button></form> : null}
    </article>)}
    {!reservations.data.length ? <p>No parts reserved or issued for this order.</p> : null}
  </div></section>;
}
