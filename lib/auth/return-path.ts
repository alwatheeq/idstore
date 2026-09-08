import { navigationGroups } from "@/lib/navigation";

const destinations = new Set([...navigationGroups.flatMap(group => group.items.map(item => item.href)), "/search", "/records/manage", "/portal"]);

/** A return URL is navigation context, never authority to access that record. */
export function safeReturnPath(value: unknown, fallback = "/work-orders") {
  if (typeof value !== "string" || value.length > 2000 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://idstore.invalid");
    if (url.origin !== "https://idstore.invalid" || !destinations.has(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
