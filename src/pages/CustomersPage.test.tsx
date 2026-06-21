import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/customers/hooks", () => ({ useCustomers: vi.fn() }));
import { useCustomers } from "@/features/customers/hooks";
import { CustomersPage } from "@/pages/CustomersPage";

const wrap = (ui: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}><MemoryRouter>{ui}</MemoryRouter></I18nextProvider>);

describe("CustomersPage", () => {
  beforeEach(async () => { await i18n.changeLanguage("en"); });

  it("renders customer rows", () => {
    (useCustomers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ id: "1", name: "Ahmad", phone: "0790000000" }], isLoading: false,
    });
    wrap(<CustomersPage />);
    expect(screen.getByText("Ahmad")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    (useCustomers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    wrap(<CustomersPage />);
    expect(screen.getByText("No customers yet")).toBeInTheDocument();
  });
});
