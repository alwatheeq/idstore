import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/invoices/hooks", () => ({ useInvoices: vi.fn() }));
import { useInvoices } from "@/features/invoices/hooks";
import { InvoicesPage } from "@/pages/InvoicesPage";

const wrap = (ui: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}><MemoryRouter>{ui}</MemoryRouter></I18nextProvider>);

describe("InvoicesPage", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("renders an invoice row with number, customer, total, status", () => {
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ id: "i1", invoice_number: 1, total: 180, payment_status: "paid",
        service_orders: { order_number: 7, customers: { name: "Ahmad" } } }],
      isLoading: false,
    });
    wrap(<InvoicesPage />);
    expect(screen.getByText(/#1/)).toBeInTheDocument();
    expect(screen.getByText("Ahmad")).toBeInTheDocument();
    expect(screen.getByText(/180\.000/)).toBeInTheDocument();
    // "Paid" appears both as the badge and as a filter <option>; assert at least one badge SPAN
    expect(screen.getAllByText("Paid").some((el) => el.tagName === "SPAN")).toBe(true);
  });

  it("shows the empty state", () => {
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    wrap(<InvoicesPage />);
    expect(screen.getByText("No invoices yet")).toBeInTheDocument();
  });

  it("shows the loading state", () => {
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    wrap(<InvoicesPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
