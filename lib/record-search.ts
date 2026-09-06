/** Normalize Arabic/Latin digits and spaces; no raw SQL or PostgREST syntax. */
export function normalizeRecordSearch(value: string) {
  return value.normalize("NFKC").replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0)).trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
export function matchesRecordSearch(query: unknown, values: (string | null | undefined)[]) {
  const terms = normalizeRecordSearch((typeof query === "string" ? query : "").slice(0,120)).split(" ").filter(Boolean);
  const haystack = normalizeRecordSearch(values.filter(Boolean).join(" "));
  return terms.every(term => haystack.includes(term));
}
