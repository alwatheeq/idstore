import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/PageHeader";

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.settings")} eyebrow={t("nav.settings")} />
    </div>
  );
}
