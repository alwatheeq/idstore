import { useTranslation } from "react-i18next";
import { isUpdateDue } from "./due";
import type { SoftwareFields } from "./due";

/** Renders an amber "Update due" pill, or nothing when the vehicle is current. */
export function SoftwareDueBadge({ vehicle }: { vehicle: SoftwareFields }) {
  const { t } = useTranslation();
  if (!isUpdateDue(vehicle)) return null;
  return (
    <span className="badge bg-warn-soft text-warn">
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {t("software.due")}
    </span>
  );
}
