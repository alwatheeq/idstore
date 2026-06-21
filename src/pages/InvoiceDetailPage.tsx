import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvoice, usePayments, useAddPayment, useDeletePayment } from "@/features/invoices/hooks";
import { sumPayments } from "@/features/invoices/payments";
import { InvoiceStatusBadge } from "@/features/invoices/InvoiceStatusBadge";
import { PaymentForm } from "@/features/invoices/PaymentForm";
import type { Payment } from "@/features/invoices/types";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";
import { useToast } from "@/components/ui/Toast";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-ink">{value}</dd>
    </div>
  );
}

export function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const toast = useToast();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: payments } = usePayments(id);
  const add = useAddPayment(id);
  const del = useDeletePayment(id);
  const [adding, setAdding] = useState(false);
  const onErr = () => toast.show(t("errors.saveFailed"));
  const fmt = (n: number) => n.toFixed(3);

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!invoice) return <p className="text-sm text-muted">{t("invoices.notFound")}</p>;

  const paid = sumPayments(payments ?? []);
  const balance = Math.max(0, Math.round((invoice.total - paid) * 1000) / 1000);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="space-y-2">
          <BackLink to="/invoices">{t("actions.back")}</BackLink>
          <h2 className="text-2xl font-bold tracking-tight text-ink [font-variant-numeric:tabular-nums]">
            {t("invoices.invoice")} #{invoice.invoice_number}
          </h2>
          <p className="text-sm text-muted">
            <Link
              to={`/orders/${invoice.service_order_id}`}
              className="underline transition-colors hover:text-ink"
            >
              {t("invoices.forOrder")}{" "}
              <span className="num">#{invoice.service_orders?.order_number ?? "—"}</span>
            </Link>
            {invoice.service_orders?.customers?.name ? ` · ${invoice.service_orders.customers.name}` : ""}
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.payment_status} />
      </div>

      <dl className="card max-w-xs space-y-2 p-5 text-sm">
        <Row label={t("invoices.subtotal")} value={fmt(invoice.subtotal)} />
        <Row label={t("invoices.discountTotal")} value={fmt(invoice.discount_total)} />
        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2 font-semibold">
          <dt className="text-ink">{t("invoices.total")}</dt>
          <dd className="num text-xl text-ink">{fmt(invoice.total)} JOD</dd>
        </div>
        <Row label={t("invoices.paid")} value={fmt(paid)} />
        <div className="flex items-baseline justify-between gap-4 font-semibold">
          <dt className="text-ink">{t("invoices.balance")}</dt>
          <dd className="num text-xl text-ink">{fmt(balance)} JOD</dd>
        </div>
      </dl>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{t("invoices.payments")}</h3>
          {!adding && <Button onClick={() => setAdding(true)}>{t("invoices.recordPayment")}</Button>}
        </div>
        {adding && (
          <PaymentForm submitting={add.isPending} onCancel={() => setAdding(false)}
            onSubmit={(p) => add.mutate(p, { onSuccess: () => setAdding(false), onError: onErr })} />
        )}
        {!payments || payments.length === 0 ? (
          !adding && (
            <div className="card grid place-items-center p-10 text-sm text-muted">
              {t("invoices.noPayments")}
            </div>
          )
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {payments.map((p: Payment) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
                <span className="text-ink">
                  <span className="num">{fmt(p.amount)} JOD</span>{" "}
                  <span className="text-muted">· {t(`paymentMethod.${p.method}`)}</span>
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <Button variant="danger" disabled={del.isPending}
                  onClick={() => { if (confirm(t("actions.confirmDelete"))) del.mutate(p, { onError: onErr }); }}>
                  {t("actions.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
