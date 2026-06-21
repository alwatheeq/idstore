import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/orders/hooks", () => ({
  useOrder: vi.fn(),
  useAdvanceStatus: vi.fn(),
  useApproveOrder: vi.fn(),
  useLines: vi.fn(() => ({ data: [] })),
  useCreateLine: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateLine: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteLine: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useOrder, useAdvanceStatus, useApproveOrder } from "@/features/orders/hooks";
import { useAuth } from "@/auth/useAuth";
import { OrderDetailPage } from "@/pages/OrderDetailPage";

const mockMutation = { mutate: vi.fn(), isPending: false };

const mockOrder = {
  id: "o1",
  order_number: 1001,
  status: "intake" as const,
  odometer_at_intake: 25000,
  charge_percent: 80,
  hv_battery_state: "good",
  reported_concerns: "Noise on braking",
  intake_notes: null,
  approved_at: null,
  approved_by: null,
  closed_at: null,
  branch_id: "b1",
  vehicle_id: "v1",
  customer_id: "c1",
  next_service_due_date: null,
  next_service_due_odometer: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  customers: { name: "Ahmad Al-Mansouri", phone: "0791234567", email: null },
  vehicles: { model: "ID.4", plate_number: "12-3456", vin: null },
};

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/orders/o1"]}>
        <Routes>
          <Route path="/orders/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

describe("OrderDetailPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");

    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockOrder,
      isLoading: false,
    });
    (useAdvanceStatus as ReturnType<typeof vi.fn>).mockReturnValue(mockMutation);
    (useApproveOrder as ReturnType<typeof vi.fn>).mockReturnValue(mockMutation);
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      session: { user: { email: "a@b.c" } },
    });
  });

  it("renders order number, customer name, and an intake field value", () => {
    wrap(<OrderDetailPage />);
    expect(screen.getByRole("heading", { name: /1001/ })).toBeInTheDocument();
    expect(screen.getByText(/Ahmad Al-Mansouri/)).toBeInTheDocument();
    expect(screen.getByText("25000")).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    wrap(<OrderDetailPage />);
    expect(screen.getByText("Intake")).toBeInTheDocument();
  });

  it("shows Advance status button when status is intake", () => {
    wrap(<OrderDetailPage />);
    expect(
      screen.getByRole("button", { name: "Advance status" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark approved" }),
    ).not.toBeInTheDocument();
  });

  it("shows Mark approved button when status is awaiting_approval", () => {
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { ...mockOrder, status: "awaiting_approval" },
      isLoading: false,
    });
    wrap(<OrderDetailPage />);
    expect(
      screen.getByRole("button", { name: "Mark approved" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Advance status" }),
    ).not.toBeInTheDocument();
  });

  it("shows no action button when status is closed", () => {
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { ...mockOrder, status: "closed" },
      isLoading: false,
    });
    wrap(<OrderDetailPage />);
    expect(
      screen.queryByRole("button", { name: "Advance status" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark approved" }),
    ).not.toBeInTheDocument();
  });

  it("shows not-found message when order is undefined", () => {
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    wrap(<OrderDetailPage />);
    expect(screen.getByText("Service order not found")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    wrap(<OrderDetailPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
