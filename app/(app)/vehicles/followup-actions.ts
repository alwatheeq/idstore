"use server";
import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formText } from "@/lib/actions/form";

export async function rescheduleFollowup(_previous: { success?: boolean; error?: boolean }, form: FormData): Promise<{ success?: boolean; error?: boolean }> {
  const staff = await getCurrentStaff();
  const due = formText(form, "dueDate");
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: true };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("vehicle_recommendations").select("id").eq("organization_id", staff.organizationId).eq("id", formText(form, "id")).single();
    if (error || !data) return { error: true };
    const { error: saveError } = await supabase.rpc("reschedule_vehicle_followup", { p_id: data.id, p_due_date: due || null, p_updated_at: formText(form, "updatedAt") });
    if (saveError) return { error: true };
    revalidatePath("/vehicles"); revalidatePath("/customers"); revalidatePath("/inspections");
    return { success: true };
  } catch { return { error: true }; }
}
