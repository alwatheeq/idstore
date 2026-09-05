"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff, resolveOperatingBranch } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MIME_TYPES = new Set(["application/pdf", "application/json", "application/octet-stream", "text/plain", "image/jpeg", "image/png", "image/webp"]);
const TARGETS = {
  vehicle: { bucket: "vehicle-media" },
  repair_order: { bucket: "vehicle-media" },
  inspection: { bucket: "vehicle-media" },
  diagnostic_session: { bucket: "diagnostics" },
  battery_health_report: { bucket: "diagnostics" },
  invoice: { bucket: "documents" },
} as const;

type TargetType = keyof typeof TARGETS;

function safeFileName(value: string) {
  const cleaned = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "evidence").slice(-120);
}

export async function uploadEvidence(formData: FormData) {
  const staff = await getCurrentStaff();
  const linkedType = formText(formData, "linkedType") as TargetType;
  const linkedId = formText(formData, "linkedId");
  const classification = formText(formData, "classification");
  const file = formData.get("file");
  const target = TARGETS[linkedType];
  if (!target || !linkedId || !["internal", "confidential", "restricted"].includes(classification) || !(file instanceof File) || file.size < 1) {
    redirect(routeMessage("/records", "error", "Choose a valid record, classification and evidence file."));
  }
  const mimeType = file.type || "application/octet-stream";
  if (file.size > MAX_FILE_BYTES || !MIME_TYPES.has(mimeType)) {
    redirect(routeMessage("/records", "error", "Files must be PDF, JSON, text, JPEG, PNG, WebP or binary evidence up to 50 MB."));
  }

  const supabase = await createClient();
  let record: { organization_id: string; branch_id: string | null } | null = null;
  let recordError: unknown;
  if (linkedType === "vehicle") {
    const result = await supabase.from("vehicles").select("organization_id").eq("id", linkedId).maybeSingle();
    record = result.data ? { organization_id: result.data.organization_id, branch_id: null } : null; recordError = result.error;
  } else if (linkedType === "repair_order") {
    const result = await supabase.from("repair_orders").select("organization_id, branch_id").eq("id", linkedId).maybeSingle(); record = result.data; recordError = result.error;
  } else if (linkedType === "inspection") {
    const result = await supabase.from("inspections").select("organization_id, branch_id").eq("id", linkedId).maybeSingle(); record = result.data; recordError = result.error;
  } else if (linkedType === "diagnostic_session") {
    const result = await supabase.from("diagnostic_sessions").select("organization_id, branch_id").eq("id", linkedId).maybeSingle(); record = result.data; recordError = result.error;
  } else if (linkedType === "battery_health_report") {
    const result = await supabase.from("battery_health_reports").select("organization_id, branch_id").eq("id", linkedId).maybeSingle(); record = result.data; recordError = result.error;
  } else {
    const result = await supabase.from("invoices").select("organization_id, branch_id").eq("id", linkedId).maybeSingle(); record = result.data; recordError = result.error;
  }
  if (recordError || !record || record.organization_id !== staff.organizationId) {
    redirect(routeMessage("/records", "error", "The selected record is unavailable in your organization."));
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: duplicate } = await supabase.from("attachments").select("id").eq("organization_id", staff.organizationId).eq("sha256", sha256).eq("linked_type", linkedType).eq("linked_id", linkedId).maybeSingle();
  if (duplicate) redirect(routeMessage("/records", "created", "That evidence is already registered on this record."));

  const objectPath = `${staff.organizationId}/${linkedType}/${linkedId}/${randomUUID()}-${safeFileName(file.name)}`;
  let uploaded = false;
  try {
    const upload = await supabase.storage.from(target.bucket).upload(objectPath, bytes, { contentType: mimeType, upsert: false });
    if (upload.error) throw upload.error;
    uploaded = true;
    const { data: attachment, error } = await supabase.rpc("register_attachment", {
      p_organization_id: staff.organizationId,
      p_branch_id: record.branch_id,
      p_bucket: target.bucket,
      p_object_path: objectPath,
      p_sha256: sha256,
      p_mime_type: mimeType,
      p_size_bytes: file.size,
      p_classification: classification,
      p_linked_type: linkedType,
      p_linked_id: linkedId,
    });
    if (error || !attachment) throw error ?? new Error("Evidence registration failed.");
    if (attachment.object_path !== objectPath) await supabase.storage.from(target.bucket).remove([objectPath]);
  } catch (error) {
    if (uploaded) await supabase.storage.from(target.bucket).remove([objectPath]);
    redirect(routeMessage("/records", "error", operationError(error, "The evidence file could not be secured.")));
  }
  revalidatePath("/records");
  revalidatePath("/diagnostics");
  redirect(routeMessage("/records", "created", "Evidence uploaded, checksummed and registered."));
}

export async function queueCustomerMessage(formData: FormData) {
  const staff = await getCurrentStaff();
  const customerId = formText(formData, "customerId");
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const templateCode = formText(formData, "templateCode");
  const channel = formText(formData, "channel");
  const dedupeKey = formText(formData, "dedupeKey");
  if (!customerId || !branchId || !templateCode || !dedupeKey || !["email", "sms", "whatsapp", "push"].includes(channel)) {
    redirect(routeMessage("/records", "error", "Customer, branch, channel, template and business reference are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("queue_customer_message", {
      p_customer_id: customerId,
      p_branch_id: branchId,
      p_template_code: templateCode,
      p_template_version: 1,
      p_channel: channel,
      p_dedupe_key: dedupeKey,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/records", "error", operationError(error, "The customer message could not be queued.")));
  }
  revalidatePath("/records");
  redirect(routeMessage("/records", "created", "Customer message queued with an idempotent delivery event."));
}
