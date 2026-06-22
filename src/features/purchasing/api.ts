import { supabase } from "@/lib/supabase";
import { createMovement } from "@/features/inventory/api";
import type { PurchaseOrder, POListRow, PODetail, POStatus } from "./types";
import type { POPayload, POLinePayload } from "./schema";

const num = (v: unknown): number => Number(v ?? 0);

export async function listPurchaseOrders(branchId: string | null): Promise<POListRow[]> {
  let q = supabase
    .from("purchase_orders")
    .select("*, suppliers(name)")
    .order("created_at", { ascending: false });
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as POListRow[];
}

export async function getPurchaseOrder(id: string): Promise<PODetail | null> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name), purchase_order_lines(*, inventory_items(name, sku, unit))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const po = data as unknown as PODetail;
  po.purchase_order_lines = (po.purchase_order_lines ?? []).map((l) => ({
    ...l,
    quantity: num(l.quantity),
    unit_cost: num(l.unit_cost),
    received_qty: num(l.received_qty),
  }));
  return po;
}

export async function createPurchaseOrder(branchId: string, payload: POPayload): Promise<PurchaseOrder> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({ ...payload, branch_id: branchId, status: "draft" })
    .select()
    .single();
  if (error) throw error;
  return data as PurchaseOrder;
}

export async function setPurchaseOrderStatus(id: string, status: POStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "ordered") patch.ordered_at = new Date().toISOString();
  if (status === "received") patch.received_at = new Date().toISOString();
  const { error } = await supabase.from("purchase_orders").update(patch).eq("id", id);
  if (error) throw error;
}

export async function addPurchaseOrderLine(poId: string, payload: POLinePayload): Promise<void> {
  const { error } = await supabase
    .from("purchase_order_lines")
    .insert({ po_id: poId, item_id: payload.item_id, quantity: payload.quantity, unit_cost: payload.unit_cost });
  if (error) throw error;
}

export async function deletePurchaseOrderLine(id: string): Promise<void> {
  const { error } = await supabase.from("purchase_order_lines").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Receive all outstanding quantity: post a receive-movement per line (which the
 * inventory trigger applies to stock), mark each line fully received, and close
 * the PO. Not a single DB transaction — acceptable for this workflow.
 */
export async function receivePurchaseOrder(po: PODetail): Promise<void> {
  for (const line of po.purchase_order_lines) {
    const outstanding = line.quantity - line.received_qty;
    if (outstanding <= 0) continue;
    await createMovement({
      itemId: line.item_id,
      branchId: po.branch_id,
      type: "receive",
      quantityDelta: outstanding,
      unitCost: line.unit_cost,
      reference: `PO #${po.po_number}`,
    });
    const { error } = await supabase
      .from("purchase_order_lines")
      .update({ received_qty: line.quantity })
      .eq("id", line.id);
    if (error) throw error;
  }
  await setPurchaseOrderStatus(po.id, "received");
}
