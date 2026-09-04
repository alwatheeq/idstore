import { Search } from "lucide-react";

export function SearchFilters({ placeholder = "Search records…", filters = [] }: { placeholder?: string; filters?: string[] }) {
  return (
    <div className="filter-row">
      <div className="search-field"><Search /><input aria-label={placeholder} placeholder={placeholder} /></div>
      {filters.map((filter) => <select className="filter-select" aria-label={filter} key={filter}><option>{filter}</option></select>)}
    </div>
  );
}
