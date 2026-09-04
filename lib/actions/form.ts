import "server-only";

export function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function optionalText(formData: FormData, key: string) {
  return formText(formData, key) || undefined;
}

export function optionalNumber(formData: FormData, key: string) {
  const value = formText(formData, key);
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

export function operationError(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const value = error as { code?: string; message?: string };
  if (value.code === "23505") return "A record with the same identifying value already exists.";
  if (value.code === "23P01") return "This vehicle already has an overlapping appointment.";
  if (value.code === "42501") return "Your account is not authorized for this operation.";
  if (value.code === "40001") return "This record changed. Refresh the page and try again.";
  if (value.code === "P0002") return "The requested record no longer exists.";
  if (value.code === "23514" || value.code === "22023") return value.message || fallback;
  return fallback;
}

export function routeMessage(path: string, key: "error" | "created", message: string) {
  return `${path}?${key}=${encodeURIComponent(message)}`;
}
