import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/orders/hooks", () => ({ useOrders: vi.fn() }));
import { useOrders } from "@/features/orders/hooks";
import { ServiceOrdersPage } from "@/pages/ServiceOrdersPage";

const wrap = (ui: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}><MemoryRouter>{ui}</MemoryRouter></I18nextProvider>);

describe("ServiceOrdersPage", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("renders an order row with number, customer and status", () => {
    (useOrders as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ id: "o1", order_number: 1, status: "intake",
        customers: { name: "Ahmad" }, vehicles: { plate_number: "12-3456", model: "ID.4" } }],
      isLoading: false,
    });
    wrap(<ServiceOrdersPage />);
    expect(screen.getByText(/#1/)).toBeInTheDocument();
    expect(screen.getByText("Ahmad")).toBeInTheDocument();
    // "Intake" appears in the dropdown option AND the badge — check that the badge span is present
    const badges = screen.getAllByText("Intake");
    expect(badges.some((el) => el.tagName === "SPAN")).toBe(true);
  });

  it("shows the empty state", () => {
    (useOrders as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    wrap(<ServiceOrdersPage />);
    expect(screen.getByText("No service orders yet")).toBeInTheDocument();
  });

  it("shows the loading state", () => {
    (useOrders as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    wrap(<ServiceOrdersPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
