import { useTranslation } from "react-i18next";

export function DashboardPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.dashboard")}</h2>;
}
