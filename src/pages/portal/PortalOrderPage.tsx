import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useOrder, useLines, useMedia } from "@/features/orders/hooks";
import { useInvoiceByOrder } from "@/features/invoices/hooks";
import { signedMediaUrl } from "@/features/orders/api";
import { computeOrderTotals } from "@/features/orders/lineMath";
import { OrderStatusBadge } from "@/features/orders/OrderStatusBadge";
import { BackLink } from "@/components/ui/BackLink";
import type { InspectionMedia } from "@/features/orders/types";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink-2">{value ?? "—"}</dd>
    </div>
  );
}

function MediaThumb({ item }: { item: InspectionMedia }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["signed", item.storage_path],
    queryFn: () => signedMediaUrl(item.storage_path),
    staleTime: 50 * 60 * 1000, // 50 min — well under the 1 h signed URL TTL
  });

  if (isLoading) return <div className="h-20 w-28 animate-pulse rounded-lg bg-paper-2" />;
  if (!url) return null;

  return item.media_type === "video" ? (
    <video
      src={url}
      controls
      className="h-20 w-28 rounded-lg border border-line object-cover"
    />
  ) : (
    <img
      src={url}
      alt={item.caption ?? ""}
      className="h-20 w-28 rounded-lg border border-line object-cover"
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

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!order) return <p className="text-sm text-muted">{t("portal.noOrders")}</p>;

  const totals = computeOrderTotals(lines ?? []);
  const vehicleLabel = [order.vehicles?.model, order.vehicles?.plate_number]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 border-b border-line pb-5">
        <BackLink to={order.vehicle_id ? `/portal/vehicles/${order.vehicle_id}` : "/portal"}>
          {t("actions.back")}
        </BackLink>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              {t("portal.order")} <span className="num">#{order.order_number}</span>
            </h2>
            <p className="num text-sm text-muted">{vehicleLabel}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {/* Intake */}
      <section className="card space-y-2 p-5">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("portal.intake")}</h3>
        <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <Field label={t("orders.odometer")} value={order.odometer_at_intake} />
          <Field label={t("orders.charge")} value={order.charge_percent} />
          <Field label={t("orders.battery")} value={order.hv_battery_state} />
          <Field label={t("orders.concerns")} value={order.reported_concerns} />
        </dl>
        {order.intake_notes && <p className="pt-1 text-sm text-ink-2">{order.intake_notes}</p>}
      </section>

      {/* Line items */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("portal.items")}</h3>
        {!lines || lines.length === 0 ? (
          <div className="card grid place-items-center p-12 text-sm text-muted">
            {t("orders.noLines")}
          </div>
        ) : (
          <>
            <ul className="card divide-y divide-line overflow-hidden text-sm">
              {lines.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <span className="flex-1 text-ink">{l.description}</span>
                  <span className="num whitespace-nowrap text-muted">
                    {l.quantity} × {l.unit_price.toFixed(3)}
                  </span>
                  <span className="num whitespace-nowrap font-medium text-ink">
                    {l.line_total.toFixed(3)} JOD
                  </span>
                </li>
              ))}
            </ul>
            <div className="ms-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted">{t("orders.subtotal")}</span>
                <span className="num text-ink-2">{totals.subtotal.toFixed(3)}</span>
              </div>
              {totals.discountTotal > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted">{t("orders.discountTotal")}</span>
                  <span className="num text-ink-2">{totals.discountTotal.toFixed(3)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 font-semibold text-ink">
                <span>{t("orders.grandTotal")}</span>
                <span className="num">{totals.total.toFixed(3)} JOD</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Photos */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("portal.photos")}</h3>
        {!media || media.length === 0 ? (
          <div className="card grid place-items-center p-12 text-sm text-muted">
            {t("orders.noMedia")}
          </div>
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
            className="card inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper-2"
          >
            {t("portal.invoice")} <span className="num">#{invoice.invoice_number}</span>
            <span className="rtl-flip" aria-hidden>→</span>
          </Link>
        </section>
      )}
    </div>
  );
}
