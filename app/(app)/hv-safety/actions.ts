"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalText, routeMessage, zonedLocalToIso } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function permitRoute(permitId: string | undefined, key: "created" | "error", message: string) {
  const params = new URLSearchParams({ [key]: message });
  if (permitId) params.set("permit", permitId);
  return `/hv-safety?${params.toString()}${permitId ? "#permit-workspace" : ""}`;
}

export async function createQualificationType(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect(routeMessage("/hv-safety", "error", "Only administrators can configure qualification types."));
  const code = formText(formData, "code");
  const name = formText(formData, "name");
  if (!code || !name) redirect(routeMessage("/hv-safety", "error", "Qualification code and name are required."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_qualification_type", {
      p_organization_id: staff.organizationId, p_code: code, p_name: name,
      p_scope_json: { vehicle_platform: "MEB", work_scope: optionalText(formData, "scope") ?? "high-voltage service" },
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/hv-safety", "error", operationError(error, "The qualification type could not be created.")));
  }
  revalidatePath("/hv-safety"); revalidatePath("/staff"); revalidatePath("/work-orders");
  redirect(routeMessage("/hv-safety", "created", "Qualification type created."));
}

export async function grantTechnicianQualification(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect(routeMessage("/hv-safety", "error", "Only administrators can verify technician qualifications."));
  const technicianId = formText(formData, "technicianId");
  const qualificationTypeId = formText(formData, "qualificationTypeId");
  const issuer = formText(formData, "issuer");
  const validFrom = formText(formData, "validFrom");
  const validTo = optionalText(formData, "validTo");
  if (!technicianId || !qualificationTypeId || !issuer || !validFrom) {
    redirect(routeMessage("/hv-safety", "error", "Technician, qualification, issuer and valid-from date are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("grant_technician_qualification", {
      p_technician_id: technicianId, p_qualification_type_id: qualificationTypeId,
      p_issuer: issuer, p_certificate_reference: optionalText(formData, "certificateReference") ?? "",
      p_valid_from: validFrom, p_valid_to: validTo ?? null,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/hv-safety", "error", operationError(error, "The technician qualification could not be verified.")));
  }
  revalidatePath("/hv-safety"); revalidatePath("/staff"); revalidatePath("/work-orders");
  redirect(routeMessage("/hv-safety", "created", "Technician qualification verified."));
}

export async function createHvPermit(formData: FormData) {
  await getCurrentStaff();
  const jobId = formText(formData, "jobId");
  const procedureRef = formText(formData, "procedureRef");
  const validFromLocal = formText(formData, "validFrom");
  const validToLocal = formText(formData, "validTo");
  if (!jobId || !procedureRef || !validFromLocal || !validToLocal) {
    redirect(permitRoute(undefined, "error", "Job, procedure and permit window are required."));
  }
  let permitId = "";
  try {
    const supabase = await createClient();
    const { data: job, error: jobError } = await supabase.from("jobs").select("branch:branches(timezone)").eq("id", jobId).single();
    if (jobError || !job?.branch) throw jobError ?? new Error("HV job branch not found.");
    const { data, error } = await supabase.rpc("create_hv_work_permit", {
      p_job_id: jobId, p_procedure_ref: procedureRef,
      p_risk_json: { hazards: optionalText(formData, "hazards") ?? "", controls: optionalText(formData, "controls") ?? "" },
      p_valid_from: zonedLocalToIso(validFromLocal, job.branch.timezone),
      p_valid_to: zonedLocalToIso(validToLocal, job.branch.timezone),
    });
    if (error || !data) throw error ?? new Error("HV permit was not created.");
    permitId = data.id;
  } catch (error) {
    redirect(permitRoute(undefined, "error", operationError(error, "The HV permit could not be created.")));
  }
  revalidatePath("/hv-safety"); revalidatePath("/work-orders");
  redirect(permitRoute(permitId, "created", "HV permit created."));
}

export async function recordHvEvidence(formData: FormData) {
  await getCurrentStaff();
  const permitId = formText(formData, "permitId");
  const checkCode = formText(formData, "checkCode");
  const result = formText(formData, "result");
  const measurementText = optionalText(formData, "measurementValue");
  const measurementValue = measurementText === null ? null : Number(measurementText);
  const permittedPpe = new Set(["insulated_gloves", "face_shield", "arc_rated_clothing", "insulated_footwear"]);
  const ppe = formData.getAll("ppe").filter((item): item is string => typeof item === "string" && permittedPpe.has(item));
  if (!permitId || !checkCode || !["pass", "fail", "not_applicable"].includes(result)) {
    redirect(permitRoute(permitId || undefined, "error", "Check and result are required."));
  }
  if (measurementValue !== null && (!Number.isFinite(measurementValue) || measurementValue < 0)) {
    redirect(permitRoute(permitId, "error", "The electrical measurement must be zero or greater."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_hv_permit_evidence", {
      p_permit_id: permitId, p_check_code: checkCode, p_result: result,
      p_witness_id: optionalText(formData, "witnessId") ?? null,
      p_tool_ref: optionalText(formData, "toolRef") ?? "",
      p_measurement_value: measurementValue,
      p_measurement_unit: optionalText(formData, "measurementUnit") ?? "",
      p_instrument_calibration_due: optionalText(formData, "calibrationDue") ?? null,
      p_lock_identifier: optionalText(formData, "lockIdentifier") ?? "",
      p_disconnect_key_reference: optionalText(formData, "disconnectKeyReference") ?? "",
      p_ppe_json: ppe,
      p_notes: optionalText(formData, "notes") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(permitRoute(permitId, "error", operationError(error, "The HV safety check could not be recorded.")));
  }
  revalidatePath("/hv-safety"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(permitRoute(permitId, "created", result === "fail" ? "Failed check recorded; the safety stop was applied." : "HV safety check recorded."));
}

export async function transitionHvPermit(formData: FormData) {
  await getCurrentStaff();
  const permitId = formText(formData, "permitId");
  const toState = formText(formData, "toState");
  if (!permitId || !["risk_review", "authorized", "isolated", "work_active", "reenergization_check", "closed", "revoked"].includes(toState)) {
    redirect(permitRoute(permitId || undefined, "error", "The permit action is invalid."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_hv_work_permit", { p_permit_id: permitId, p_to_state: toState });
    if (error) throw error;
  } catch (error) {
    redirect(permitRoute(permitId, "error", operationError(error, "The HV permit could not be progressed.")));
  }
  revalidatePath("/hv-safety"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(permitRoute(permitId, "created", `Permit moved to ${toState.replaceAll("_", " ")}.`));
}
