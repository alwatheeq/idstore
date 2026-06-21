import { useTranslation } from "react-i18next";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const toggle = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    void i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
    >
      {t("common.language")}
    </button>
  );
}
