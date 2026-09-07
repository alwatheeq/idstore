import { Search } from "lucide-react";
import { LabeledControl } from "@/components/labeled-control";

export function SearchFilters({ placeholder = "Search records…", filters = [] }: { placeholder?: string; filters?: string[] }) {
  return (
    <div className="filter-row">
      <LabeledControl label="Search"><div className="search-field"><Search /><input aria-label={placeholder} placeholder={placeholder} /></div></LabeledControl>
      {filters.map((filter) => <LabeledControl label={filter} key={filter}><select className="filter-select" aria-label={filter}><option>{filter}</option></select></LabeledControl>)}
    </div>
  );
}
