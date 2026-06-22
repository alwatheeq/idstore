import { supabase } from "@/lib/supabase";
import type {
  InventoryItem,
  ItemWithStock,
  InventoryMovement,
  Supplier,
  MovementType,
} from "./types";
import type { ItemPayload, SupplierPayload } from "./schema";

const num = (v: unknown): number => Number(v ?? 0);

type ItemRow = InventoryItem & { inventory_stock?: { quantity: number; branch_id: string }[] };

function toItemWithStock(row: ItemRow, branchId: string | null): ItemWithStock {
  const rows = row.inventory_stock ?? [];
  const quantity = branchId
    ? num(rows.find((r) => r.branch_id === branchId)?.quantity)
    : rows.reduce((s, r) => s + num(r.quantity), 0);
  const { inventory_stock: _drop, ...item } = row;
  void _drop;
  return {
    ...item,
    cost: num(item.cost),
    sale_price: num(item.sale_price),
    reorder_level: num(item.reorder_level),
    quantity,
  };
}

export async function listItems(branchId: string | null, search?: string): Promise<ItemWithStock[]> {
  let q = supabase
    .from("inventory_items")
    .select("*, inventory_stock(quantity, branch_id)")
    .order("name", { ascending: true });
  if (search?.trim()) q = q.ilike("name", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as ItemRow[]).map((r) => toItemWithStock(r, branchId));
}

export async function getItem(id: string): Promise<InventoryItem | null> {
  const { data, error } = await supabase.from("inventory_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    cost: num(data.cost),
    sale_price: num(data.sale_price),
    reorder_level: num(data.reorder_level),
  } as InventoryItem;
}

export async function itemStock(itemId: string, branchId: string): Promise<number> {
  const { data, error } = await supabase
    .from("inventory_stock")
    .select("quantity")
    .eq("item_id", itemId)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (error) throw error;
  return num(data?.quantity);
}

export async function createItem(payload: ItemPayload): Promise<InventoryItem> {
  const { data, error } = await supabase.from("inventory_items").insert(payload).select().single();
  if (error) throw error;
  return data as InventoryItem;
}

export async function updateItem(id: string, payload: ItemPayload): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from("inventory_items")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as InventoryItem;
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from("suppliers").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data as Supplier[];
}
export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").insert(payload).select().single();
  if (error) throw error;
  return data as Supplier;
}
export async function updateSupplier(id: string, payload: SupplierPayload): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Supplier;
}

export async function listMovements(itemId: string, branchId: string | null): Promise<InventoryMovement[]> {
  let q = supabase
    .from("inventory_movements")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as InventoryMovement[]).map((m) => ({
    ...m,
    quantity_delta: num(m.quantity_delta),
    unit_cost: m.unit_cost == null ? null : num(m.unit_cost),
  }));
}

type MovementInput = {
  itemId: string;
  branchId: string;
  type: MovementType;
  quantityDelta: number;
  unitCost?: number | null;
  reference?: string | null;
  serviceOrderId?: string | null;
  toBranchId?: string | null;
};

export async function createMovement(m: MovementInput): Promise<void> {
  const { error } = await supabase.from("inventory_movements").insert({
    item_id: m.itemId,
    branch_id: m.branchId,
    type: m.type,
    quantity_delta: m.quantityDelta,
    unit_cost: m.unitCost ?? null,
    reference: m.reference ?? null,
    service_order_id: m.serviceOrderId ?? null,
    to_branch_id: m.toBranchId ?? null,
  });
  if (error) throw error;
}

/** Move stock between branches as two ledger rows; the trigger updates each branch. */
export async function transferStock(
  itemId: string,
  fromBranchId: string,
  toBranchId: string,
  quantity: number,
  reference?: string | null,
): Promise<void> {
  await createMovement({
    itemId,
    branchId: fromBranchId,
    type: "transfer_out",
    quantityDelta: -quantity,
    toBranchId,
    reference,
  });
  await createMovement({
    itemId,
    branchId: toBranchId,
    type: "transfer_in",
    quantityDelta: quantity,
    reference,
  });
}
