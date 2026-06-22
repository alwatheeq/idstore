import { useTranslation } from "react-i18next";
import type { POStatus } from "./types";

const colors: Record<POStatus, string> = {
  draft: "bg-info-soft text-info",
  ordered: "bg-warn-soft text-warn",
  received: "bg-ok-soft text-ok",
  cancelled: "bg-paper-2 text-muted",
};

export function POStatusBadge({ status }: { status: POStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`badge ${colors[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {t(`po.status.${status}`)}
    </span>
  );
}
