import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IntakeForm } from "@/features/orders/IntakeForm";
import { BackLink } from "@/components/ui/BackLink";
import { useCreateOrder } from "@/features/orders/hooks";
import { useToast } from "@/components/ui/Toast";

export function NewOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateOrder();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <BackLink to="/orders">{t("actions.back")}</BackLink>
        <h2 className="text-2xl font-bold tracking-tight text-ink">{t("orders.newOrder")}</h2>
      </div>
      <div className="card p-6">
        <IntakeForm
          submitting={create.isPending}
          onCancel={() => navigate("/orders")}
          onSubmit={(payload) =>
            create.mutate(payload, {
              onSuccess: (o) => navigate(`/orders/${o.id}`),
              onError: () => toast.show(t("errors.saveFailed")),
            })
          }
        />
      </div>
    </div>
  );
}
