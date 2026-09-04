"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createVehicle(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = formText(formData, "branchId");
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
