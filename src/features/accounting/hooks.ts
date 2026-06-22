import { useQuery } from "@tanstack/react-query";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import * as api from "./api";
import {
  sumPayments,
  bucketByMonth,
  groupByMethod,
  computeReceivables,
  sumReceivedPurchases,
} from "./summary";
import type { AccountingSummary, DateRange } from "./types";

export function useAccountingSummary(range: DateRange) {
  const { branchId } = useActiveBranch();
  return useQuery<AccountingSummary>({
    queryKey: ["accounting", branchId, range.from, range.to],
    queryFn: async () => {
      const [payments, openInvoices, purchases] = await Promise.all([
        api.fetchPayments(branchId, range.from, range.to),
        api.fetchOpenInvoices(branchId),
        api.fetchReceivedPurchases(branchId, range.from, range.to),
      ]);
      return {
        revenue: { total: sumPayments(payments), months: bucketByMonth(payments) },
        receivables: computeReceivables(openInvoices),
        methods: groupByMethod(payments),
        purchases: sumReceivedPurchases(purchases),
      };
    },
  });
}
