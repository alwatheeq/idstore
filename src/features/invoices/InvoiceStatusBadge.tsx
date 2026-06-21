import { useTranslation } from "react-i18next";
import type { PaymentStatus } from "@/lib/money";

const colors: Record<PaymentStatus, string> = {
  unpaid: "bg-danger-soft text-danger",
  partial: "bg-warn-soft text-warn",
  paid: "bg-ok-soft text-ok",
};

export function InvoiceStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`badge ${colors[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {t(`paymentStatus.${status}`)}
    </span>
  );
}
