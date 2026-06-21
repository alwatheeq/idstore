import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMyVehicle, useVehicleOrders } from "./portalData";
import { OrderStatusBadge } from "@/features/orders/OrderStatusBadge";
import { BackLink } from "@/components/ui/BackLink";
import { useVehicleUpdates } from "@/features/software/hooks";
import { SoftwareHistory } from "@/features/software/SoftwareHistory";
import { isUpdateDue } from "@/features/software/due";
import { VehicleImage } from "@/features/vehicles/VehicleImage";

export function PortalVehiclePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: vehicle, isLoading: vehicleLoading } = useMyVehicle(id);
  const { data: orders, isLoading: ordersLoading } = useVehicleOrders(id);
  const { data: updates } = useVehicleUpdates(id);

  if (vehicleLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!vehicle) return <p className="text-sm text-muted">{t("portal.noVehicles")}</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4 border-b border-line pb-5">
        <VehicleImage model={vehicle.model} className="h-20 w-28 flex-shrink-0" />
        <div className="space-y-2">
          <BackLink to="/portal">{t("actions.back")}</BackLink>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{vehicle.model ?? "—"}</h2>
          <p className="num text-sm text-muted">
            {[vehicle.plate_number, vehicle.vin].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("software.title")}</h3>
        <div className="card flex items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <div className="micro">{t("software.currentVersion")}</div>
            <div className="num text-lg font-semibold text-ink">
              {vehicle.software_version ?? "—"}
            </div>
          </div>
          {isUpdateDue(vehicle) && (
            <span className="badge bg-volt-soft text-volt-deep">
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
              {t("software.updateAvailable")}
            </span>
          )}
        </div>
        <SoftwareHistory updates={updates ?? []} />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight text-ink">
          {t("portal.serviceHistory")}
        </h3>
        {ordersLoading ? (
          <p className="text-sm text-muted">{t("common.loading")}</p>
        ) : !orders || orders.length === 0 ? (
          <div className="card grid place-items-center p-12 text-sm text-muted">
            {t("portal.noOrders")}
          </div>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/portal/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-paper-2"
                >
                  <span className="num font-medium text-ink">#{o.order_number}</span>
                  <OrderStatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
