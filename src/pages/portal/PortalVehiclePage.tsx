import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMyVehicle, useVehicleOrders } from "./portalData";
import { OrderStatusBadge } from "@/features/orders/OrderStatusBadge";

export function PortalVehiclePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: vehicle, isLoading: vehicleLoading } = useMyVehicle(id);
  const { data: orders, isLoading: ordersLoading } = useVehicleOrders(id);

  if (vehicleLoading) return <p className="opacity-70">{t("common.loading")}</p>;
  if (!vehicle) return <p className="opacity-70">{t("portal.noVehicles")}</p>;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link to="/portal" className="text-sm opacity-60 hover:opacity-100">
          ← {t("actions.back")}
        </Link>
        <h2 className="text-2xl font-bold">{vehicle.model ?? "—"}</h2>
        <p className="text-sm opacity-70">
          {[vehicle.plate_number, vehicle.vin].filter(Boolean).join(" · ")}
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">{t("portal.serviceHistory")}</h3>
        {ordersLoading ? (
          <p className="opacity-70">{t("common.loading")}</p>
        ) : !orders || orders.length === 0 ? (
          <p className="opacity-70">{t("portal.noOrders")}</p>
        ) : (
          <ul className="border rounded-xl divide-y">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/portal/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium">#{o.order_number}</span>
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
