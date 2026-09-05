"use client";

import { useUiLocale } from "@/components/ui-locale";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  const { pageText } = useUiLocale();
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{pageText(eyebrow)}</div>
        <h1>{pageText(title)}</h1>
        <p>{pageText(description)}</p>
      </div>
      {children ? <div className="header-actions">{children}</div> : null}
    </header>
  );
}
