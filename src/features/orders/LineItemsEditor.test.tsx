import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { LineItemsEditor } from "@/features/orders/LineItemsEditor";

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ show: vi.fn() }) }));

vi.mock("@/features/orders/hooks", () => ({
  useLines: vi.fn(() => ({
    data: [
      {
        id: "l1",
        service_order_id: "o",
        line_type: "service",
        description: "Brake change",
        quantity: 1,
        unit_price: 100,
        discount_type: "amount",
        discount_value: 10,
        line_total: 90,
        created_at: "",
      },
      {
        id: "l2",
        service_order_id: "o",
        line_type: "part",
        description: "Pads",
        quantity: 2,
        unit_price: 50,
        discount_type: "percent",
        discount_value: 10,
        line_total: 90,
        created_at: "",
      },
    ],
  })),
  useCreateLine: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateLine: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteLine: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

const wrap = (ui: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("LineItemsEditor", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders both line descriptions", () => {
    wrap(<LineItemsEditor orderId="o" />);
    expect(screen.getByText(/Brake change/)).toBeInTheDocument();
    expect(screen.getByText(/Pads/)).toBeInTheDocument();
  });

  it("renders the grand total as 180.000 JOD", () => {
    wrap(<LineItemsEditor orderId="o" />);
    expect(screen.getByText(/180\.000 JOD/)).toBeInTheDocument();
  });

  it("renders the subtotal as 200.000", () => {
    wrap(<LineItemsEditor orderId="o" />);
    // subtotal dd is 200.000
    expect(screen.getByText("200.000")).toBeInTheDocument();
  });

  it("renders the discount total as 20.000", () => {
    wrap(<LineItemsEditor orderId="o" />);
    // discountTotal dd is 20.000
    expect(screen.getByText("20.000")).toBeInTheDocument();
  });
});
