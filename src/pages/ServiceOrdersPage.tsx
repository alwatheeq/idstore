import { useTranslation } from "react-i18next";

export function ServiceOrdersPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.orders")}</h2>;
}
