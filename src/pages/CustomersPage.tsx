import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCustomers } from "@/features/customers/hooks";
import { buttonClasses } from "@/components/ui/Button";

export function CustomersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = useCustomers(search);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{t("customers.title")}</h2>
        <Link to="/customers/new" className={buttonClasses()}>{t("customers.addCustomer")}</Link>
      </div>

      <input
        className="w-full max-w-sm border rounded-lg px-3 py-2"
        placeholder={t("customers.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={t("actions.search")}
      />

      {isLoading ? (
        <p className="opacity-70">{t("common.loading")}</p>
      ) : !customers || customers.length === 0 ? (
        <p className="opacity-70">{t("customers.empty")}</p>
      ) : (
        <ul className="divide-y border rounded-lg">
          {customers.map((c) => (
            <li key={c.id}>
              <Link to={`/customers/${c.id}`} className="flex justify-between px-4 py-3 hover:bg-gray-50">
                <span className="font-medium">{c.name}</span>
                <span className="opacity-60 text-sm">{c.phone ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
