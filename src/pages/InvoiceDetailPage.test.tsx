import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/invoices/hooks", () => ({
  useInvoice: vi.fn(),
  usePayments: vi.fn(),
  useAddPayment: vi.fn(),
  useDeletePayment: vi.fn(),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

import { useInvoice, usePayments, useAddPayment, useDeletePayment } from "@/features/invoices/hooks";
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage";

const mockInvoice = {
  id: "i1",
  invoice_number: 1,
  service_order_id: "o1",
  subtotal: 200,
  discount_total: 20,
  total: 180,
  payment_status: "partial" as const,
  currency: "JOD",
  issued_at: "",
  service_orders: { order_number: 7, customers: { name: "Ahmad" } },
};

const mockPayments = [
  { id: "p1", invoice_id: "i1", amount: 60, method: "cash" as const, note: null, paid_at: "" },
];

const mockMutation = { mutate: vi.fn(), isPending: false };

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/invoices/i1"]}>
        <Routes>
          <Route path="/invoices/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

describe("InvoiceDetailPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    (useInvoice as ReturnType<typeof vi.fn>).mockReturnValue({ data: mockInvoice, isLoading: false });
    (usePayments as ReturnType<typeof vi.fn>).mockReturnValue({ data: mockPayments });
    (useAddPayment as ReturnType<typeof vi.fn>).mockReturnValue(mockMutation);
    (useDeletePayment as ReturnType<typeof vi.fn>).mockReturnValue(mockMutation);
  });

  it("renders invoice number, total, payment row, and balance", () => {
    wrap(<InvoiceDetailPage />);
    expect(screen.getByText(/Invoice #1/)).toBeInTheDocument();
    // total row shows "180.000 JOD"
    expect(screen.getAllByText(/180\.000/).length).toBeGreaterThan(0);
    // paid summary and payment row both show 60.000 — assert at least one exists
    expect(screen.getAllByText(/60\.000/).length).toBeGreaterThanOrEqual(1);
    // balance = 180 - 60 = 120
    expect(screen.getAllByText(/120\.000/).length).toBeGreaterThan(0);
  });

  it("shows not-found message when invoice is undefined", () => {
    (useInvoice as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false });
    wrap(<InvoiceDetailPage />);
    expect(screen.getByText("Invoice not found")).toBeInTheDocument();
  });
});
