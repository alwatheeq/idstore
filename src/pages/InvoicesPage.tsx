import { useTranslation } from "react-i18next";

export function InvoicesPage() {
  const { t } = useTranslation();
  return <h2 className="text-xl font-bold">{t("nav.invoices")}</h2>;
}
