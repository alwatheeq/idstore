import type { LucideIcon } from "lucide-react";
import { LocalizedText } from "@/components/localized-text";

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon /></div>
      <div>
        <h3><LocalizedText>{title}</LocalizedText></h3>
        <p><LocalizedText>{description}</LocalizedText></p>
      </div>
      {action}
    </div>
  );
}
