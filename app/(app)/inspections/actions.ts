"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalText } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export async function saveInspectionWorkflow(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const staff = await getCurrentStaff();
  const action = formText(formData, "workflowAction");
  if (!["assign", "generate", "record", "exception", "review", "configure"].includes(action)) return { error: "Invalid inspection action" };
  const data: Record<string, Json> = {};
  const rules: Record<string, Json> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$") || ["workflowAction", "inspectionId"].includes(key)) continue;
    if (key.startsWith("rule.")) { rules[key.slice(5)] = value || null; }
    else data[key] = value;
  }
  if (action === "assign") {
    data.groups = formData.getAll("groups").map(String);
    data.capabilities = formData.getAll("capabilities").map(String).filter(value => ["ac", "dc"].includes(value));
  }
  if (action === "generate") data.ids = formData.getAll("ids").map(String);
  if (action === "configure") {
    if (["hv", "soh"].includes(String(rules.capability ?? "")) || rules.qualification) return { error: "Outside maintenance scope" };
    rules.groups = formData.getAll("rule.groups").map(String);
    rules.baseline = formData.get("rule.baseline") === "on";
    rules.evidence_required = formData.get("rule.evidence_required") === "on";
    data.rules = rules;
    data.is_required = formData.get("is_required") === "on";
  }
  try {
    const supabase = await createClient();
    const { error } = action === "configure"
      ? await supabase.rpc("configure_inspection_check", { p_organization_id: staff.organizationId, p_data: data })
      : await supabase.rpc("inspection_workflow", { p_inspection_id: formText(formData, "inspectionId"), p_action: action, p_data: data });
    if (error) return { error: operationError(error, "The inspection could not be saved.") };
  } catch (error) { return { error: operationError(error, "The inspection could not be saved.") }; }
  revalidatePath("/inspections"); revalidatePath("/work-orders"); revalidatePath("/vehicles");
  return { success: true };
}

function inspectionRoute(inspectionId: string | undefined, key: "created" | "error", message: string) {
  const params = new URLSearchParams({ [key]: message });
  if (inspectionId) params.set("inspection", inspectionId);
  return `/inspections?${params.toString()}${inspectionId ? "#inspection-workspace" : ""}`;
}

export async function createInspection(formData: FormData) {
  await getCurrentStaff();
  const repairOrderId = formText(formData, "repairOrderId");
  if (!repairOrderId) redirect(inspectionRoute(undefined, "error", "Choose a repair order to inspect."));
  let inspectionId = "";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_inspection", { p_repair_order_id: repairOrderId });
    if (error || !data) throw error ?? new Error("Inspection was not created.");
    inspectionId = data.id;
  } catch (error) {
    redirect(inspectionRoute(undefined, "error", operationError(error, "The inspection could not be started.")));
  }
  revalidatePath("/inspections"); revalidatePath("/dashboard");
  redirect(inspectionRoute(inspectionId, "created", "Inspection started."));
}

export async function addInspectionItem(formData: FormData) {
  await getCurrentStaff();
  const inspectionId = formText(formData, "inspectionId");
  const checkLabel = formText(formData, "checkLabel");
  const result = formText(formData, "result");
  const severity = optionalText(formData, "severity") ?? "";
  if (!inspectionId || !checkLabel || !["pass", "warn", "fail", "not_applicable"].includes(result)) {
    redirect(inspectionRoute(inspectionId || undefined, "error", "Check name and result are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_inspection_item", {
      p_inspection_id: inspectionId, p_check_label: checkLabel, p_result: result,
      p_finding_text: optionalText(formData, "findingText") ?? "",
      p_customer_text: optionalText(formData, "customerText") ?? "",
      p_severity: severity, p_measurement: optionalText(formData, "measurement") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(inspectionRoute(inspectionId, "error", operationError(error, "The inspection check could not be saved.")));
  }
  revalidatePath("/inspections"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(inspectionRoute(inspectionId, "created", "Inspection check saved."));
}

export async function addInspectionCatalogItems(formData: FormData) {
  await getCurrentStaff();
  const inspectionId = formText(formData, "inspectionId");
  const definitionIds = Array.from(new Set(formData.getAll("checkDefinitionId").filter((value): value is string => typeof value === "string" && value.length > 0)));
  const items = definitionIds.map((definitionId) => ({
    definition_id: definitionId,
    result: formText(formData, `checkResult:${definitionId}`),
  }));
  if (!inspectionId || !items.length || items.length > 50 || items.some((item) => !["pass", "not_applicable"].includes(item.result))) {
    redirect(inspectionRoute(inspectionId || undefined, "error", "Choose between 1 and 50 valid inspection checks."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_inspection_catalog_items", { p_inspection_id: inspectionId, p_items: items });
    if (error) throw error;
  } catch (error) {
    redirect(inspectionRoute(inspectionId, "error", operationError(error, "The selected inspection checks could not be saved.")));
  }
  revalidatePath("/inspections"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(inspectionRoute(inspectionId, "created", "Inspection checks saved."));
}

export async function createInspectionCheckDefinition(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect(inspectionRoute(undefined, "error", "Only an administrator can manage inspection checks."));
  const code = formText(formData, "code").toUpperCase();
  const category = formText(formData, "category");
  const labelEn = formText(formData, "labelEn");
  const labelAr = formText(formData, "labelAr");
  const sortOrder = Number(formText(formData, "sortOrder"));
  if (!code || !labelEn || !labelAr || !Number.isSafeInteger(sortOrder)) {
    redirect(inspectionRoute(undefined, "error", "Code, English label, Arabic label and display order are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_inspection_check_definition", {
      p_organization_id: staff.organizationId,
      p_vehicle_model_id: optionalText(formData, "vehicleModelId") ?? null,
      p_code: code,
      p_category: category,
      p_label_en: labelEn,
      p_label_ar: labelAr,
      p_is_required: formData.get("isRequired") === "on",
      p_sort_order: sortOrder,
    });
    if (error) throw error;
  } catch (error) {
    redirect(`/inspections?setup=1&error=${encodeURIComponent(operationError(error, "The inspection check could not be added."))}#check-catalog`);
  }
  revalidatePath("/inspections");
  redirect("/inspections?setup=1&created=Inspection+check+added.#check-catalog");
}

export async function removeInspectionItem(formData: FormData) {
  await getCurrentStaff();
  const inspectionId = formText(formData, "inspectionId");
  const inspectionItemId = formText(formData, "inspectionItemId");
  if (!inspectionId || !inspectionItemId) redirect(inspectionRoute(inspectionId || undefined, "error", "Inspection check is invalid."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_inspection_item", { p_inspection_item_id: inspectionItemId });
    if (error) throw error;
  } catch (error) {
    redirect(inspectionRoute(inspectionId, "error", operationError(error, "The inspection check could not be removed.")));
  }
  revalidatePath("/inspections");
  redirect(inspectionRoute(inspectionId, "created", "Inspection check removed."));
}

export async function completeInspection(formData: FormData) {
  await getCurrentStaff();
  const inspectionId = formText(formData, "inspectionId");
  if (!inspectionId) redirect(inspectionRoute(undefined, "error", "Inspection is invalid."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("complete_inspection", { p_inspection_id: inspectionId });
    if (error) throw error;
  } catch (error) {
    redirect(inspectionRoute(inspectionId, "error", operationError(error, "The inspection could not be completed.")));
  }
  revalidatePath("/inspections"); revalidatePath("/dashboard");
  redirect(inspectionRoute(inspectionId, "created", "Inspection completed and locked."));
}
