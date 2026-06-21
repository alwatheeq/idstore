import { supabase } from "@/lib/supabase";
import { getDefaultBranchId } from "@/lib/branch";
import { lineTotalForPayload } from "./lineMath";
import type { ServiceOrder, ServiceOrderLine, InspectionMedia, OrderStatus, OrderListRow, OrderDetailRow } from "./types";
import type { IntakePayload, LinePayload } from "./schema";

const BUCKET = "inspection-media";

export async function listOrders(status?: OrderStatus): Promise<OrderListRow[]> {
  let q = supabase.from("service_orders")
    .select("*, customers(name), vehicles(plate_number, model)")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
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
export async function createOrder(payload: IntakePayload): Promise<ServiceOrder> {
  const branch_id = await getDefaultBranchId();
  const { data, error } = await supabase.from("service_orders")
    .insert({ ...payload, branch_id, status: "intake" }).select().single();
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
export async function createLine(orderId: string, payload: LinePayload): Promise<ServiceOrderLine> {
  const line_total = lineTotalForPayload(payload);
  const { data, error } = await supabase.from("service_order_lines")
    .insert({ ...payload, service_order_id: orderId, line_total }).select().single();
  if (error) throw error;
  return data as ServiceOrderLine;
}
export async function updateLine(id: string, payload: LinePayload): Promise<ServiceOrderLine> {
  const line_total = lineTotalForPayload(payload);
  const { data, error } = await supabase.from("service_order_lines")
    .update({ ...payload, line_total }).eq("id", id).select().single();
  if (error) throw error;
  return data as ServiceOrderLine;
}
export async function deleteLine(id: string): Promise<void> {
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
