export type POStatus = "draft" | "ordered" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  branch_id: string;
  supplier_id: string | null;
  po_number: number;
  status: POStatus;
  reference: string | null;
  notes: string | null;
  created_at: string;
  ordered_at: string | null;
  received_at: string | null;
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  received_qty: number;
}

export type POListRow = PurchaseOrder & { suppliers: { name: string } | null };

export type POLineRow = PurchaseOrderLine & {
  inventory_items: { name: string; sku: string | null; unit: string } | null;
};

export type PODetail = PurchaseOrder & {
  suppliers: { name: string } | null;
  purchase_order_lines: POLineRow[];
};
