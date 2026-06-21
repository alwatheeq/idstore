import type { ReactNode } from "react";
import { useEffect } from "react";
import { DirectionProvider as RadixDirection } from "@radix-ui/react-direction";
import { useTranslation } from "react-i18next";

export function DirectionProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const dir = i18n.language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = dir;
  }, [i18n.language, dir]);

  return <RadixDirection dir={dir}>{children}</RadixDirection>;
}
