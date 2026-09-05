"use client";

import { Languages } from "lucide-react";
import { LocalizedContent } from "@/components/localized-content";
import { UiLocaleProvider, useUiLocale } from "@/components/ui-locale";
import type { UiLocale } from "@/lib/i18n/ui";

export function PublicLocalizedPage({ children, initialLocale }: { children: React.ReactNode; initialLocale: UiLocale }) {
  return (
    <UiLocaleProvider initialLocale={initialLocale}>
      <LocalizedContent>{children}</LocalizedContent>
    </UiLocaleProvider>
  );
}

export function PublicLocaleToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useUiLocale();
  const nextLocale: UiLocale = locale === "ar" ? "en" : "ar";
  return (
    <button
      className={`button compact public-locale-toggle ${className}`.trim()}
      type="button"
      aria-label={t(locale === "ar" ? "Change language to English" : "Change language to Arabic")}
      onClick={() => setLocale(nextLocale)}
    >
      <Languages aria-hidden="true" />
      {locale === "ar" ? "English" : "العربية"}
    </button>
  );
}
