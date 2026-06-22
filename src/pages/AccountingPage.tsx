import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/features/dashboard/KpiCard";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import { useAccountingSummary } from "@/features/accounting/hooks";
import { presetRange } from "@/features/accounting/period";
import type { DateRange, PresetKey } from "@/features/accounting/types";

const PRESETS: Exclude<PresetKey, "custom">[] = ["this-month", "last-month", "this-year"];
const presetLabelKey: Record<Exclude<PresetKey, "custom">, string> = {
  "this-month": "accounting.period.thisMonth",
  "last-month": "accounting.period.lastMonth",
  "this-year": "accounting.period.thisYear",
};

const money = (n: number) => `${n.toFixed(3)} JOD`;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
/** Convert a yyyy-mm-dd input value to a local-midnight ISO string. */
const inputToIso = (v: string, endExclusive = false): string => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d + (endExclusive ? 1 : 0)).toISOString();
};

export function AccountingPage() {
  const { t } = useTranslation();
  const { isAll } = useActiveBranch();
  const [preset, setPreset] = useState<PresetKey>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range: DateRange = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) {
      return { from: inputToIso(customFrom), to: inputToIso(customTo, true) };
    }
    const key = preset === "custom" ? "this-month" : preset;
    return presetRange(key, new Date());
  }, [preset, customFrom, customTo]);

  const { data, isLoading, isError } = useAccountingSummary(range);

  const segBtn = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"
    }`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("accounting.title")}
        eyebrow={t("accounting.eyebrow")}
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1">
            {PRESETS.map((p) => (
              <button key={p} type="button" className={segBtn(preset === p)} onClick={() => setPreset(p)}>
                {t(presetLabelKey[p])}
              </button>
            ))}
            <button
              type="button"
              className={segBtn(preset === "custom")}
              onClick={() => setPreset("custom")}
            >
              {t("accounting.period.custom")}
            </button>
          </div>
        }
      >
        {isAll && <span className="micro">{t("accounting.consolidated")}</span>}
      </PageHeader>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5 text-sm">
            <span className="micro block">{t("accounting.period.from")}</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="micro block">{t("accounting.period.to")}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
        </div>
      )}

      {isError ? (
        <div className="card grid place-items-center p-12 text-sm text-danger">
          {t("accounting.loadError")}
        </div>
      ) : isLoading || !data ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="micro">{t("accounting.revenue")}</div>
              <div className="num mt-3 text-3xl font-semibold tracking-tight text-volt-deep">
                {money(data.revenue.total)}
              </div>
              {data.revenue.months.length > 0 && (
                <div className="mt-5 flex items-end gap-1.5" aria-hidden>
                  {(() => {
                    const max = Math.max(...data.revenue.months.map((m) => m.total), 1);
                    return data.revenue.months.map((m) => (
                      <div key={m.month} className="flex-1" title={`${m.month}: ${money(m.total)}`}>
                        <div
                          className="rounded-t bg-volt"
                          style={{ height: `${Math.max(4, (m.total / max) * 56)}px` }}
                        />
                        <div className="num mt-1 text-center text-[10px] text-muted">
                          {m.month.slice(5)}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            <KpiCard label={t("accounting.receivables")} value={money(data.receivables.total)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <div className="micro mb-4">{t("accounting.byMethod")}</div>
              {data.methods.length === 0 ? (
                <p className="text-sm text-muted">{t("accounting.noPayments")}</p>
              ) : (
                <div className="space-y-3">
                  {data.methods.map((m) => (
                    <div key={m.method} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{t(`accounting.method.${m.method}`)}</span>
                      <span className="flex items-center gap-3">
                        <span className="num text-muted">×{m.count}</span>
                        <span className="num font-semibold text-ink">{money(m.total)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-5">
              <div className="micro mb-1">{t("accounting.purchases")}</div>
              <div className="num text-2xl font-semibold text-ink">{money(data.purchases.total)}</div>
              {data.purchases.orders.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{t("accounting.noPurchases")}</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {data.purchases.orders.map((o) => (
                    <Link
                      key={o.id}
                      to={`/purchase-orders/${o.id}`}
                      className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 text-sm transition-colors hover:border-line-strong hover:bg-paper-2"
                    >
                      <span className="text-ink">
                        <span className="num text-muted">{t("accounting.poNo")} #{o.po_number}</span>{" "}
                        {o.supplier_name ?? ""}
                      </span>
                      <span className="num font-semibold text-ink">{money(o.value)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight text-ink">
              {t("accounting.receivables")}
            </h3>
            {data.receivables.invoices.length === 0 ? (
              <div className="card grid place-items-center p-10 text-sm text-muted">
                {t("accounting.noReceivables")}
              </div>
            ) : (
              <div className="space-y-2">
                {data.receivables.invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3 text-sm transition-colors hover:border-line-strong hover:bg-paper-2"
                  >
                    <span>
                      <span className="num text-muted">{t("accounting.invoiceNo")} #{inv.invoice_number}</span>{" "}
                      <span className="font-medium text-ink">{inv.customer_name}</span>
                      <span className="num ms-2 text-xs text-muted">{day(inv.issued_at)}</span>
                    </span>
                    <span className="text-end">
                      <span className="num block font-semibold text-warn">{money(inv.balance)}</span>
                      <span className="num block text-xs text-muted">
                        {money(inv.paid)} / {money(inv.total)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
