import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <div className="micro">{eyebrow}</div>}
        <h2 className="text-2xl font-bold tracking-tight text-ink">{title}</h2>
        {children && <div className="text-sm text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
