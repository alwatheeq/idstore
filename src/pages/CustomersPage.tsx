import { useTranslation } from "react-i18next";

export function CustomersPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.customers")}</h2>;
}
