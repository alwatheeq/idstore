"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalText, routeMessage, zonedLocalToIso } from "@/lib/actions/form";
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
    const { error } = await supabase.rpc("create_appointment", {
      p_organization_id: staff.organizationId,
      p_branch_id: branchId,
      p_customer_id: customerId,
      p_vehicle_id: vehicleId,
      p_start_at: startAt,
      p_end_at: endAt,
      p_promised_at: promisedLocal ? zonedLocalToIso(promisedLocal, branch.timezone) : null,
      p_notes: optionalText(formData, "notes") ?? null,
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
