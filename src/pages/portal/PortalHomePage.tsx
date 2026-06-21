import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMyVehicles } from "./portalData";

export function PortalHomePage() {
  const { t } = useTranslation();
  const { data: vehicles, isLoading } = useMyVehicles();

  if (isLoading) return <p className="opacity-70">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t("portal.myVehicles")}</h2>
      {!vehicles || vehicles.length === 0 ? (
        <p className="opacity-70">{t("portal.noVehicles")}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              to={`/portal/vehicles/${v.id}`}
              className="block border rounded-xl p-5 space-y-1 hover:shadow-md transition-shadow"
            >
              <p className="font-semibold">{v.model ?? "—"}</p>
              <p className="text-sm opacity-60">{v.plate_number ?? "—"}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
