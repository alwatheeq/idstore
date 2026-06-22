import { supabase } from "@/lib/supabase";
import { lineTotalForPayload } from "./lineMath";
import { createMovement } from "@/features/inventory/api";
import type { ServiceOrder, ServiceOrderLine, InspectionMedia, OrderStatus, OrderListRow, OrderDetailRow } from "./types";
import type { Concern } from "./concerns";
import type { IntakePayload, LinePayload } from "./schema";

const BUCKET = "inspection-media";

export async function listOrders(
  status?: OrderStatus,
  branchId?: string | null,
): Promise<OrderListRow[]> {
  let q = supabase.from("service_orders")
    .select("*, customers(name), vehicles(plate_number, model)")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as OrderListRow[];
}
export async function getOrder(id: string): Promise<OrderDetailRow> {
  const { data, error } = await supabase.from("service_orders")
    .select("*, customers(name, phone, email), vehicles(model, plate_number, vin)")
    .eq("id", id).single();
  if (error) throw error;
  return data as unknown as OrderDetailRow;
}
export async function listOrdersByVehicle(vehicleId: string): Promise<{ id: string; order_number: number }[]> {
  const { data, error } = await supabase.from("service_orders")
    .select("id, order_number").eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as { id: string; order_number: number }[];
}
/** Most recent recorded odometer for a vehicle (from past service orders), or null. */
export async function getLastOdometer(vehicleId: string): Promise<number | null> {
  const { data, error } = await supabase.from("service_orders")
    .select("odometer_at_intake")
    .eq("vehicle_id", vehicleId)
    .not("odometer_at_intake", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.odometer_at_intake as number | null) ?? null;
}
export async function createOrder(payload: IntakePayload, branchId: string): Promise<ServiceOrder> {
  const { data, error } = await supabase.from("service_orders")
    .insert({ ...payload, branch_id: branchId, status: "intake" }).select().single();
  if (error) throw error;
  return data as ServiceOrder;
}
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<ServiceOrder> {
  const patch: Record<string, unknown> = { status };
  if (status === "closed") patch.closed_at = new Date().toISOString();
  const { data, error } = await supabase.from("service_orders").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as ServiceOrder;
}
export async function updateOrderConcerns(id: string, concerns: Concern[]): Promise<ServiceOrder> {
  const { data, error } = await supabase.from("service_orders")
    .update({ concerns }).eq("id", id).select().single();
  if (error) throw error;
  return data as ServiceOrder;
}
export async function approveOrder(id: string, approvedBy: string): Promise<ServiceOrder> {
  const { data, error } = await supabase.from("service_orders")
    .update({ approved_at: new Date().toISOString(), approved_by: approvedBy, status: "in_progress" })
    .eq("id", id).select().single();
  if (error) throw error;
  return data as ServiceOrder;
}
export async function listLines(orderId: string): Promise<ServiceOrderLine[]> {
  const { data, error } = await supabase.from("service_order_lines")
    .select("*").eq("service_order_id", orderId).order("created_at", { ascending: true });
  if (error) throw error;
  return data as ServiceOrderLine[];
}
type ExistingLine = { inventory_item_id: string | null; issued_qty: number; service_order_id: string };

async function loadLine(id: string): Promise<ExistingLine> {
  const { data, error } = await supabase
    .from("service_order_lines")
    .select("inventory_item_id, issued_qty, service_order_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  const d = data as { inventory_item_id: string | null; issued_qty: number; service_order_id: string };
  return { ...d, issued_qty: Number(d.issued_qty) || 0 };
}

export async function createLine(
  orderId: string,
  payload: LinePayload,
  branchId: string,
): Promise<ServiceOrderLine> {
  const line_total = lineTotalForPayload(payload);
  const issued_qty = payload.inventory_item_id ? payload.quantity : 0;
  const { data, error } = await supabase.from("service_order_lines")
    .insert({ ...payload, service_order_id: orderId, line_total, issued_qty }).select().single();
  if (error) throw error;
  if (payload.inventory_item_id) {
    await createMovement({
      itemId: payload.inventory_item_id, branchId, type: "issue",
      quantityDelta: -payload.quantity, reference: "Service order", serviceOrderId: orderId,
    });
  }
  return data as ServiceOrderLine;
}

export async function updateLine(
  id: string,
  payload: LinePayload,
  branchId: string,
): Promise<ServiceOrderLine> {
  const prev = await loadLine(id);
  const oldItem = prev.inventory_item_id;
  const oldIssued = prev.issued_qty;
  const newItem = payload.inventory_item_id;
  const newIssued = newItem ? payload.quantity : 0;

  if (oldItem && newItem && oldItem === newItem) {
    const delta = newIssued - oldIssued; // >0: issue more; <0: return
    if (delta !== 0) {
      await createMovement({
        itemId: newItem, branchId, type: delta > 0 ? "issue" : "adjust",
        quantityDelta: -delta, reference: "Service order", serviceOrderId: prev.service_order_id,
      });
    }
  } else {
    if (oldItem && oldIssued > 0) {
      await createMovement({
        itemId: oldItem, branchId, type: "adjust",
        quantityDelta: oldIssued, reference: "Service order return", serviceOrderId: prev.service_order_id,
      });
    }
    if (newItem) {
      await createMovement({
        itemId: newItem, branchId, type: "issue",
        quantityDelta: -payload.quantity, reference: "Service order", serviceOrderId: prev.service_order_id,
      });
    }
  }

  const line_total = lineTotalForPayload(payload);
  const { data, error } = await supabase.from("service_order_lines")
    .update({ ...payload, line_total, issued_qty: newIssued }).eq("id", id).select().single();
  if (error) throw error;
  return data as ServiceOrderLine;
}

export async function deleteLine(id: string, branchId: string): Promise<void> {
  const prev = await loadLine(id);
  if (prev.inventory_item_id && prev.issued_qty > 0) {
    await createMovement({
      itemId: prev.inventory_item_id, branchId, type: "adjust",
      quantityDelta: prev.issued_qty, reference: "Service order return", serviceOrderId: prev.service_order_id,
    });
  }
  const { error } = await supabase.from("service_order_lines").delete().eq("id", id);
  if (error) throw error;
}
export async function listMedia(orderId: string): Promise<InspectionMedia[]> {
  const { data, error } = await supabase.from("inspection_media")
    .select("*").eq("service_order_id", orderId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as InspectionMedia[];
}
export async function uploadMedia(orderId: string, file: File): Promise<InspectionMedia> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (up.error) throw up.error;
  const media_type = file.type.startsWith("video") ? "video" : "photo";
  const { data, error } = await supabase.from("inspection_media")
    .insert({ service_order_id: orderId, storage_path: path, media_type }).select().single();
  if (error) throw error;
  return data as InspectionMedia;
}
export async function signedMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function deleteMedia(m: InspectionMedia): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([m.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("inspection_media").delete().eq("id", m.id);
  if (error) throw error;
}
