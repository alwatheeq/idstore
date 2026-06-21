import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/customers/api", () => ({
  listCustomers: vi.fn(async () => [{ id: "c1", branch_id: "b", name: "Ahmad", phone: "079", email: null, notes: null, created_at: "", updated_at: "" }]),
  getCustomer: vi.fn(async () => ({ id: "c1", branch_id: "b", name: "Ahmad", phone: "079", email: null, notes: null, created_at: "", updated_at: "" })),
  listVehicles: vi.fn(async () => []),
}));

import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/customers"]}>
          <Routes>
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

describe("Customers flow", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("lists customers and navigates to detail", async () => {
    renderApp();
    const link = await screen.findByText("Ahmad");
    await userEvent.click(link);
    expect(await screen.findByRole("heading", { name: "Ahmad" })).toBeInTheDocument();
    expect(screen.getByText("Vehicles")).toBeInTheDocument();
  });
});
