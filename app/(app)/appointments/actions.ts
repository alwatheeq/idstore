"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage, zonedLocalToIso } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createAppointment(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = formText(formData, "branchId");
  const customerId = formText(formData, "customerId");
  const vehicleId = formText(formData, "vehicleId");
  const startLocal = formText(formData, "startAt");
  const endLocal = formText(formData, "endAt");

  if (!branchId || !customerId || !vehicleId || !startLocal || !endLocal) {
    redirect(routeMessage("/appointments", "error", "Branch, customer, vehicle, start and end time are required."));
  }

  try {
    const supabase = await createClient();
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("timezone")
      .eq("id", branchId)
      .eq("organization_id", staff.organizationId)
      .single();
    if (branchError || !branch) throw branchError ?? new Error("Branch not found.");

    const startAt = zonedLocalToIso(startLocal, branch.timezone);
    const endAt = zonedLocalToIso(endLocal, branch.timezone);
    const promisedLocal = optionalText(formData, "promisedAt");
    const serviceMode = formText(formData, "serviceMode") || "workshop";
    const transportMode = formText(formData, "transportMode") || "customer_dropoff";
    const recurrenceCount = optionalNumber(formData, "recurrenceCount") ?? 1;
    const serviceVersionIds = Array.from(new Set(formData.getAll("serviceVersionId").filter((item): item is string => typeof item === "string" && item.length > 0)));
    if (!["workshop", "mobile"].includes(serviceMode) || !["customer_dropoff", "wait_on_site", "pickup_return", "loan_vehicle"].includes(transportMode) || !Number.isSafeInteger(recurrenceCount) || recurrenceCount < 1 || recurrenceCount > 12 || serviceVersionIds.length < 1 || serviceVersionIds.length > 10) {
      throw new Error("Appointment service choices are invalid.");
    }
    const { error } = await supabase.rpc("create_catalog_appointments", {
      p_organization_id: staff.organizationId,
      p_branch_id: branchId,
      p_customer_id: customerId,
      p_vehicle_id: vehicleId,
      p_start_at: startAt,
      p_end_at: endAt,
      p_promised_at: promisedLocal ? zonedLocalToIso(promisedLocal, branch.timezone) : null,
      p_notes: optionalText(formData, "notes") ?? null,
      p_service_mode: serviceMode,
      p_transport_mode: transportMode,
      p_advisor_user_id: optionalText(formData, "advisorUserId") ?? null,
      p_resource_id: optionalText(formData, "resourceId") ?? null,
      p_service_version_ids: serviceVersionIds,
      p_recurrence_count: recurrenceCount,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/appointments", "error", operationError(error, "The appointment could not be scheduled.")));
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  redirect(routeMessage("/appointments", "created", "Appointment scheduled."));
}

export async function transitionAppointment(formData: FormData) {
  await getCurrentStaff();
  const appointmentId = formText(formData, "appointmentId");
  const version = Number(formText(formData, "version"));
  const toStatus = formText(formData, "toStatus");
  if (!appointmentId || !Number.isSafeInteger(version) || !["confirmed", "checked_in", "completed", "cancelled", "no_show"].includes(toStatus)) {
    redirect(routeMessage("/appointments", "error", "The appointment action is invalid."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_appointment", {
      p_appointment_id: appointmentId,
      p_expected_version: version,
      p_to_status: toStatus,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/appointments", "error", operationError(error, "The appointment status could not be changed.")));
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  redirect(routeMessage("/appointments", "created", `Appointment marked ${toStatus.replaceAll("_", " ")}.`));
}

export async function createWaitlistEntry(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = formText(formData, "branchId");
  const customerId = formText(formData, "customerId");
  const vehicleId = formText(formData, "vehicleId");
  const preferredFrom = formText(formData, "preferredFrom");
  const preferredTo = formText(formData, "preferredTo");
  const durationMinutes = optionalNumber(formData, "durationMinutes");
  const priority = optionalNumber(formData, "priority") ?? 3;
  const serviceMode = formText(formData, "serviceMode");
  const transportMode = formText(formData, "transportMode");
  if (!branchId || !customerId || !vehicleId || !preferredFrom || !preferredTo || !durationMinutes || !Number.isSafeInteger(durationMinutes) || !Number.isSafeInteger(priority)) {
    redirect(routeMessage("/appointments", "error", "Complete the branch, customer, vehicle, preferred window and duration."));
  }
  try {
    const supabase = await createClient();
    const { data: branch, error: branchError } = await supabase.from("branches").select("timezone").eq("id", branchId).eq("organization_id", staff.organizationId).single();
    if (branchError || !branch) throw branchError ?? new Error("Branch not found.");
    const { error } = await supabase.rpc("create_waitlist_entry", {
      p_branch_id: branchId,
      p_customer_id: customerId,
      p_vehicle_id: vehicleId,
      p_preferred_from: zonedLocalToIso(preferredFrom, branch.timezone),
      p_preferred_to: zonedLocalToIso(preferredTo, branch.timezone),
      p_duration_minutes: durationMinutes,
      p_service_mode: serviceMode,
      p_transport_mode: transportMode,
      p_priority: priority,
      p_notes: optionalText(formData, "notes") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/appointments", "error", operationError(error, "The waitlist entry could not be created.")));
  }
  revalidatePath("/appointments");
  redirect(routeMessage("/appointments", "created", "Customer added to the appointment waitlist."));
}

export async function transitionWaitlistEntry(formData: FormData) {
  await getCurrentStaff();
  const waitlistId = formText(formData, "waitlistId");
  const status = formText(formData, "status");
  const reason = formText(formData, "reason");
  if (!waitlistId || !["offered", "booked", "cancelled", "expired"].includes(status) || !reason) {
    redirect(routeMessage("/appointments", "error", "Waitlist action and reason are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_waitlist_entry", {
      p_waitlist_id: waitlistId,
      p_to_status: status,
      p_appointment_id: optionalText(formData, "appointmentId") ?? null,
      p_reason: reason,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/appointments", "error", operationError(error, "The waitlist entry could not be updated.")));
  }
  revalidatePath("/appointments");
  redirect(routeMessage("/appointments", "created", `Waitlist entry marked ${status}.`));
}

export async function completeVehicleCheckin(formData: FormData) {
  await getCurrentStaff();
  const appointmentId = formText(formData, "appointmentId");
  const version = Number(formText(formData, "version"));
  const odometerKm = optionalNumber(formData, "odometerKm");
  const stateOfCharge = optionalNumber(formData, "stateOfCharge");
  const keysCount = optionalNumber(formData, "keysCount") ?? 1;
  const signerName = formText(formData, "signerName");
  if (!appointmentId || !Number.isSafeInteger(version) || odometerKm === undefined || Number.isNaN(odometerKm) || Number.isNaN(stateOfCharge) || !Number.isSafeInteger(keysCount) || !signerName || formData.get("ownershipVerified") !== "on" || formData.get("diagnosisAuthorized") !== "on") {
    redirect(routeMessage("/appointments", "error", "Check-in requires current appointment data, odometer, ownership verification, diagnosis authorization and signer name."));
  }
  const list = (key: string) => formText(formData, key).split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  const conditionItems = ["front", "rear", "left", "right", "roof", "interior", "wheels", "cargo"].map((zone) => ({
    zone,
    condition: formText(formData, `${zone}Condition`) || "clear",
    notes: formText(formData, `${zone}Notes`),
  }));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("complete_vehicle_checkin", {
      p_appointment_id: appointmentId,
      p_expected_version: version,
      p_odometer_km: odometerKm,
      p_state_of_charge: stateOfCharge ?? null,
      p_keys_count: keysCount,
      p_accessories: list("accessories"),
      p_warning_lights: list("warningLights"),
      p_ownership_verified: true,
      p_diagnosis_authorized: true,
      p_road_test_authorized: formData.get("roadTestAuthorized") === "on",
      p_signer_name: signerName,
      p_condition_items: conditionItems,
      p_odometer_correction_reason: optionalText(formData, "odometerCorrectionReason") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/appointments", "error", operationError(error, "Vehicle check-in could not be completed.")));
  }
  revalidatePath("/appointments"); revalidatePath("/vehicles"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(routeMessage("/appointments", "created", "Vehicle checked in with signed condition evidence."));
}
