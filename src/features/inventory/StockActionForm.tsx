import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import { useStockMovement, useTransferStock } from "./hooks";
import type { InventoryItem } from "./types";

export type StockAction = "receive" | "issue" | "adjust" | "transfer" | "count";

const inputClass =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-volt-deep";

function Field({
  label,
  value,
  onChange,
  inputMode = "decimal",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "decimal" | "text";
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink-2">{label}</label>
      <input
        className={inputClass}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function StockActionForm({
  item,
  currentQty,
  action,
  onDone,
}: {
  item: InventoryItem;
  currentQty: number;
  action: StockAction;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { accessible, branchId } = useActiveBranch();
  const move = useStockMovement(item.id);
  const transfer = useTransferStock(item.id);

  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState(String(item.cost ?? ""));
  const [counted, setCounted] = useState(String(currentQty));
  const [toBranch, setToBranch] = useState("");
  const [reference, setReference] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const otherBranches = accessible.filter((b) => b.id !== branchId);
  const busy = move.isPending || transfer.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const n = Number(qty);
    const done = { onSuccess: onDone };
    if (action === "count") {
      const c = Number(counted);
      if (!Number.isFinite(c) || c < 0) return setErr(t("inventory.qtyNonNeg"));
      move.mutate(
        { type: "count", quantityDelta: c - currentQty, reference: reference || t("inventory.countRef") },
        done,
      );
    } else if (action === "adjust") {
      if (!Number.isFinite(n) || n === 0) return setErr(t("inventory.deltaNonZero"));
      move.mutate({ type: "adjust", quantityDelta: n, reference }, done);
    } else if (action === "receive") {
      if (!(n > 0)) return setErr(t("inventory.qtyPositive"));
      move.mutate({ type: "receive", quantityDelta: n, unitCost: Number(unitCost) || 0, reference }, done);
    } else if (action === "issue") {
      if (!(n > 0)) return setErr(t("inventory.qtyPositive"));
      move.mutate({ type: "issue", quantityDelta: -n, reference }, done);
    } else if (action === "transfer") {
      if (!(n > 0)) return setErr(t("inventory.qtyPositive"));
      if (!toBranch) return setErr(t("inventory.pickDestination"));
      transfer.mutate({ toBranchId: toBranch, quantity: n, reference }, done);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div className="micro">{t(`inventory.action.${action}`)}</div>
      {action === "count" ? (
        <Field label={t("inventory.countedQty")} value={counted} onChange={setCounted} />
      ) : action === "adjust" ? (
        <Field label={t("inventory.adjustDelta")} value={qty} onChange={setQty} />
      ) : (
        <Field label={t("inventory.quantity")} value={qty} onChange={setQty} />
      )}
      {action === "receive" && (
        <Field label={t("inventory.unitCost")} value={unitCost} onChange={setUnitCost} />
      )}
      {action === "transfer" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-2">{t("inventory.destination")}</label>
          <select className={inputClass} value={toBranch} onChange={(e) => setToBranch(e.target.value)}>
            <option value="">—</option>
            {otherBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <Field label={t("inventory.reference")} value={reference} onChange={setReference} inputMode="text" />
      {err && <p className="text-xs font-medium text-danger">{err}</p>}
      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={busy}>{t("actions.save")}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
