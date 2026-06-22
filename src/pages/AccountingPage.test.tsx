import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import type { AccountingSummary } from "@/features/accounting/types";

vi.mock("@/features/accounting/hooks", () => ({ useAccountingSummary: vi.fn() }));
vi.mock("@/features/branches/ActiveBranchContext", () => ({
  useActiveBranch: vi.fn(),
  ALL_BRANCHES: "all",
}));

import { useAccountingSummary } from "@/features/accounting/hooks";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import { AccountingPage } from "@/pages/AccountingPage";

const mockSummary = useAccountingSummary as unknown as ReturnType<typeof vi.fn>;
const mockBranch = useActiveBranch as unknown as ReturnType<typeof vi.fn>;

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );

const summary = (over: Partial<AccountingSummary> = {}): AccountingSummary => ({
  revenue: { total: 1234.5, months: [{ month: "2026-06", total: 1234.5 }] },
  receivables: {
    total: 60,
    invoices: [
      { id: "i1", invoice_number: 7, total: 100, paid: 40, balance: 60, issued_at: "2026-06-01T00:00:00.000Z", customer_name: "Ahmad" },
    ],
  },
  methods: [{ method: "cash", count: 2, total: 900 }],
  purchases: {
    total: 25,
    orders: [{ id: "p1", po_number: 3, supplier_name: "ACME", received_at: "2026-06-05T00:00:00.000Z", value: 25 }],
  },
  ...over,
});

describe("AccountingPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockBranch.mockReturnValue({ branchId: "b1", isAll: false });
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, isError: false });
  });

  it("renders the four report cards with figures", () => {
    wrap(<AccountingPage />);
    expect(screen.getByText("Revenue (cash in)")).toBeInTheDocument();
    expect(screen.getByText("1234.500 JOD")).toBeInTheDocument();
    expect(screen.getAllByText("Outstanding receivables").length).toBeGreaterThan(0); // appears as card label + section heading
    expect(screen.getByText("Payments by method")).toBeInTheDocument();
    expect(screen.getByText("Purchases (cash out)")).toBeInTheDocument();
  });

  it("links each open invoice to its detail page", () => {
    wrap(<AccountingPage />);
    expect(screen.getByText("Ahmad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ahmad/ })).toHaveAttribute("href", "/invoices/i1");
  });

  it("shows the consolidated caption under All branches", () => {
    mockBranch.mockReturnValue({ branchId: null, isAll: true });
    wrap(<AccountingPage />);
    expect(screen.getByText("Consolidated — all branches")).toBeInTheDocument();
  });

  it("refetches when the period preset changes", () => {
    wrap(<AccountingPage />);
    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    // Latest call's range should be the full-year span (Jan→Jan), not a single month.
    const lastRange = mockSummary.mock.calls.at(-1)![0];
    expect(lastRange.from.slice(5, 7)).toBe("01");
    expect(lastRange.to.slice(5, 7)).toBe("01");
  });

  it("shows the error state when the query fails", () => {
    mockSummary.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    wrap(<AccountingPage />);
    expect(screen.getByText(/Could not load accounting data/)).toBeInTheDocument();
  });
});
