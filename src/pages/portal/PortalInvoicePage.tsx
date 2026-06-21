import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvoice, usePayments } from "@/features/invoices/hooks";
import { sumPayments } from "@/features/invoices/payments";
import { InvoiceStatusBadge } from "@/features/invoices/InvoiceStatusBadge";
import type { Payment } from "@/features/invoices/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="opacity-60">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PortalInvoicePage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: payments } = usePayments(id);
  const fmt = (n: number) => n.toFixed(3);

  if (isLoading) return <p className="opacity-70">{t("common.loading")}</p>;
  if (!invoice) return <p className="opacity-70">{t("portal.noInvoices")}</p>;

  const paid = sumPayments(payments ?? []);
  const balance = Math.max(0, Math.round((invoice.total - paid) * 1000) / 1000);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Link to="/portal/invoices" className="text-sm opacity-60 hover:opacity-100">
          ← {t("actions.back")}
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h2 className="text-2xl font-bold">
            {t("portal.invoice")} #{invoice.invoice_number}
          </h2>
          <InvoiceStatusBadge status={invoice.payment_status} />
        </div>
      </div>

      {/* Totals */}
      <dl className="max-w-xs space-y-1 text-sm">
        <Row label={t("invoices.subtotal")} value={fmt(invoice.subtotal)} />
        <Row label={t("invoices.discountTotal")} value={fmt(invoice.discount_total)} />
        <div className="flex justify-between gap-4 font-semibold">
          <dt>{t("invoices.total")}</dt>
          <dd>{fmt(invoice.total)} JOD</dd>
        </div>
        <Row label={t("invoices.paid")} value={fmt(paid)} />
        <div className="flex justify-between gap-4 font-semibold">
          <dt>{t("invoices.balance")}</dt>
          <dd>{fmt(balance)} JOD</dd>
        </div>
      </dl>

      {/* Payments — read-only list */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">{t("invoices.payments")}</h3>
        {!payments || payments.length === 0 ? (
          <p className="opacity-70">{t("invoices.noPayments")}</p>
        ) : (
          <ul className="border rounded-xl divide-y">
            {payments.map((p: Payment) => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <span className="font-medium">{fmt(p.amount)} JOD</span>
                <span className="opacity-50">
                  · {t(`paymentMethod.${p.method}`)}
                </span>
                {p.note && <span className="opacity-70">· {p.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
