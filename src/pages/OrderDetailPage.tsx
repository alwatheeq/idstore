import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrder, useAdvanceStatus, useApproveOrder } from "@/features/orders/hooks";
import { OrderStatusBadge } from "@/features/orders/OrderStatusBadge";
import { canAdvance } from "@/features/orders/status";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/auth/useAuth";
import { LineItemsEditor } from "@/features/orders/LineItemsEditor";
import { InspectionMedia } from "@/features/orders/InspectionMedia";
import { useInvoiceByOrder, useGenerateInvoice } from "@/features/invoices/hooks";

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1">
      <dt className="opacity-60">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}

export function OrderDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const toast = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { data: order, isLoading } = useOrder(id);
  const advance = useAdvanceStatus(id);
  const approve = useApproveOrder(id);
  const { data: invoice } = useInvoiceByOrder(id);
  const generate = useGenerateInvoice();

  if (isLoading) return <p className="opacity-70">{t("common.loading")}</p>;
  if (!order) return <p className="opacity-70">{t("orders.notFound")}</p>;

  const email = session?.user?.email ?? "admin";
  const vehicle = [order.vehicles?.model, order.vehicles?.plate_number].filter(Boolean).join(" ");
  const onErr = () => toast.show(t("errors.saveFailed"));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link to="/orders" className="text-sm opacity-60 hover:opacity-100">
            ← {t("actions.back")}
          </Link>
          <h2 className="text-2xl font-bold">
            {t("orders.order")} #{order.order_number}
          </h2>
          <p className="opacity-70 text-sm">
            {vehicle}
            {order.customers?.name ? ` · ${order.customers.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status} />
          {order.status === "awaiting_approval" ? (
            <Button
              onClick={() => approve.mutate(email, { onError: onErr })}
              disabled={approve.isPending}
            >
              {t("orders.approve")}
            </Button>
          ) : canAdvance(order.status) ? (
            <Button
              variant="ghost"
              onClick={() => advance.mutate(order.status, { onError: onErr })}
              disabled={advance.isPending}
            >
              {t("orders.advance")}
            </Button>
          ) : null}
          {invoice ? (
            <Link to={`/invoices/${invoice.id}`} className={buttonClasses("ghost")}>{t("invoices.view")}</Link>
          ) : (
            <Button
              variant="ghost"
              disabled={generate.isPending}
              onClick={() =>
                generate.mutate(id, {
                  onSuccess: (inv) => navigate(`/invoices/${inv.id}`),
                  onError: () => toast.show(t("errors.saveFailed")),
                })
              }
            >
              {t("invoices.generate")}
            </Button>
          )}
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">{t("orders.intake")}</h3>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <Field label={t("orders.odometer")} value={order.odometer_at_intake} />
          <Field label={t("orders.charge")} value={order.charge_percent} />
          <Field label={t("orders.battery")} value={order.hv_battery_state} />
          <Field label={t("orders.concerns")} value={order.reported_concerns} />
        </dl>
        {order.intake_notes && (
          <p className="text-sm opacity-80 pt-1">{order.intake_notes}</p>
        )}
        {order.approved_at && (
          <p className="text-xs opacity-60">
            {t("orders.approvedAt")}: {order.approved_by}
          </p>
        )}
      </section>

      <LineItemsEditor orderId={id} />
      <InspectionMedia orderId={id} />
    </div>
  );
}
