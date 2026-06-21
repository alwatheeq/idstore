import { useTranslation } from "react-i18next";
import type { SoftwareUpdate } from "./types";

/** Read-only applied-update history. Pass `onDelete` (admin) to enable removal. */
export function SoftwareHistory({
  updates,
  onDelete,
}: {
  updates: SoftwareUpdate[];
  onDelete?: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (updates.length === 0) {
    return (
      <div className="card grid place-items-center p-10 text-sm text-muted">
        {t("software.noHistory")}
      </div>
    );
  }
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {updates.map((u) => (
        <li key={u.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
          <div className="space-y-1">
            <p className="text-sm font-medium text-ink">
              <span className="num">{u.from_version ?? "—"}</span>
              <span className="rtl-flip mx-1.5 inline-block text-muted">→</span>
              <span className="num">{u.to_version}</span>
            </p>
            <p className="num text-xs text-muted">{u.applied_at}</p>
            {u.notes && <p className="text-sm text-ink-2">{u.notes}</p>}
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(u.id)}
              className="flex-shrink-0 text-xs font-semibold text-danger transition-colors hover:underline"
            >
              {t("actions.delete")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
