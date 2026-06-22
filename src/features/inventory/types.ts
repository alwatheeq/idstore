export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string;
  cost: number;
  sale_price: number;
  reorder_level: number;
  supplier_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Catalog item joined with on-hand quantity for the active branch (or summed for "All"). */
export interface ItemWithStock extends InventoryItem {
  quantity: number;
}

export type MovementType =
  | "receive"
  | "issue"
  | "adjust"
  | "transfer_in"
  | "transfer_out"
  | "count";

export interface InventoryMovement {
  id: string;
  branch_id: string;
  item_id: string;
  type: MovementType;
  quantity_delta: number;
  unit_cost: number | null;
  reference: string | null;
  service_order_id: string | null;
  to_branch_id: string | null;
  created_at: string;
}
