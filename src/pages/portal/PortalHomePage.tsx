import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMyVehicles } from "./portalData";

export function PortalHomePage() {
  const { t } = useTranslation();
  const { data: vehicles, isLoading } = useMyVehicles();

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-ink">{t("portal.myVehicles")}</h2>
      {!vehicles || vehicles.length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">
          {t("portal.noVehicles")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              to={`/portal/vehicles/${v.id}`}
              className="card space-y-1 p-5 transition-colors hover:bg-paper-2"
            >
              <p className="font-semibold text-ink">{v.model ?? "—"}</p>
              <p className="num text-sm text-muted">{v.plate_number ?? "—"}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
