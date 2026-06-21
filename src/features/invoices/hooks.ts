import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { PaymentPayload } from "./schema";
import type { Payment } from "./types";

export function useInvoices(status?: string) {
  return useQuery({ queryKey: ["invoices", status ?? "all"], queryFn: () => api.listInvoices(status) });
}
export function useInvoice(id: string | undefined) {
  return useQuery({ queryKey: ["invoice", id], queryFn: () => api.getInvoice(id!), enabled: !!id });
}
export function useInvoiceByOrder(orderId: string | undefined) {
  return useQuery({ queryKey: ["invoice-by-order", orderId], queryFn: () => api.getInvoiceByOrder(orderId!), enabled: !!orderId });
}
export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.generateInvoice(orderId),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-by-order", inv.service_order_id] });
    },
  });
}
export function usePayments(invoiceId: string | undefined) {
  return useQuery({ queryKey: ["payments", invoiceId], queryFn: () => api.listPayments(invoiceId!), enabled: !!invoiceId });
}
export function useAddPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PaymentPayload) => api.addPayment(invoiceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
export function useDeletePayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Payment) => api.deletePayment(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
