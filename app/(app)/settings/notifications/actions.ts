"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formText, operationError, routeMessage } from "@/lib/actions/form";

const path = "/settings/notifications";
async function admin() {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect("/dashboard");
  return staff;
}
function refresh() {
  revalidatePath(path);
  revalidatePath("/records");
  revalidatePath("/governance");
}
export async function saveNotificationWebhook(form: FormData) {
  const staff = await admin();
  try {
    const version = Number(formText(form, "version"));
    if (!Number.isSafeInteger(version) || version < 0) throw new Error("Invalid settings version.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_notification_webhook", {
      p_organization_id: staff.organizationId, p_endpoint: formText(form, "endpoint"),
      p_secret: formText(form, "secret"), p_enabled: form.get("enabled") === "on", p_version: version,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "Webhook settings could not be saved.")));
  }
  refresh();
  redirect(routeMessage(path, "created", "Customer notification settings saved."));
}
export async function testNotificationWebhook(form: FormData) {
  const staff = await admin();
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("test_notification_webhook", { p_organization_id: staff.organizationId, p_version: Number(formText(form, "version")) });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "The test could not be queued.")));
  }
  refresh();
  redirect(routeMessage(path, "created", "Test queued. Refresh in about two minutes to see the result."));
}
export async function retryNotificationWebhook(form: FormData) {
  await admin();
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("retry_notification_webhook", { p_delivery_id: formText(form, "deliveryId") });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(path, "error", operationError(error, "The notification could not be retried.")));
  }
  refresh();
  redirect(routeMessage(path, "created", "Notification queued for retry."));
}
