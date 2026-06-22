import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useItems, useCreateItem } from "@/features/inventory/hooks";
import { ItemForm } from "@/features/inventory/ItemForm";
import { isLowStock, lowStockItems, stockValue } from "@/features/inventory/stock";

export function InventoryPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const { data: items, isLoading } = useItems(search);
  const create = useCreateItem();

  const list = items ?? [];
  const value = stockValue(list);
  const low = lowStockItems(list).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("inventory.title")}
        eyebrow={t("nav.inventory")}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/purchase-orders" className={buttonClasses("ghost")}>
              {t("po.title")}
            </Link>
            <Link to="/suppliers" className={buttonClasses("ghost")}>
              {t("inventory.suppliers")}
            </Link>
            {!adding && <Button onClick={() => setAdding(true)}>{t("inventory.newItem")}</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="micro">{t("inventory.items")}</div>
          <div className="num mt-2 text-2xl font-semibold text-ink">{list.length}</div>
        </div>
        <div className="card p-4">
          <div className="micro">{t("inventory.lowStock")}</div>
          <div className={`num mt-2 text-2xl font-semibold ${low ? "text-warn" : "text-ink"}`}>{low}</div>
        </div>
        <div className="card p-4">
          <div className="micro">{t("inventory.stockValue")}</div>
          <div className="num mt-2 text-2xl font-semibold text-volt-deep">{value.toFixed(3)} JOD</div>
        </div>
      </div>

      {adding && (
        <ItemForm
          submitting={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setAdding(false) })}
        />
      )}

      <input
        className="w-full max-w-sm rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-volt-deep"
        placeholder={t("inventory.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={t("actions.search")}
      />

      {isLoading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">
          {t("inventory.empty")}
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {list.map((i) => (
            <li key={i.id}>
              <Link
                to={`/inventory/${i.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-paper-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {i.name} {i.sku && <span className="num text-muted">· {i.sku}</span>}
                  </p>
                  <p className="text-xs text-muted">{i.category ?? ""}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  {isLowStock(i) && <span className="badge bg-warn-soft text-warn">{t("inventory.low")}</span>}
                  <span className="num text-sm text-ink-2">
                    {i.quantity} {i.unit}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
