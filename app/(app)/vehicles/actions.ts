"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff, resolveOperatingBranch } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function vehicleRecordMessage(vehicleId: string, tab: "profile" | "odometer" | "ownership", key: "error" | "created", message: string) {
  if (!vehicleId) return routeMessage("/vehicles", key, message);
  const params = new URLSearchParams({ manage: vehicleId, tab, [key]: message });
  return `/vehicles?${params.toString()}#vehicle-controls`;
}

export async function createVehicle(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const customerId = formText(formData, "customerId");
  const modelId = formText(formData, "modelId");
  const vin = formText(formData, "vin").replace(/\s/g, "").toUpperCase();
  const registration = formText(formData, "registrationNo");
  const modelYear = optionalNumber(formData, "modelYear");
  const batteryKwh = optionalNumber(formData, "batteryKwh");
  const odometerKm = optionalNumber(formData, "odometerKm");

  if (!branchId || !customerId || !modelId || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) || !registration) {
    redirect(routeMessage("/vehicles", "error", "Branch, customer, model, valid VIN and registration are required."));
  }
  if ([modelYear, batteryKwh, odometerKm].some((value) => Number.isNaN(value))) {
    redirect(routeMessage("/vehicles", "error", "Vehicle measurements must be valid numbers."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_vehicle", {
      p_organization_id: staff.organizationId,
      p_branch_id: branchId,
      p_customer_id: customerId,
      p_model_id: modelId,
      p_vin: vin,
      p_registration_no: registration,
      p_model_year: modelYear,
      p_trim: optionalText(formData, "trim"),
      p_battery_kwh: batteryKwh,
      p_odometer_km: odometerKm,
      p_color: optionalText(formData, "color"),
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/vehicles", "error", operationError(error, "The vehicle could not be registered.")));
  }

  revalidatePath("/vehicles");
  revalidatePath("/customers");
  revalidatePath("/work-orders");
  redirect(routeMessage("/vehicles", "created", "Vehicle registered."));
}

export async function createRecommendation(formData: FormData) {
  const staff = await getCurrentStaff();
  const vehicleId = formText(formData, "vehicleId"); const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const description = formText(formData, "description"); const severity = formText(formData, "severity");
  const dueOdometer = optionalNumber(formData, "dueOdometerKm");
  if (!vehicleId || !branchId || !description || !["amber", "red", "safety_stop"].includes(severity) || Number.isNaN(dueOdometer)) {
    redirect(routeMessage("/vehicles", "error", "Vehicle, branch, description and severity are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_vehicle_recommendation", { p_vehicle_id: vehicleId, p_branch_id: branchId, p_description: description, p_severity: severity, p_due_date: optionalText(formData, "dueDate") ?? null, p_due_odometer_km: dueOdometer ?? null });
    if (error) throw error;
  } catch (error) { redirect(routeMessage("/vehicles", "error", operationError(error, "Deferred work could not be recorded."))); }
  revalidatePath("/vehicles");
  redirect(routeMessage("/vehicles", "created", "Deferred work recorded."));
}

export async function transitionRecommendation(formData: FormData) {
  await getCurrentStaff(); const recommendationId = formText(formData, "recommendationId"); const status = formText(formData, "status");
  if (!recommendationId || !["open", "scheduled", "completed", "dismissed"].includes(status)) redirect(routeMessage("/vehicles", "error", "Deferred-work action is invalid."));
  try { const supabase = await createClient(); const { error } = await supabase.rpc("transition_vehicle_recommendation", { p_recommendation_id: recommendationId, p_to_status: status }); if (error) throw error; }
  catch (error) { redirect(routeMessage("/vehicles", "error", operationError(error, "Deferred work could not be updated."))); }
  revalidatePath("/vehicles");
  redirect(routeMessage("/vehicles", "created", `Deferred work marked ${status}.`));
}

export async function updateVehicleProfile(formData: FormData) {
  const staff = await getCurrentStaff();
  const vehicleId = formText(formData, "vehicleId");
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const connectivityStatus = formText(formData, "connectivityStatus");
  const warrantyDistanceKm = optionalNumber(formData, "warrantyDistanceKm");
  if (!vehicleId || !branchId || !["unknown", "connected", "disconnected", "not_supported"].includes(connectivityStatus) || Number.isNaN(warrantyDistanceKm)) {
    redirect(vehicleRecordMessage(vehicleId, "profile", "error", "Vehicle, branch and a valid connectivity state are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_vehicle_profile", {
      p_vehicle_id: vehicleId,
      p_branch_id: branchId,
      p_drive_unit: optionalText(formData, "driveUnit") ?? "",
      p_connectivity_status: connectivityStatus,
      p_software_version: optionalText(formData, "softwareVersion") ?? "",
      p_first_registration_date: optionalText(formData, "firstRegistrationDate") ?? null,
      p_warranty_start_date: optionalText(formData, "warrantyStartDate") ?? null,
      p_warranty_end_date: optionalText(formData, "warrantyEndDate") ?? null,
      p_warranty_distance_km: warrantyDistanceKm ?? null,
      p_color: optionalText(formData, "color") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(vehicleRecordMessage(vehicleId, "profile", "error", operationError(error, "The vehicle profile could not be updated.")));
  }
  revalidatePath("/vehicles");
  redirect(vehicleRecordMessage(vehicleId, "profile", "created", "Vehicle technical and warranty profile updated."));
}

export async function addVehicleOwnership(formData: FormData) {
  const staff = await getCurrentStaff();
  const vehicleId = formText(formData, "vehicleId");
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const customerId = formText(formData, "customerId");
  const relationship = formText(formData, "relationship");
  const validFrom = formText(formData, "validFrom");
  if (!vehicleId || !branchId || !customerId || !validFrom || !["owner", "driver", "fleet_manager", "authorized_contact"].includes(relationship)) {
    redirect(vehicleRecordMessage(vehicleId, "ownership", "error", "Vehicle, branch, customer, relationship and start date are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_vehicle_ownership", {
      p_vehicle_id: vehicleId,
      p_branch_id: branchId,
      p_customer_id: customerId,
      p_relationship: relationship,
      p_valid_from: validFrom,
      p_verified: formData.get("verified") === "on",
    });
    if (error) throw error;
  } catch (error) {
    redirect(vehicleRecordMessage(vehicleId, "ownership", "error", operationError(error, "The ownership relationship could not be added.")));
  }
  revalidatePath("/vehicles");
  revalidatePath("/customers");
  redirect(vehicleRecordMessage(vehicleId, "ownership", "created", "Vehicle ownership relationship added."));
}

export async function endVehicleOwnership(formData: FormData) {
  const staff = await getCurrentStaff();
  const vehicleId = formText(formData, "vehicleId");
  const ownershipId = formText(formData, "ownershipId");
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const validTo = formText(formData, "validTo");
  const reason = formText(formData, "reason");
  if (!ownershipId || !branchId || !validTo || !reason) redirect(vehicleRecordMessage(vehicleId, "ownership", "error", "Ownership, branch, end date and an audit reason are required."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("end_vehicle_ownership", { p_ownership_id: ownershipId, p_branch_id: branchId, p_valid_to: validTo, p_reason: reason });
    if (error) throw error;
  } catch (error) {
    redirect(vehicleRecordMessage(vehicleId, "ownership", "error", operationError(error, "The ownership relationship could not be ended.")));
  }
  revalidatePath("/vehicles");
  revalidatePath("/customers");
  redirect(vehicleRecordMessage(vehicleId, "ownership", "created", "Vehicle ownership relationship ended."));
}

export async function recordOdometerReading(formData: FormData) {
  const staff = await getCurrentStaff();
  const vehicleId = formText(formData, "vehicleId");
  const branchId = resolveOperatingBranch(staff, formText(formData, "branchId"));
  const readingKm = optionalNumber(formData, "readingKm");
  const source = formText(formData, "source");
  if (!vehicleId || !branchId || readingKm === undefined || Number.isNaN(readingKm) || readingKm < 0 || !source) {
    redirect(vehicleRecordMessage(vehicleId, "odometer", "error", "Vehicle, branch, odometer and source are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_odometer_reading", {
      p_vehicle_id: vehicleId,
      p_branch_id: branchId,
      p_reading_km: readingKm,
      p_source: source,
      p_correction_reason: optionalText(formData, "correctionReason") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(vehicleRecordMessage(vehicleId, "odometer", "error", operationError(error, "The odometer reading could not be recorded.")));
  }
  revalidatePath("/vehicles");
  revalidatePath("/work-orders");
  redirect(vehicleRecordMessage(vehicleId, "odometer", "created", "Odometer reading recorded."));
}
