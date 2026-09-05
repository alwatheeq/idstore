"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, zonedLocalToIso } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function diagnosticsRoute(sessionId: string | undefined, key: "created" | "error", message: string) {
  const params = new URLSearchParams({ [key]: message });
  if (sessionId) params.set("session", sessionId);
  return `/diagnostics?${params.toString()}${sessionId ? "#diagnostic-workspace" : ""}`;
}

async function repairOrderTimezone(repairOrderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("repair_orders").select("branch:branches(timezone)").eq("id", repairOrderId).single();
  if (error || !data?.branch) throw error ?? new Error("Repair-order branch not found.");
  return { supabase, timezone: data.branch.timezone };
}

export async function startDiagnosticSession(formData: FormData) {
  await getCurrentStaff();
  const repairOrderId = formText(formData, "repairOrderId");
  const tool = formText(formData, "tool");
  const startedAt = formText(formData, "startedAt");
  if (!repairOrderId || !tool || !startedAt) redirect(diagnosticsRoute(undefined, "error", "Repair order, diagnostic tool and start time are required."));
  let sessionId = "";
  try {
    const { supabase, timezone } = await repairOrderTimezone(repairOrderId);
    const { data, error } = await supabase.rpc("start_diagnostic_session", {
      p_repair_order_id: repairOrderId, p_tool: tool,
      p_tool_version: optionalText(formData, "toolVersion") ?? "",
      p_interface_serial: optionalText(formData, "interfaceSerial") ?? "",
      p_external_ref: optionalText(formData, "externalRef") ?? "",
      p_started_at: zonedLocalToIso(startedAt, timezone),
    });
    if (error || !data) throw error ?? new Error("Diagnostic session was not started.");
    sessionId = data.id;
  } catch (error) {
    redirect(diagnosticsRoute(undefined, "error", operationError(error, "The diagnostic session could not be started.")));
  }
  revalidatePath("/diagnostics"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(diagnosticsRoute(sessionId, "created", "Diagnostic session started."));
}

export async function recordDiagnosticCode(formData: FormData) {
  await getCurrentStaff();
  const sessionId = formText(formData, "sessionId");
  const controlUnit = formText(formData, "controlUnit");
  const code = formText(formData, "code");
  const beforeStatus = formText(formData, "beforeStatus");
  if (!sessionId || !controlUnit || !code || !["active", "sporadic", "stored", "passive", "unknown"].includes(beforeStatus)) {
    redirect(diagnosticsRoute(sessionId || undefined, "error", "Control unit, DTC and initial status are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_diagnostic_trouble_code", {
      p_session_id: sessionId, p_control_unit: controlUnit, p_code: code,
      p_description: optionalText(formData, "description") ?? "", p_before_status: beforeStatus,
    });
    if (error) throw error;
  } catch (error) {
    redirect(diagnosticsRoute(sessionId, "error", operationError(error, "The diagnostic code could not be recorded.")));
  }
  revalidatePath("/diagnostics");
  redirect(diagnosticsRoute(sessionId, "created", "Diagnostic code recorded."));
}

export async function setDiagnosticCodeOutcome(formData: FormData) {
  await getCurrentStaff();
  const sessionId = formText(formData, "sessionId");
  const troubleCodeId = formText(formData, "troubleCodeId");
  const afterStatus = formText(formData, "afterStatus");
  if (!sessionId || !troubleCodeId || !["active", "sporadic", "cleared", "returned", "not_tested"].includes(afterStatus)) {
    redirect(diagnosticsRoute(sessionId || undefined, "error", "Choose a valid diagnostic outcome."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_diagnostic_trouble_code_outcome", { p_trouble_code_id: troubleCodeId, p_after_status: afterStatus });
    if (error) throw error;
  } catch (error) {
    redirect(diagnosticsRoute(sessionId, "error", operationError(error, "The diagnostic outcome could not be saved.")));
  }
  revalidatePath("/diagnostics");
  redirect(diagnosticsRoute(sessionId, "created", "Diagnostic outcome saved."));
}

export async function completeDiagnosticSession(formData: FormData) {
  await getCurrentStaff();
  const sessionId = formText(formData, "sessionId");
  if (!sessionId) redirect(diagnosticsRoute(undefined, "error", "Diagnostic session is invalid."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("complete_diagnostic_session", { p_session_id: sessionId });
    if (error) throw error;
  } catch (error) {
    redirect(diagnosticsRoute(sessionId, "error", operationError(error, "The diagnostic session could not be completed.")));
  }
  revalidatePath("/diagnostics"); revalidatePath("/vehicles");
  redirect(diagnosticsRoute(sessionId, "created", "Diagnostic session completed and locked."));
}

export async function recordBatteryHealth(formData: FormData) {
  await getCurrentStaff();
  const repairOrderId = formText(formData, "repairOrderId");
  const measuredAt = formText(formData, "measuredAt");
  const method = formText(formData, "method");
  const sohPercent = optionalNumber(formData, "sohPercent");
  const usableKwh = optionalNumber(formData, "usableKwh");
  const ambientTemperature = optionalNumber(formData, "ambientTemperature");
  const stateOfCharge = optionalNumber(formData, "stateOfCharge");
  if (!repairOrderId || !measuredAt || !method || (sohPercent === undefined && usableKwh === undefined)
      || [sohPercent, usableKwh, ambientTemperature, stateOfCharge].some((value) => Number.isNaN(value))) {
    redirect(diagnosticsRoute(undefined, "error", "Repair order, measurement time, method, and SoH or usable energy are required."));
  }
  try {
    const { supabase, timezone } = await repairOrderTimezone(repairOrderId);
    const { error } = await supabase.rpc("record_battery_health_report", {
      p_repair_order_id: repairOrderId, p_measured_at: zonedLocalToIso(measuredAt, timezone),
      p_soh_percent: sohPercent ?? null, p_usable_kwh: usableKwh ?? null, p_method: method,
      p_tool: optionalText(formData, "tool") ?? "",
      p_conditions_json: { ambient_temperature_c: ambientTemperature ?? null, state_of_charge_percent: stateOfCharge ?? null },
    });
    if (error) throw error;
  } catch (error) {
    redirect(diagnosticsRoute(undefined, "error", operationError(error, "The battery-health report could not be recorded.")));
  }
  revalidatePath("/diagnostics"); revalidatePath("/vehicles"); revalidatePath("/dashboard");
  redirect(diagnosticsRoute(undefined, "created", "Battery-health report recorded."));
}
