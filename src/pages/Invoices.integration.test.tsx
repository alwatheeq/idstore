import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/features/invoices/api", () => ({
  listInvoices: vi.fn(async () => [{
    id: "i1", invoice_number: 3, service_order_id: "o1", currency: "JOD",
    subtotal: 200, discount_total: 20, total: 180, payment_status: "partial", issued_at: "",
    service_orders: { order_number: 7, customers: { name: "Ahmad" } },
  }]),
  getInvoice: vi.fn(async () => ({
    id: "i1", invoice_number: 3, service_order_id: "o1", currency: "JOD",
    subtotal: 200, discount_total: 20, total: 180, payment_status: "partial", issued_at: "",
    service_orders: { order_number: 7, customers: { name: "Ahmad" } },
  })),
  listPayments: vi.fn(async () => []),
}));

import { InvoicesPage } from "@/pages/InvoicesPage";
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage";

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/invoices"]}>
            <Routes>
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

describe("Invoices flow", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("lists invoices and navigates to detail", async () => {
    renderApp();
    const row = await screen.findByText(/#3/);
    await userEvent.click(row);
    expect(await screen.findByRole("heading", { name: /#3/ })).toBeInTheDocument();
    expect(screen.getAllByText(/180\.000/).length).toBeGreaterThan(0);
  });
});
