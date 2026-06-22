import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import { useItems, useUpdateItem, useMovements } from "@/features/inventory/hooks";
import { ItemForm } from "@/features/inventory/ItemForm";
import { StockActionForm, type StockAction } from "@/features/inventory/StockActionForm";
import { isLowStock } from "@/features/inventory/stock";
import type { InventoryMovement } from "@/features/inventory/types";

const ACTIONS: StockAction[] = ["receive", "issue", "adjust", "transfer", "count"];

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="micro">{label}</div>
      <div className={`num text-lg font-semibold ${accent ? "text-warn" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function MovementHistory({ movements }: { movements: InventoryMovement[] }) {
  const { t } = useTranslation();
  if (movements.length === 0) {
    return (
      <div className="card grid place-items-center p-8 text-sm text-muted">
        {t("inventory.noMovements")}
      </div>
    );
  }
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {movements.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <span className="badge bg-paper-2 text-ink-2">{t(`inventory.type.${m.type}`)}</span>
            {m.reference && <span className="text-muted">{m.reference}</span>}
          </span>
          <span className="flex items-center gap-3">
            <span className={`num font-semibold ${m.quantity_delta < 0 ? "text-danger" : "text-ok"}`}>
              {m.quantity_delta > 0 ? "+" : ""}
              {m.quantity_delta}
            </span>
            <span className="num text-xs text-muted">{m.created_at.slice(0, 10)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ItemDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { isAll } = useActiveBranch();
  const { data: items, isLoading } = useItems();
  const item = items?.find((i) => i.id === id);
  const { data: movements } = useMovements(id);
  const update = useUpdateItem(id);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<StockAction | null>(null);

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!item) return <p className="text-sm text-muted">{t("inventory.notFound")}</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="space-y-2">
          <BackLink to="/inventory">{t("actions.back")}</BackLink>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{item.name}</h2>
          <p className="text-sm text-muted">
            {item.sku && <span className="num">{item.sku}</span>}
            {item.category ? ` · ${item.category}` : ""}
          </p>
        </div>
        {!editing && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {t("actions.edit")}
          </Button>
        )}
      </div>

      {editing ? (
        <ItemForm
          defaultValues={item}
          submitting={update.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={(p) => update.mutate(p, { onSuccess: () => setEditing(false) })}
        />
      ) : (
        <>
          <div className="card p-5">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat
                label={t("inventory.onHand")}
                value={`${item.quantity} ${item.unit}`}
                accent={isLowStock(item)}
              />
              <Stat label={t("inventory.cost")} value={item.cost.toFixed(3)} />
              <Stat label={t("inventory.salePrice")} value={item.sale_price.toFixed(3)} />
              <Stat label={t("inventory.stockValue")} value={(item.quantity * item.cost).toFixed(3)} />
            </div>
            {isLowStock(item) && (
              <p className="micro mt-4 text-warn">
                {t("inventory.belowReorder", { level: item.reorder_level })}
              </p>
            )}
          </div>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight text-ink">
                {t("inventory.movements")}
              </h3>
              {isAll ? (
                <span className="text-xs font-medium text-muted">
                  {t("inventory.pickBranchForStock")}
                </span>
              ) : (
                !action && (
                  <div className="flex flex-wrap gap-2">
                    {ACTIONS.map((a) => (
                      <Button key={a} variant="ghost" onClick={() => setAction(a)}>
                        {t(`inventory.action.${a}`)}
                      </Button>
                    ))}
                  </div>
                )
              )}
            </div>
            {action && (
              <StockActionForm
                item={item}
                currentQty={item.quantity}
                action={action}
                onDone={() => setAction(null)}
              />
            )}
            <MovementHistory movements={movements ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
