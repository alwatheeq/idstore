import { useTranslation } from "react-i18next";

export function SettingsPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.settings")}</h2>;
}
