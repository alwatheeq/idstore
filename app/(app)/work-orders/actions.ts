"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage, zonedLocalToIso } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createRepairOrder } from "@/lib/supabase/commands";
import { createClient } from "@/lib/supabase/server";

export async function createWorkOrder(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = formText(formData, "branchId");
  const customerId = formText(formData, "customerId");
  const vehicleId = formText(formData, "vehicleId");
  const odometerKm = optionalNumber(formData, "odometerKm");
  const stateOfCharge = optionalNumber(formData, "stateOfCharge");
  const promisedLocal = optionalText(formData, "promisedAt");

  if (!branchId || !customerId || !vehicleId) {
    redirect(routeMessage("/work-orders", "error", "Branch, customer and vehicle are required."));
  }
  if ([odometerKm, stateOfCharge].some((value) => Number.isNaN(value))) {
    redirect(routeMessage("/work-orders", "error", "Odometer and charge level must be valid numbers."));
  }

  try {
    const supabase = await createClient();
    let promisedAt: string | undefined;
    if (promisedLocal) {
      const { data: branch, error: branchError } = await supabase
        .from("branches")
        .select("timezone")
        .eq("id", branchId)
        .eq("organization_id", staff.organizationId)
        .single();
      if (branchError || !branch) throw branchError ?? new Error("Branch not found.");
      promisedAt = zonedLocalToIso(promisedLocal, branch.timezone);
    }
    await createRepairOrder(supabase, {
      organizationId: staff.organizationId,
      branchId,
      customerId,
      vehicleId,
      odometerKm,
      stateOfCharge,
      customerConcern: optionalText(formData, "customerConcern"),
      promisedAt,
    });
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The work order could not be opened.")));
  }

  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  redirect(routeMessage("/work-orders", "created", "Work order opened."));
}

