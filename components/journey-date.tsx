"use client";

import { useUiLocale } from "@/components/ui-locale";

export function JourneyDate({ value }: { value: string }) {
  const { locale } = useUiLocale();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>—</span>;
  // ICU embeds RTL marks in Arabic numeric dates. Remove those marks because
  // this app intentionally keeps the complete date (including separators) LTR.
  const formatted = new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-JO", { dateStyle: "medium", timeZone: "Asia/Amman" }).format(date).replace(/[\u061c\u200e\u200f]/g, "");
  return <time dir="ltr" dateTime={value}>{formatted}</time>;
}
