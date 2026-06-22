import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { BranchSwitcher } from "./BranchSwitcher";
import { ActiveBranchContext } from "./ActiveBranchContext";
import type { Branch } from "./types";

const branch = (id: string, name: string): Branch => ({
  id,
  name,
  code: null,
  phone: null,
  address: null,
  is_active: true,
  created_at: "",
});

const ctx = (over: Partial<React.ContextType<typeof ActiveBranchContext>>) => ({
  branches: [],
  accessible: [],
  activeBranchId: "",
  setActiveBranchId: vi.fn(),
  isSuper: false,
  isAll: false,
  branchId: null,
  ...over,
});

const wrap = (value: React.ContextType<typeof ActiveBranchContext>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <ActiveBranchContext.Provider value={value}>
        <BranchSwitcher />
      </ActiveBranchContext.Provider>
    </I18nextProvider>,
  );

describe("BranchSwitcher", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows all accessible branches plus 'All branches' for a super admin", () => {
    wrap(
      ctx({
        isSuper: true,
        accessible: [branch("b1", "Amman"), branch("b2", "Zarqa")],
        activeBranchId: "b1",
      }),
    );
    expect(screen.getByText("All branches")).toBeInTheDocument();
    expect(screen.getByText("Amman")).toBeInTheDocument();
    expect(screen.getByText("Zarqa")).toBeInTheDocument();
  });

  it("renders nothing for a regular admin with a single branch", () => {
    const { container } = wrap(ctx({ isSuper: false, accessible: [branch("b1", "Amman")] }));
    expect(container).toBeEmptyDOMElement();
  });
});
