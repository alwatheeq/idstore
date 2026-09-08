"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formText, operationError } from "@/lib/actions/form";
import { recordDefinition, recordManagementHref } from "@/lib/record-management";
import type { Json } from "@/lib/database.types";

export async function discardDraft(form: FormData) {
  const staff = await getCurrentStaff();
  const kind = formText(form, "kind"), id = formText(form, "id");
  if (staff.role !== "admin" || !["invoice", "estimate"].includes(kind)) redirect("/dashboard");
  const path = kind === "invoice" ? "/invoices" : "/estimates";
  try {
    if (form.get("confirmed") !== "on") throw { code: "22023", message: "Confirm this record action before continuing." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("discard_draft_document", { p_organization_id: staff.organizationId, p_kind: kind, p_id: id, p_updated_at: formText(form, "updatedAt"), p_reason: formText(form, "reason") });
    if (error) throw error;
  } catch (error) {
    redirect(`${path}?discard=${encodeURIComponent(id)}&error=${encodeURIComponent(operationError(error, "The draft could not be discarded. It may have linked records."))}`);
  }
  revalidatePath("/", "layout");
  redirect(`${path}?created=Draft%20discarded.`);
}

export async function manageRecord(form: FormData) {
  const staff = await getCurrentStaff();
  const kind = formText(form, "kind");
  const id = formText(form, "id");
  const mode = formText(form, "mode");
  const definition = recordDefinition(kind);
  if (staff.role !== "admin" || !definition || !["edit", "archive", "restore"].includes(mode)) redirect("/dashboard");
  const returnTo = recordManagementHref(kind, id, mode as "edit" | "archive" | "restore");
  try {
    if (mode !== "edit" && form.get("confirmed") !== "on") throw new Error("Confirm this record action before continuing.");
    const changes: Record<string, Json> = {};
    if (mode === "edit") for (const field of definition.fields) {
      const value = formText(form, field.name);
      if ((field.required && !value) || value.length > (field.maxLength ?? 240)) throw new Error("Check the required fields and text length.");
      if (field.options && !field.options.some(option => option.value === value)) throw new Error("Choose a valid option.");
      if (field.type === "number" && !/^\d{1,9}(\.\d{1,3})?$/.test(value)) throw { code: "22023", message: "Enter a non-negative price." };
      if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw { code: "22023", message: "Enter a valid email address." };
      changes[field.name] = field.type === "number" ? Number(value) : value || null;
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("manage_directory_record", {
      p_organization_id: staff.organizationId, p_kind: kind, p_id: id, p_mode: mode,
      p_updated_at: formText(form, "updatedAt"), p_changes: changes, p_reason: formText(form, "reason"),
    });
    if (error) throw error;
  } catch (error) {
    redirect(`${returnTo}&error=${encodeURIComponent(operationError(error, "The record could not be updated."))}`);
  }
  revalidatePath("/", "layout");
  const message = mode === "edit" ? "Record updated." : mode === "archive" ? "Record archived. Linked history is preserved." : "Record restored.";
  redirect(`${definition.back}${definition.back.includes("?") ? "&" : "?"}created=${encodeURIComponent(message)}`);
}
