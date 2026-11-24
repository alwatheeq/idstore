import type { Metadata } from "next";
import { cookies } from "next/headers";
import { uiLocaleCookie, type UiLocale } from "@/lib/i18n/ui";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
import "@fontsource/tajawal/900.css";
import "./globals.css";
import "./apple.css";
import "./record-actions.css";
import "./folder-tabs.css";

export const metadata: Metadata = {
  title: "IDstore Service Operations",
  description: "Multi-branch VW ID electric vehicle service center operations.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale: UiLocale = cookieStore.get(uiLocaleCookie)?.value === "ar" ? "ar" : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>{children}</body>
    </html>
  );
}
