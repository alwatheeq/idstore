"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createPart(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = formText(formData, "branchId");
  const partNumber = formText(formData, "partNumber").toUpperCase();
  const description = formText(formData, "description");
  const unit = formText(formData, "unit").toLowerCase();
  const tracking = formText(formData, "tracking");
  const salePrice = optionalNumber(formData, "salePrice");
  if (!branchId || !partNumber || !description || !unit || !["none", "lot", "serial"].includes(tracking)
      || salePrice === undefined || Number.isNaN(salePrice) || salePrice < 0) {
    redirect(routeMessage("/inventory", "error", "Branch, part number, description, tracking and non-negative sale price are required."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_part", {
      p_organization_id: staff.organizationId,
      p_branch_id: branchId,
      p_part_number: partNumber,
      p_description_en: description,
      p_unit: unit,
      p_tracking: tracking,
      p_sale_price: salePrice,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/inventory", "error", operationError(error, "The part could not be created.")));
  }

  revalidatePath("/inventory");
  redirect(routeMessage("/inventory", "created", "Part created and stockroom initialized."));
}

export async function postInventoryMovement(formData: FormData) {
  const staff = await getCurrentStaff();
  const partId = formText(formData, "partId");
  const binId = formText(formData, "binId");
  const movementType = formText(formData, "movementType");
  const quantity = optionalNumber(formData, "quantity");
  const enteredCost = optionalNumber(formData, "unitCost");
  if (!partId || !binId || !["receipt", "adjustment_gain", "adjustment_loss"].includes(movementType)
      || quantity === undefined || Number.isNaN(quantity) || quantity <= 0) {
    redirect(routeMessage("/inventory", "error", "Part, bin, movement type and positive quantity are required."));
  }

  try {
    const supabase = await createClient();
    const { data: bin, error: binError } = await supabase
      .from("bins")
      .select("branch_id")
      .eq("id", binId)
      .eq("organization_id", staff.organizationId)
      .eq("status", "active")
      .single();
    if (binError || !bin) throw binError ?? new Error("Bin not found.");

    let unitCost = enteredCost;
    if (movementType === "adjustment_loss") {
      const { data: balance, error: balanceError } = await supabase
        .from("stock_balances")
        .select("average_cost")
        .eq("organization_id", staff.organizationId)
        .eq("part_id", partId)
        .eq("bin_id", binId)
        .is("lot_id", null)
        .maybeSingle();
      if (balanceError || !balance) throw balanceError ?? new Error("Stock balance not found.");
      unitCost = Number(balance.average_cost);
    }
    if (unitCost === undefined || Number.isNaN(unitCost) || unitCost < 0) {
      throw new Error("A non-negative unit cost is required.");
    }

    const idempotencyKey = randomUUID();
    const { error } = await supabase.rpc("post_stock_movement", {
      p_organization_id: staff.organizationId,
      p_branch_id: bin.branch_id,
      p_part_id: partId,
      p_lot_id: null,
      p_from_bin_id: movementType === "adjustment_loss" ? binId : null,
      p_to_bin_id: movementType === "adjustment_loss" ? null : binId,
      p_quantity: quantity,
      p_unit_cost: unitCost,
      p_movement_type: movementType,
      p_source_type: "manual_inventory_entry",
      p_source_id: idempotencyKey,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/inventory", "error", operationError(error, "The stock movement could not be posted.")));
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(routeMessage("/inventory", "created", "Stock movement posted."));
}
