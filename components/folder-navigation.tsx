"use client";

import Link from "next/link";
import { currentNavigationHref, type NavigationGroup } from "@/lib/navigation";

export function FolderNavigation({ groups, pathname, translate, onNavigate }: {
  groups: NavigationGroup[]; pathname: string; translate: (label: string) => string; onNavigate: () => void;
}) {
  const current = currentNavigationHref(pathname, groups.flatMap(group => group.items));
  const active = groups.find(group => group.items.some(item => item.href === current));
  const pages = (group: NavigationGroup) => group.items.length > 1 ? <div className="folder-pages" aria-label={translate(group.label)}>
    {group.items.map(item => <Link href={item.href} key={item.href} aria-current={current === item.href ? "page" : undefined} onClick={onNavigate}>
      {translate(item.label)}{item.badge ? <span className="folder-badge">{item.badge}</span> : null}
    </Link>)}
  </div> : null;
  return <nav className="folder-navigation" aria-label={translate("Service operations")}>
    <div className="folder-rail">
      {groups.filter(group => group.items.length).map(group => {
        const badge = group.items.reduce((total, item) => total + (item.badge ?? 0), 0);
        return <div className="folder-group" key={group.key}>
          <Link className="folder-tab" href={group.items[0].href} aria-current={active?.key === group.key ? "page" : undefined} onClick={onNavigate}>
            {translate(group.label)}{badge > 0 ? <span className="folder-badge">{badge}</span> : null}
          </Link>
          {active?.key === group.key ? <div className="folder-mobile-pages">{pages(group)}</div> : null}
        </div>;
      })}
    </div>
    {active ? <div className="folder-desktop-pages">{pages(active)}</div> : null}
  </nav>;
}
