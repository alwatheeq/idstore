import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCustomers } from "@/features/customers/hooks";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";

export function CustomersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = useCustomers(search);
  const { isAll } = useActiveBranch();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("customers.title")}
        eyebrow={t("nav.customers")}
        actions={
          isAll ? (
            <span className="text-xs font-medium text-muted">{t("branch.pickToCreate")}</span>
          ) : (
            <Link to="/customers/new" className={buttonClasses()}>
              {t("customers.addCustomer")}
            </Link>
          )
        }
      />

      <input
        className="w-full max-w-sm rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-volt-deep"
        placeholder={t("customers.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={t("actions.search")}
      />

      {isLoading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : !customers || customers.length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">
          {t("customers.empty")}
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                to={`/customers/${c.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-paper-2"
              >
                <span className="font-medium text-ink">{c.name}</span>
                <span className="num text-sm text-muted">{c.phone ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
