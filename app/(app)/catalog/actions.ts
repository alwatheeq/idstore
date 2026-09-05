"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff, resolveOperatingBranch } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const path = "/catalog";

export async function createServiceTemplate(formData: FormData) {
  const staff = await getCurrentStaff();
  const code = formText(formData, "code").toUpperCase();
  const nameEn = formText(formData, "nameEn");
  const effectiveFrom = formText(formData, "effectiveFrom");
  const intervalMonths = optionalNumber(formData, "intervalMonths");
  const intervalKm = optionalNumber(formData, "intervalKm");
  if (!code || !nameEn || !effectiveFrom || [intervalMonths, intervalKm].some(Number.isNaN)) {
    redirect(routeMessage(path, "error", "Code, English name and effective date are required."));
  }
  try {
    const supabase = await createClient();
    const modelCodes = formText(formData, "modelCodes").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    const { error } = await supabase.rpc("create_service_template", {
      p_organization_id: staff.organizationId, p_code: code, p_name_en: nameEn,
      p_name_ar: optionalText(formData, "nameAr") ?? "", p_market: optionalText(formData, "market") ?? "JO",
      p_effective_from: effectiveFrom, p_interval_months: intervalMonths ?? null, p_interval_km: intervalKm ?? null,
      p_source_uri: optionalText(formData, "sourceUri") ?? "", p_applicability_json: { model_codes: modelCodes },
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "The service template could not be created.")));
  }
  revalidatePath(path);
  redirect(routeMessage(path, "created", "Draft service template created."));
}

export async function addServiceTask(formData: FormData) {
  await getCurrentStaff();
  const versionId = formText(formData, "versionId");
  const taskCode = formText(formData, "taskCode").toUpperCase();
  const descriptionEn = formText(formData, "descriptionEn");
  const minutes = optionalNumber(formData, "standardMinutes");
  const safetyClass = formText(formData, "safetyClass") || "ev_aware";
  if (!versionId || !taskCode || !descriptionEn || minutes === undefined || !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440) {
    redirect(routeMessage(path, "error", "Task code, description and whole standard minutes are required."));
  }
  if (!["normal", "ev_aware", "hv_isolated", "hv_battery_open"].includes(safetyClass)) {
    redirect(routeMessage(path, "error", "Select a valid task safety class."));
  }
  if (["hv_isolated", "hv_battery_open"].includes(safetyClass) && !optionalText(formData, "qualificationCode")) {
    redirect(routeMessage(path, "error", "High-voltage tasks require a qualification code."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_service_template_task", {
      p_version_id: versionId, p_task_code: taskCode, p_description_en: descriptionEn,
      p_description_ar: optionalText(formData, "descriptionAr") ?? "", p_standard_minutes: minutes,
      p_required_permission: optionalText(formData, "requiredPermission") ?? "",
      p_required_qualification_code: optionalText(formData, "qualificationCode") ?? "",
      p_procedure_ref: optionalText(formData, "procedureRef") ?? "",
      p_result_schema: {
        capture: formText(formData, "capture") || "pass_warn_fail",
        safety_class: safetyClass,
      },
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "The template task could not be added.")));
  }
  revalidatePath(path);
  redirect(routeMessage(path, "created", "Service task added."));
}

export async function publishServiceTemplate(formData: FormData) {
  await getCurrentStaff();
  const versionId = formText(formData, "versionId");
  if (!versionId) redirect(routeMessage(path, "error", "Template version is invalid."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("publish_service_template_version", { p_version_id: versionId });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "The template could not be published.")));
  }
  revalidatePath(path);
  redirect(routeMessage(path, "created", "Service template published and locked."));
}

export async function createResource(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const resourceType = formText(formData, "resourceType");
  const code = formText(formData, "code").toUpperCase();
  const name = formText(formData, "name");
  if (!branchId || !code || !name || !["bay", "lift", "charger", "diagnostic_device", "loan_vehicle", "other"].includes(resourceType)) {
    redirect(routeMessage(path, "error", "Branch, resource type, code and name are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_resource", {
      p_branch_id: branchId, p_resource_type: resourceType, p_code: code, p_name: name,
      p_capabilities: { hv_ready: formData.get("hvReady") === "on", note: optionalText(formData, "capabilityNote") ?? "" },
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "The branch resource could not be created.")));
  }
  revalidatePath(path);
  redirect(routeMessage(path, "created", "Branch resource created."));
}

export async function bookAppointmentResource(formData: FormData) {
  await getCurrentStaff();
  const appointmentId = formText(formData, "appointmentId");
  const resourceId = formText(formData, "resourceId");
  if (!appointmentId || !resourceId) redirect(routeMessage(path, "error", "Appointment and resource are required."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("book_appointment_resource", { p_appointment_id: appointmentId, p_resource_id: resourceId });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "The resource could not be booked.")));
  }
  revalidatePath(path); revalidatePath("/appointments");
  redirect(routeMessage(path, "created", "Resource assigned to appointment."));
}

export async function upsertOperatingHour(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const dayOfWeek = optionalNumber(formData, "dayOfWeek");
  const closed = formData.get("isClosed") === "on";
  if (!branchId || dayOfWeek === undefined || !Number.isSafeInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    redirect(routeMessage(path, "error", "Branch and weekday are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("upsert_branch_operating_hour", {
      p_branch_id: branchId,
      p_day_of_week: dayOfWeek,
      p_opens_at: closed ? null : optionalText(formData, "opensAt") ?? null,
      p_closes_at: closed ? null : optionalText(formData, "closesAt") ?? null,
      p_is_closed: closed,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "Operating hours could not be saved.")));
  }
  revalidatePath(path); revalidatePath("/appointments");
  redirect(routeMessage(path, "created", "Branch operating hours saved."));
}

export async function upsertBranchHoliday(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const holidayDate = formText(formData, "holidayDate");
  const name = formText(formData, "name");
  const closed = formData.get("isClosed") === "on";
  if (!branchId || !holidayDate || !name) redirect(routeMessage(path, "error", "Branch, date and holiday name are required."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("upsert_branch_holiday", {
      p_branch_id: branchId,
      p_holiday_date: holidayDate,
      p_name: name,
      p_is_closed: closed,
      p_opens_at: closed ? null : optionalText(formData, "opensAt") ?? null,
      p_closes_at: closed ? null : optionalText(formData, "closesAt") ?? null,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "Holiday hours could not be saved.")));
  }
  revalidatePath(path); revalidatePath("/appointments");
  redirect(routeMessage(path, "created", "Branch holiday saved."));
}
