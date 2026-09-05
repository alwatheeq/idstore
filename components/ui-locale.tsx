"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translatePageText, translateStatus, translateUi, type UiLocale, uiLocaleCookie } from "@/lib/i18n/ui";

type UiLocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (value: string) => string;
  pageText: (value: string) => string;
  statusText: (value: string) => string;
};

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null);

export function UiLocaleProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: UiLocale }) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo<UiLocaleContextValue>(() => ({
    locale,
    setLocale(nextLocale) {
      document.cookie = `${uiLocaleCookie}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setLocaleState(nextLocale);
    },
    t: (text) => translateUi(text, locale),
    pageText: (text) => translatePageText(text, locale),
    statusText: (text) => translateStatus(text, locale),
  }), [locale]);

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>;
}

export function useUiLocale() {
  const context = useContext(UiLocaleContext);
  if (!context) throw new Error("useUiLocale must be used within UiLocaleProvider");
  return context;
}
