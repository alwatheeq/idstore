"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalText } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function inspectionRoute(inspectionId: string | undefined, key: "created" | "error", message: string) {
  const params = new URLSearchParams({ [key]: message });
  if (inspectionId) params.set("inspection", inspectionId);
  return `/inspections?${params.toString()}${inspectionId ? "#inspection-workspace" : ""}`;
}

export async function createInspection(formData: FormData) {
  await getCurrentStaff();
  const repairOrderId = formText(formData, "repairOrderId");
  if (!repairOrderId) redirect(inspectionRoute(undefined, "error", "Choose a repair order to inspect."));
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_inspection", { p_repair_order_id: repairOrderId });
    if (error || !data) throw error ?? new Error("Inspection was not created.");
    revalidatePath("/inspections"); revalidatePath("/dashboard");
    redirect(inspectionRoute(data.id, "created", "Inspection started."));
  } catch (error) {
    redirect(inspectionRoute(undefined, "error", operationError(error, "The inspection could not be started.")));
  }
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
