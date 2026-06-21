import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvoice, usePayments, useAddPayment, useDeletePayment } from "@/features/invoices/hooks";
import { sumPayments } from "@/features/invoices/payments";
import { InvoiceStatusBadge } from "@/features/invoices/InvoiceStatusBadge";
import { PaymentForm } from "@/features/invoices/PaymentForm";
import type { Payment } from "@/features/invoices/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="opacity-60">{label}</dt><dd>{value}</dd></div>;
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

  if (isLoading) return <p className="opacity-70">{t("common.loading")}</p>;
  if (!invoice) return <p className="opacity-70">{t("invoices.notFound")}</p>;

  const paid = sumPayments(payments ?? []);
  const balance = Math.max(0, Math.round((invoice.total - paid) * 1000) / 1000);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link to="/invoices" className="text-sm opacity-60 hover:opacity-100">← {t("actions.back")}</Link>
          <h2 className="text-2xl font-bold">{t("invoices.invoice")} #{invoice.invoice_number}</h2>
          <p className="opacity-70 text-sm">
            <Link to={`/orders/${invoice.service_order_id}`} className="underline">
              {t("invoices.forOrder")} #{invoice.service_orders?.order_number ?? "—"}
            </Link>
            {invoice.service_orders?.customers?.name ? ` · ${invoice.service_orders.customers.name}` : ""}
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.payment_status} />
      </div>

      <dl className="max-w-xs space-y-1 text-sm">
        <Row label={t("invoices.subtotal")} value={fmt(invoice.subtotal)} />
        <Row label={t("invoices.discountTotal")} value={fmt(invoice.discount_total)} />
        <div className="flex justify-between gap-4 font-semibold"><dt>{t("invoices.total")}</dt><dd>{fmt(invoice.total)} JOD</dd></div>
        <Row label={t("invoices.paid")} value={fmt(paid)} />
        <div className="flex justify-between gap-4 font-semibold"><dt>{t("invoices.balance")}</dt><dd>{fmt(balance)} JOD</dd></div>
      </dl>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("invoices.payments")}</h3>
          {!adding && <Button onClick={() => setAdding(true)}>{t("invoices.recordPayment")}</Button>}
        </div>
        {adding && (
          <PaymentForm submitting={add.isPending} onCancel={() => setAdding(false)}
            onSubmit={(p) => add.mutate(p, { onSuccess: () => setAdding(false), onError: onErr })} />
        )}
        {!payments || payments.length === 0 ? (
          !adding && <p className="opacity-70">{t("invoices.noPayments")}</p>
        ) : (
          <ul className="border rounded-lg divide-y">
            {payments.map((p: Payment) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span>{fmt(p.amount)} JOD <span className="opacity-50">· {t(`paymentMethod.${p.method}`)}</span>{p.note ? ` · ${p.note}` : ""}</span>
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
