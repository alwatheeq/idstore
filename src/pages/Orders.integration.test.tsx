import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ session: { user: { email: "a@b.c" } } }) }));
vi.mock("@/features/orders/api", () => ({
  listOrders: vi.fn(async () => [{
    id: "o1", order_number: 7, status: "intake", branch_id: "b", vehicle_id: "v", customer_id: "c",
    odometer_at_intake: null, charge_percent: null, hv_battery_state: null, reported_concerns: null,
    intake_notes: null, approved_at: null, approved_by: null, closed_at: null,
    next_service_due_date: null, next_service_due_odometer: null, created_at: "", updated_at: "",
    customers: { name: "Ahmad" }, vehicles: { plate_number: "12-3456", model: "ID.4" },
  }]),
  getOrder: vi.fn(async () => ({
    id: "o1", order_number: 7, status: "intake", branch_id: "b", vehicle_id: "v", customer_id: "c",
    odometer_at_intake: 15000, charge_percent: 80, hv_battery_state: null, reported_concerns: null,
    intake_notes: null, approved_at: null, approved_by: null, closed_at: null,
    next_service_due_date: null, next_service_due_odometer: null, created_at: "", updated_at: "",
    customers: { name: "Ahmad", phone: null, email: null },
    vehicles: { model: "ID.4", plate_number: "12-3456", vin: null },
  })),
  listLines: vi.fn(async () => []),
  listMedia: vi.fn(async () => []),
  signedMediaUrl: vi.fn(async () => "https://example/x.jpg"),
}));

import { ServiceOrdersPage } from "@/pages/ServiceOrdersPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/orders"]}>
            <Routes>
              <Route path="/orders" element={<ServiceOrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

describe("Service orders flow", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("lists orders and navigates to detail", async () => {
    renderApp();
    const row = await screen.findByText(/#7/);
    await userEvent.click(row);
    expect(await screen.findByRole("heading", { name: /#7/ })).toBeInTheDocument();
    expect(screen.getByText("Intake & inspection")).toBeInTheDocument();
  });
});
