import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode, type TableHTMLAttributes } from "react";

type TableNode = ReactElement<{ children?: ReactNode; colSpan?: number; scope?: string; role?: string }>;

function elements(children: ReactNode): TableNode[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<TableNode["props"]>(child)) return [];
    return child.type === Fragment ? elements(child.props.children) : [child];
  });
}

function labelText(children: ReactNode): string {
  return Children.toArray(children).map(child => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    return isValidElement<TableNode["props"]>(child) ? labelText(child.props.children) : "";
  }).join("");
}

/** Keep real table semantics, with visible column labels when rows become cards.
 * Render labels from the same headers so localization and column changes stay in sync. */
export function ResponsiveTable({ children, className = "data-table", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  const sections = elements(children);
  const header = sections.find(section => section.type === "thead");
  const headers = elements(elements(header?.props.children)[0]?.props.children);
  const labels = headers.flatMap(cell => Array.from({ length: cell.props.colSpan ?? 1 }, () => labelText(cell.props.children)));

  return <table {...props} role="table" className={`${className} responsive-table`}>
    {sections.map(section => {
      if (!["thead", "tbody", "tfoot"].includes(String(section.type))) return section;
      const heading = section.type === "thead";
      return cloneElement(section, { role: "rowgroup", children: elements(section.props.children).map(row => {
        let column = 0;
        return cloneElement(row, { role: "row", children: elements(row.props.children).map(cell => {
          const span = cell.props.colSpan ?? 1;
          const label = labels.slice(column, column + span).filter(Boolean).join(" / ");
          column += span;
          if (heading) return cloneElement(cell, { role: "columnheader", scope: cell.props.scope ?? "col" });
          return cloneElement(cell, { role: cell.type === "th" ? "rowheader" : "cell", children: <>
            {span === 1 && label ? <span className="table-cell-label" aria-hidden="true">{label}</span> : null}
            {cell.props.children}
          </> });
        }) });
      }) });
    })}
  </table>;
}
