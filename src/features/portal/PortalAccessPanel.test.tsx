import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { PortalAccessPanel } from "./PortalAccessPanel";
import { useProvisionPortalLogin } from "@/features/portal/hooks";
import type { Customer } from "@/features/customers/types";

vi.mock("@/features/portal/hooks", () => ({
  useProvisionPortalLogin: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

const wrap = (ui: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const base = {
  branch_id: "b1",
  name: "Ahmad",
  email: null,
  notes: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
} satisfies Partial<Customer>;

describe("PortalAccessPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows linked status when customer already has auth_user_id", () => {
    const customer: Customer = {
      ...base,
      id: "c",
      auth_user_id: "u",
      phone: "079",
    };
    wrap(<PortalAccessPanel customer={customer} />);
    expect(screen.getByText("Portal login active")).toBeInTheDocument();
  });

  it("shows needPhone message when customer has no phone", () => {
    const customer: Customer = {
      ...base,
      id: "c",
      auth_user_id: null,
      phone: null,
    };
    wrap(<PortalAccessPanel customer={customer} />);
    expect(
      screen.getByText("Add a phone number to this customer first"),
    ).toBeInTheDocument();
  });

  it("shows Create portal login button when customer has phone but no auth_user_id", () => {
    const customer: Customer = {
      ...base,
      id: "c",
      auth_user_id: null,
      phone: "079",
    };
    wrap(<PortalAccessPanel customer={customer} />);
    expect(
      screen.getByRole("button", { name: "Create portal login" }),
    ).toBeInTheDocument();
  });

  it("reveals PIN after successful provisioning", async () => {
    vi.mocked(useProvisionPortalLogin).mockReturnValue({
      mutate: (_args: unknown, opts: { onSuccess?: () => void } = {}) =>
        opts.onSuccess?.(),
      isPending: false,
    } as ReturnType<typeof useProvisionPortalLogin>);

    const customer: Customer = {
      ...base,
      id: "c",
      auth_user_id: null,
      phone: "079",
    };
    wrap(<PortalAccessPanel customer={customer} />);

    await userEvent.click(screen.getByRole("button", { name: "Create portal login" }));

    expect(
      screen.getByText("Share this PIN with the customer:"),
    ).toBeInTheDocument();
  });
});
