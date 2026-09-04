"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage } from "@/lib/actions/form";
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
    await createRepairOrder(supabase, {
      organizationId: staff.organizationId,
      branchId,
      customerId,
      vehicleId,
      odometerKm,
      stateOfCharge,
      customerConcern: optionalText(formData, "customerConcern"),
      promisedAt: promisedLocal ? new Date(promisedLocal).toISOString() : undefined,
    });
  } catch (error) {
    redirect(routeMessage("/work-orders", "error", operationError(error, "The work order could not be opened.")));
  }

  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  redirect(routeMessage("/work-orders", "created", "Work order opened."));
}
