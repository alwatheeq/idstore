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

export function zonedLocalToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Choose a valid date and time.");
  const [, year, month, day, hour, minute] = match.map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcGuess));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const representedAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  return new Date(utcGuess - (representedAsUtc - utcGuess)).toISOString();
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
