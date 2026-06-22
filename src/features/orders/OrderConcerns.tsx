import { useTranslation } from "react-i18next";
import { checkedCount, toggleConcern, type Concern } from "./concerns";
import { useUpdateConcerns } from "./hooks";

/** Order-detail checklist: staff tick each reported concern off as they validate it. */
export function OrderConcerns({ orderId, concerns }: { orderId: string; concerns: Concern[] }) {
  const { t } = useTranslation();
  const update = useUpdateConcerns(orderId);
  if (!concerns || concerns.length === 0) return null;
  const done = checkedCount(concerns);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight text-ink">
          {t("orders.reportedConcerns")}
        </h3>
        <span className="micro">
          {t("orders.concernsChecked", { done, total: concerns.length })}
        </span>
      </div>
      <ul className="card divide-y divide-line overflow-hidden">
        {concerns.map((c) => (
          <li key={c.key}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-paper-2">
              <input
                type="checkbox"
                checked={c.checked}
                onChange={() => update.mutate(toggleConcern(concerns, c.key))}
                className="h-4 w-4 rounded border-line-strong accent-ink"
              />
              <span className={c.checked ? "text-muted line-through" : "text-ink"}>
                {t(`concerns.${c.key}`)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
