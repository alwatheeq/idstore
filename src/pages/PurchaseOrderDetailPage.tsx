import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import {
  usePurchaseOrder,
  useAddPOLine,
  useDeletePOLine,
  useSetPOStatus,
  useReceivePO,
} from "@/features/purchasing/hooks";
import { POLineForm } from "@/features/purchasing/POLineForm";
import { POStatusBadge } from "@/features/purchasing/POStatusBadge";

export function PurchaseOrderDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { data: po, isLoading } = usePurchaseOrder(id);
  const addLine = useAddPOLine(id);
  const delLine = useDeletePOLine(id);
  const setStatus = useSetPOStatus(id);
  const receive = useReceivePO(id);

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!po) return <p className="text-sm text-muted">{t("po.notFound")}</p>;

  const lines = po.purchase_order_lines;
  const total = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
  const isDraft = po.status === "draft";
  const isOrdered = po.status === "ordered";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="space-y-2">
          <BackLink to="/purchase-orders">{t("actions.back")}</BackLink>
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            {t("po.po")} <span className="num">#{po.po_number}</span>
          </h2>
          <p className="text-sm text-muted">
            {po.suppliers?.name ?? ""}
            {po.reference ? ` · ${po.reference}` : ""}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <POStatusBadge status={po.status} />
          {isDraft && (
            <Button
              onClick={() => setStatus.mutate("ordered")}
              disabled={lines.length === 0 || setStatus.isPending}
            >
              {t("po.markOrdered")}
            </Button>
          )}
          {isOrdered && (
            <Button onClick={() => receive.mutate(po)} disabled={receive.isPending}>
              {t("po.receiveAll")}
            </Button>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("po.lines")}</h3>
        {lines.length === 0 ? (
          <div className="card grid place-items-center p-8 text-sm text-muted">{t("po.noLines")}</div>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{l.inventory_items?.name ?? "—"}</p>
                  <p className="num text-xs text-muted">
                    {l.quantity} × {l.unit_cost.toFixed(3)}
                    {l.received_qty > 0 ? ` · ${t("po.received")} ${l.received_qty}` : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <span className="num text-ink-2">{(l.quantity * l.unit_cost).toFixed(3)}</span>
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => delLine.mutate(l.id)}
                      className="text-xs font-semibold text-danger transition-colors hover:underline"
                    >
                      {t("actions.delete")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <span className="num text-sm font-semibold text-ink">
            {t("po.total")}: {total.toFixed(3)} JOD
          </span>
        </div>
        {isDraft && <POLineForm submitting={addLine.isPending} onAdd={(p) => addLine.mutate(p)} />}
      </section>
    </div>
  );
}
