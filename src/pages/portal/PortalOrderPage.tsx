import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useOrder, useLines, useMedia } from "@/features/orders/hooks";
import { useInvoiceByOrder } from "@/features/invoices/hooks";
import { signedMediaUrl } from "@/features/orders/api";
import { computeOrderTotals } from "@/features/orders/lineMath";
import { OrderStatusBadge } from "@/features/orders/OrderStatusBadge";
import type { InspectionMedia } from "@/features/orders/types";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1">
      <dt className="opacity-60">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}

function MediaThumb({ item }: { item: InspectionMedia }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["signed", item.storage_path],
    queryFn: () => signedMediaUrl(item.storage_path),
    staleTime: 50 * 60 * 1000, // 50 min — well under the 1 h signed URL TTL
  });

  if (isLoading) return <div className="w-28 h-20 bg-gray-100 rounded-lg animate-pulse" />;
  if (!url) return null;

  return item.media_type === "video" ? (
    <video
      src={url}
      controls
      className="w-28 h-20 object-cover rounded-lg border"
    />
  ) : (
    <img
      src={url}
      alt={item.caption ?? ""}
      className="w-28 h-20 object-cover rounded-lg border"
    />
  );
}

export function PortalOrderPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { data: order, isLoading } = useOrder(id);
  const { data: lines } = useLines(id);
  const { data: media } = useMedia(id);
  const { data: invoice } = useInvoiceByOrder(id);

  if (isLoading) return <p className="opacity-70">{t("common.loading")}</p>;
  if (!order) return <p className="opacity-70">{t("portal.noOrders")}</p>;

  const totals = computeOrderTotals(lines ?? []);
  const vehicleLabel = [order.vehicles?.model, order.vehicles?.plate_number]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Link
          to={order.vehicle_id ? `/portal/vehicles/${order.vehicle_id}` : "/portal"}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← {t("actions.back")}
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">
              {t("portal.order")} #{order.order_number}
            </h2>
            <p className="text-sm opacity-70">{vehicleLabel}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {/* Intake */}
      <section className="space-y-2">
        <h3 className="text-lg font-semibold">{t("portal.intake")}</h3>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <Field label={t("orders.odometer")} value={order.odometer_at_intake} />
          <Field label={t("orders.charge")} value={order.charge_percent} />
          <Field label={t("orders.battery")} value={order.hv_battery_state} />
          <Field label={t("orders.concerns")} value={order.reported_concerns} />
        </dl>
        {order.intake_notes && (
          <p className="text-sm opacity-80 pt-1">{order.intake_notes}</p>
        )}
      </section>

      {/* Line items */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">{t("portal.items")}</h3>
        {!lines || lines.length === 0 ? (
          <p className="opacity-70">{t("orders.noLines")}</p>
        ) : (
          <>
            <ul className="border rounded-xl divide-y text-sm">
              {lines.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="flex-1">{l.description}</span>
                  <span className="opacity-60 whitespace-nowrap">
                    {l.quantity} × {l.unit_price.toFixed(3)}
                  </span>
                  <span className="font-medium whitespace-nowrap">
                    {l.line_total.toFixed(3)} JOD
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-sm space-y-1 max-w-xs ms-auto">
              <div className="flex justify-between gap-4">
                <span className="opacity-60">{t("orders.subtotal")}</span>
                <span>{totals.subtotal.toFixed(3)}</span>
              </div>
              {totals.discountTotal > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="opacity-60">{t("orders.discountTotal")}</span>
                  <span>{totals.discountTotal.toFixed(3)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 font-semibold">
                <span>{t("orders.grandTotal")}</span>
                <span>{totals.total.toFixed(3)} JOD</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Photos */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">{t("portal.photos")}</h3>
        {!media || media.length === 0 ? (
          <p className="opacity-70">{t("orders.noMedia")}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {media.map((item) => (
              <MediaThumb key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Invoice link */}
      {invoice && (
        <section>
          <Link
            to={`/portal/invoices/${invoice.id}`}
            className="inline-block border rounded-xl px-5 py-3 text-sm font-medium hover:shadow-md transition-shadow"
          >
            {t("portal.invoice")} #{invoice.invoice_number} →
          </Link>
        </section>
      )}
    </div>
  );
}