export async function transitionWorkOrder(formData: FormData) {
  await getCurrentStaff();
  const repairOrderId = formText(formData, "repairOrderId");
  const version = Number(formText(formData, "version"));
  const toStatus = formText(formData, "toStatus");
  const allowed = ["diagnosis", "awaiting_approval", "approved", "in_progress", "qc", "ready", "delivered", "closed", "on_hold", "cancelled"];
  if (!repairOrderId || !Number.isSafeInteger(version) || !allowed.includes(toStatus)) {
    redirect(routeMessage("/work-orders", "error", "The work-order action is invalid."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_repair_order", {
      p_repair_order_id: repairOrderId,
      p_expected_version: version,
      p_to_status: toStatus,
      p_reason: optionalText(formData, "reason"),
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The work order could not be progressed.")));
  }
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  redirect(routeMessage("/work-orders", "created", `Work order moved to ${toStatus.replaceAll("_", " ")}.`));
}

export async function createJob(formData: FormData) {
  await getCurrentStaff();
  const repairOrderId = formText(formData, "repairOrderId");
  const description = formText(formData, "description");
  const safetyClass = formText(formData, "safetyClass");
  const plannedMinutes = optionalNumber(formData, "plannedMinutes");
  if (!repairOrderId || !description || !["normal", "ev_aware", "hv_isolated", "hv_battery_open"].includes(safetyClass)
      || plannedMinutes === undefined || Number.isNaN(plannedMinutes) || plannedMinutes < 0) {
    redirect(routeMessage("/work-orders", "error", "Work order, description, safety class and planned minutes are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_job", {
      p_repair_order_id: repairOrderId,
      p_description: description,
      p_operation_code: optionalText(formData, "operationCode") ?? "",
      p_safety_class: safetyClass,
      p_required_qualification_code: optionalText(formData, "qualificationCode") ?? "",
      p_planned_minutes: plannedMinutes,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The workshop job could not be created.")));
  }
  revalidatePath("/work-orders");
  redirect(routeMessage("/work-orders", "created", "Workshop job created."));
}

export async function assignJob(formData: FormData) {
  await getCurrentStaff();
  const jobId = formText(formData, "jobId");
  const technicianId = formText(formData, "technicianId");
  const version = Number(formText(formData, "version"));
  if (!jobId || !technicianId || !Number.isSafeInteger(version)) {
    redirect(routeMessage("/work-orders", "error", "Choose a valid technician assignment."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("assign_job", {
      p_job_id: jobId,
      p_expected_version: version,
      p_technician_id: technicianId,
      p_assignment_kind: "primary",
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The job could not be assigned.")));
  }
  revalidatePath("/work-orders");
  redirect(routeMessage("/work-orders", "created", "Technician assigned."));
}

export async function startJob(formData: FormData) {
  await getCurrentStaff();
  const jobId = formText(formData, "jobId");
  const version = Number(formText(formData, "version"));
  if (!jobId || !Number.isSafeInteger(version)) redirect(routeMessage("/work-orders", "error", "The timer action is invalid."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("start_job", { p_job_id: jobId, p_expected_version: version });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The job timer could not be started.")));
  }
  revalidatePath("/work-orders");
  redirect(routeMessage("/work-orders", "created", "Job timer started."));
}

export async function finishJob(formData: FormData) {
  await getCurrentStaff();
  const jobId = formText(formData, "jobId");
  const version = Number(formText(formData, "version"));
  const outcome = formText(formData, "outcome");
  if (!jobId || !Number.isSafeInteger(version) || !["paused", "blocked", "qc", "completed"].includes(outcome)) {
    redirect(routeMessage("/work-orders", "error", "The timer outcome is invalid."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("finish_job", {
      p_job_id: jobId,
      p_expected_version: version,
      p_outcome: outcome,
      p_note: optionalText(formData, "note") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The job timer could not be stopped.")));
  }
  revalidatePath("/work-orders");
  redirect(routeMessage("/work-orders", "created", `Job marked ${outcome}.`));
}

export async function recordJobNarrative(formData: FormData) {
  await getCurrentStaff();
  const jobId = formText(formData, "jobId");
  const causeText = formText(formData, "causeText");
  const correctionText = formText(formData, "correctionText");
  if (!jobId || !causeText || !correctionText) redirect(routeMessage("/work-orders", "error", "Cause and correction are required."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_job_narrative", { p_job_id: jobId, p_cause_text: causeText, p_correction_text: correctionText });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The job narrative could not be saved.")));
  }
  revalidatePath("/work-orders");
  redirect(routeMessage("/work-orders", "created", "Cause and correction recorded."));
}

export async function interruptJob(formData: FormData) {
  await getCurrentStaff();
  const jobId = formText(formData, "jobId");
  const version = Number(formText(formData, "version"));
  const interruptionType = formText(formData, "interruptionType");
  const reason = formText(formData, "reason");
  if (!jobId || !Number.isSafeInteger(version) || !["pause", "blocked"].includes(interruptionType) || !reason) redirect(routeMessage("/work-orders", "error", "A valid pause or block reason is required."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("interrupt_job", { p_job_id: jobId, p_expected_version: version, p_interruption_type: interruptionType, p_reason: reason });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The job could not be interrupted.")));
  }
  revalidatePath("/work-orders");
  redirect(routeMessage("/work-orders", "created", `Job ${interruptionType === "pause" ? "paused" : "blocked"} with evidence.`));
}

export async function resumeJob(formData: FormData) {
  await getCurrentStaff();
  const jobId = formText(formData, "jobId");
  const version = Number(formText(formData, "version"));
  if (!jobId || !Number.isSafeInteger(version)) redirect(routeMessage("/work-orders", "error", "The resume action is invalid."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("resume_job", { p_job_id: jobId, p_expected_version: version });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The job could not be resumed.")));
  }
  revalidatePath("/work-orders");
  redirect(routeMessage("/work-orders", "created", "Job returned to the ready queue."));
}

export async function createReworkJob(formData: FormData) {
  await getCurrentStaff();
  const originalJobId = formText(formData, "jobId");
  const reworkKind = formText(formData, "reworkKind");
  const reason = formText(formData, "reason");
  if (!originalJobId || !["rework", "comeback"].includes(reworkKind) || !reason) redirect(routeMessage("/work-orders", "error", "Rework type and reason are required."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_rework_job", { p_original_job_id: originalJobId, p_rework_kind: reworkKind, p_reason: reason });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The rework job could not be created.")));
  }
  revalidatePath("/work-orders");
  redirect(routeMessage("/work-orders", "created", `${reworkKind === "comeback" ? "Comeback" : "Rework"} job created.`));
}
