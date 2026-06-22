import { useTranslation } from "react-i18next";
import { useActiveBranch, ALL_BRANCHES } from "./ActiveBranchContext";

/** Top-bar branch selector. Hidden when the admin has nothing to switch between. */
export function BranchSwitcher() {
  const { t } = useTranslation();
  const { accessible, activeBranchId, setActiveBranchId, isSuper } = useActiveBranch();
  if (!isSuper && accessible.length <= 1) return null;

  return (
    <select
      aria-label={t("branch.switch")}
      value={activeBranchId}
      onChange={(e) => setActiveBranchId(e.target.value)}
      className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 outline-none transition-colors hover:text-ink focus:border-volt-deep"
    >
      {isSuper && <option value={ALL_BRANCHES}>{t("branch.all")}</option>}
      {accessible.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
