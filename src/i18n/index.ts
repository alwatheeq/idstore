// Language persistence is handled manually:
//   - LanguageToggle writes `localStorage.setItem("lang", ...)` on every switch.
//   - index.html reads it pre-paint (inline script) so the document dir/lang is
//     set before any stylesheet or module executes, preventing the RTL flash.
// DO NOT add `i18next-browser-languagedetector` here — it would double-write
// localStorage and potentially conflict with the pre-paint script.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ar from "./ar.json";

const saved = localStorage.getItem("lang") ?? "en";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: saved,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
