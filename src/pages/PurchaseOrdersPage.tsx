import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import { usePurchaseOrders, useCreatePurchaseOrder } from "@/features/purchasing/hooks";
import { POForm } from "@/features/purchasing/POForm";
import { POStatusBadge } from "@/features/purchasing/POStatusBadge";

export function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAll } = useActiveBranch();
  const { data: pos, isLoading } = usePurchaseOrders();
  const create = useCreatePurchaseOrder();
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink to="/inventory">{t("actions.back")}</BackLink>
        <PageHeader
          title={t("po.title")}
          eyebrow={t("nav.inventory")}
          actions={
            isAll ? (
              <span className="text-xs font-medium text-muted">{t("branch.pickToCreate")}</span>
            ) : (
              !adding && <Button onClick={() => setAdding(true)}>{t("po.newPO")}</Button>
            )
          }
        />
      </div>

      {adding && (
        <POForm
          submitting={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(p) =>
            create.mutate(p, { onSuccess: (po) => navigate(`/purchase-orders/${po.id}`) })
          }
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : (pos ?? []).length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">{t("po.empty")}</div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {(pos ?? []).map((p) => (
            <li key={p.id}>
              <Link
                to={`/purchase-orders/${p.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-paper-2"
              >
                <span className="font-medium text-ink">
                  <span className="num text-muted">PO #{p.po_number}</span>
                  {p.suppliers?.name ? ` · ${p.suppliers.name}` : ""}
                </span>
                <POStatusBadge status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
