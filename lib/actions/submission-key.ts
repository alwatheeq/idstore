import "server-only";
import { formText } from "@/lib/actions/form";

export function submissionKey(form: FormData) {
  const key = formText(form, "idempotencyKey");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw { code: "22023", message: "This form has expired. Refresh before submitting again." };
  }
  return key;
}
