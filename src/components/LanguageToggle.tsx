import { useTranslation } from "react-i18next";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const toggle = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="text-xs border rounded-full px-3 py-1 opacity-80 hover:opacity-100"
    >
      {t("common.language")}
    </button>
  );
}
