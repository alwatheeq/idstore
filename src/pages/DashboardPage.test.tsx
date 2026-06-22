import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import type { OrderListRow } from "@/features/orders/types";
import type { InvoiceListRow } from "@/features/invoices/types";

vi.mock("@/features/orders/hooks", () => ({ useOrders: vi.fn() }));
vi.mock("@/features/invoices/hooks", () => ({ useInvoices: vi.fn() }));
vi.mock("@/features/software/hooks", () => ({ useDueVehicles: vi.fn() }));

import { useOrders } from "@/features/orders/hooks";
import { useInvoices } from "@/features/invoices/hooks";
import { useDueVehicles } from "@/features/software/hooks";
import { DashboardPage } from "@/pages/DashboardPage";

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );

const makeOrder = (over: Partial<OrderListRow>): OrderListRow => ({
  id: "o1",
  branch_id: "b",
  vehicle_id: "v",
  customer_id: "c",
  order_number: 1,
  status: "intake",
  odometer_at_intake: null,
  charge_percent: null,
  hv_battery_state: null,
  reported_concerns: null,
  intake_notes: null,
  approved_at: null,
  approved_by: null,
  closed_at: null,
  next_service_due_date: null,
  next_service_due_odometer: null,
  created_at: "",
  updated_at: "",
  concerns: [],
  customers: null,
  vehicles: null,
  ...over,
});

const makeInvoice = (over: Partial<InvoiceListRow>): InvoiceListRow => ({
  id: "i1",
  service_order_id: "o1",
  invoice_number: 1,
  currency: "JOD",
  subtotal: 0,
  discount_total: 0,
  total: 0,
  payment_status: "unpaid",
  issued_at: "",
  service_orders: null,
  ...over,
});

describe("DashboardPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    (useDueVehicles as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });
  });

  it("shows KPI counts and a board column for active orders", () => {
    const orders: OrderListRow[] = [
      makeOrder({ id: "o1", order_number: 101, status: "intake", customers: { name: "Ahmad" }, vehicles: { model: "ID.4", plate_number: "12-3456" } }),
      makeOrder({ id: "o2", order_number: 102, status: "intake", customers: { name: "Khalid" }, vehicles: { model: "ID.4", plate_number: "78-9012" } }),
      makeOrder({ id: "o3", order_number: 103, status: "awaiting_approval", customers: { name: "Sara" }, vehicles: { model: "ID.3", plate_number: "AB-1234" } }),
      makeOrder({ id: "o4", order_number: 104, status: "closed", customers: { name: "Yusuf" }, vehicles: null }),
    ];
    const invoices: InvoiceListRow[] = [
      makeInvoice({ id: "i1", total: 180, issued_at: new Date().toISOString() }),
    ];

    (useOrders as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: orders, isLoading: false });
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: invoices });

    wrap(<DashboardPage />);

    // "Cars in workshop" KPI: intake x2, awaiting_approval x1 = 3 (closed excluded)
    const workshopKpi = screen.getByText("Cars in workshop");
    expect(workshopKpi).toBeInTheDocument();
    // The value "3" should be in the document
    expect(screen.getByText("3")).toBeInTheDocument();

    // "Awaiting approval" KPI shows 1 — may appear in KPI and board heading
    const awaitingMatches = screen.getAllByText(/Awaiting approval/i);
    expect(awaitingMatches.length).toBeGreaterThanOrEqual(1);

    // Board column heading "Intake" is rendered
    const intakeHeadings = screen.getAllByText(/Intake/i);
    expect(intakeHeadings.length).toBeGreaterThanOrEqual(1);

    // An order card link for order #101 is rendered
    expect(screen.getByText(/#101/)).toBeInTheDocument();

    // The "invoicedToday" KPI label is rendered
    expect(screen.getByText("Invoiced today")).toBeInTheDocument();
  });

  it("shows empty state when there are no active orders", () => {
    (useOrders as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });

    wrap(<DashboardPage />);

    expect(screen.getByText("No active orders")).toBeInTheDocument();
  });

  it("shows loading state while orders are loading", () => {
    (useOrders as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });

    wrap(<DashboardPage />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("order cards link to /orders/:id", () => {
    const orders: OrderListRow[] = [
      makeOrder({ id: "order-abc", order_number: 55, status: "intake", customers: { name: "Layla" }, vehicles: null }),
    ];

    (useOrders as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: orders, isLoading: false });
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });

    wrap(<DashboardPage />);

    const link = screen.getByRole("link", { name: /#55/ });
    expect(link).toHaveAttribute("href", "/orders/order-abc");
  });
});
