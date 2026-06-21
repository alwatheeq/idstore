import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDueVehicles } from "@/features/software/hooks";
import { PageHeader } from "@/components/ui/PageHeader";

export function SoftwarePage() {
  const { t } = useTranslation();
  const { data: due, isLoading } = useDueVehicles();

  return (
    <div className="space-y-6">
      <PageHeader title={t("software.title")} eyebrow={t("nav.software")} />

      {isLoading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : !due || due.length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">
          {t("software.allUpToDate")}
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {due.map((v) => (
            <li key={v.id}>
              <Link
                to={`/vehicles/${v.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-paper-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-ink">
                    {v.model ?? "—"} <span className="num text-muted">{v.plate_number ?? ""}</span>
                  </p>
                  <p className="text-xs text-muted">{v.customers?.name ?? ""}</p>
                </div>
                <p className="num flex-shrink-0 text-sm text-ink-2">
                  {v.software_version ?? "—"}
                  <span className="rtl-flip mx-1.5 inline-block text-muted">→</span>
                  {v.target_software_version}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
