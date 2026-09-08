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
  const invalid = () => Object.assign(new Error("Choose a valid, unambiguous date and time for this branch."), { code: "22023" });
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw invalid();
  const [, year, month, day, hour, minute] = match.map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(utcGuess);
  if (year < 100 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59) throw invalid();
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }); } catch { throw invalid(); }
  const wallTime = (timestamp: number) => {
    const parts = formatter.formatToParts(new Date(timestamp));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  };
  // Sample offsets on both sides of a possible daylight-saving transition.
  // A local time in a gap has no match; a repeated time has two matches.
  const candidates = new Set([-36, 0, 36].map(hours => {
    const probe = utcGuess + hours * 3600000;
    return utcGuess - (wallTime(probe) - probe);
  }).filter(candidate => wallTime(candidate) === utcGuess));
  if (candidates.size !== 1) throw invalid();
  return new Date([...candidates][0]).toISOString();
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
