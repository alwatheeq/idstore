"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formText, operationError } from "@/lib/actions/form";
import { submissionKey } from "@/lib/actions/submission-key";

export async function manageOrderStock(form: FormData) {
  await getCurrentStaff();
  const orderId = formText(form, "repairOrderId");
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("manage_order_stock", {
      p_order_id: orderId, p_action: formText(form, "stockAction"),
      p_data: { key: submissionKey(form), id: formText(form, "id"), version: formText(form, "version"), balance_id: formText(form, "balanceId"), quantity: formText(form, "quantity") },
    });
    if (error) throw error;
  } catch (error) { redirect(`/work-orders?order=${encodeURIComponent(orderId)}&error=${encodeURIComponent(operationError(error, "Stock could not be updated."))}#order-stock`); }
  revalidatePath("/work-orders"); revalidatePath("/inventory"); revalidatePath("/dashboard");
  redirect(`/work-orders?order=${encodeURIComponent(orderId)}&created=${encodeURIComponent("Order stock updated.")}#order-stock`);
}
