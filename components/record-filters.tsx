import Link from "next/link";

/** GET forms work without JavaScript and keep the query shareable. */
export function RecordFilters({ action, query, facet, label, options, placeholder }: {
  action: string; query?: string; facet?: string; label: string; options: { value: string; label: string }[]; placeholder: string;
}) {
  query = typeof query === "string" ? query : "";
  facet = typeof facet === "string" ? facet : "";
  return <form action={action} method="get" className="record-filters">
    <div className="form-field"><label htmlFor="record-search">Search</label><input id="record-search" type="search" name="q" defaultValue={query ?? ""} placeholder={placeholder} maxLength={120}/></div>
    <div className="form-field"><label htmlFor="record-facet">{label}</label><select id="record-facet" name="filter" defaultValue={facet ?? ""}><option value="">All</option>{options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></div>
    <div className="record-filter-actions">
      <button className="button primary" type="submit">Search</button>
      <Link className="button" href={action}>Reset filters</Link>
    </div>
  </form>;
}
