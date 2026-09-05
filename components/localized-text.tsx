"use client";

import { useUiLocale } from "@/components/ui-locale";

export function LocalizedText({ children }: { children: string }) {
  const { pageText } = useUiLocale();
  return <>{pageText(children)}</>;
}
