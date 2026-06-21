export type OrderStatus =
  | "appointment" | "intake" | "diagnosis" | "estimate" | "awaiting_approval"
  | "in_progress" | "qc" | "ready" | "closed" | "cancelled";
export type LineType = "service" | "part" | "fee";
export type DiscountType = "none" | "amount" | "percent";

export interface ServiceOrder {
  id: string; branch_id: string; vehicle_id: string; customer_id: string;
  order_number: number; status: OrderStatus;
  odometer_at_intake: number | null; charge_percent: number | null;
  hv_battery_state: string | null; reported_concerns: string | null; intake_notes: string | null;
  approved_at: string | null; approved_by: string | null; closed_at: string | null;
  next_service_due_date: string | null; next_service_due_odometer: number | null;
  created_at: string; updated_at: string;
}
export interface ServiceOrderLine {
  id: string; service_order_id: string; line_type: LineType; description: string;
  quantity: number; unit_price: number; discount_type: DiscountType; discount_value: number;
  line_total: number; created_at: string;
}
export type OrderListRow = ServiceOrder & {
  customers: { name: string } | null;
  vehicles: { plate_number: string | null; model: string | null } | null;
};
export interface InspectionMedia {
  id: string; service_order_id: string; media_type: "photo" | "video";
  storage_path: string; caption: string | null; created_at: string;
}
export type OrderDetailRow = ServiceOrder & {
  customers: { name: string; phone: string | null; email: string | null } | null;
  vehicles: { model: string | null; plate_number: string | null; vin: string | null } | null;
};
