import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { useItems } from "@/features/inventory/hooks";
import type { POLinePayload } from "./schema";

const inputClass =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-volt-deep";

export function POLineForm({
  submitting,
  onAdd,
}: {
  submitting?: boolean;
  onAdd: (p: POLinePayload) => void;
}) {
  const { t } = useTranslation();
  const { data: items } = useItems();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function pick(id: string) {
    setItemId(id);
    const it = items?.find((i) => i.id === id);
    if (it) setUnitCost(String(it.cost));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const q = Number(qty);
    if (!itemId) return setErr(t("po.pickItem"));
    if (!(q > 0)) return setErr(t("inventory.qtyPositive"));
    onAdd({ item_id: itemId, quantity: q, unit_cost: Number(unitCost) || 0 });
    setItemId("");
    setQty("");
    setUnitCost("");
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-3">
          <label className="block text-sm font-medium text-ink-2">{t("po.item")}</label>
          <select className={inputClass} value={itemId} onChange={(e) => pick(e.target.value)}>
            <option value="">—</option>
            {(items ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.sku ? ` · ${i.sku}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-2">{t("inventory.quantity")}</label>
          <input className={inputClass} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-2">{t("inventory.unitCost")}</label>
          <input className={inputClass} inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </div>
      </div>
      {err && <p className="text-xs font-medium text-danger">{err}</p>}
      <Button type="submit" disabled={submitting}>{t("po.addLine")}</Button>
    </form>
  );
}
