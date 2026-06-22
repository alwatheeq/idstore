import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { IntakeForm } from "@/features/orders/IntakeForm";
import * as hooks from "@/features/customers/hooks";

vi.mock("@/features/customers/hooks", () => ({
  useCustomers: vi.fn(() => ({
    data: [
      { id: "c1", name: "Ahmad" },
      { id: "c2", name: "Sara" },
    ],
  })),
  useVehicles: vi.fn(() => ({ data: [] })),
}));

vi.mock("@/features/orders/hooks", () => ({
  useLastOdometer: vi.fn(() => ({ data: null })),
}));

const wrap = (ui: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("IntakeForm", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("blocks submit and shows 'Customer is required' when form is empty", async () => {
    const onSubmit = vi.fn();
    wrap(<IntakeForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Customer is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("vehicle select is present and disabled until a customer is selected", () => {
    wrap(<IntakeForm onSubmit={vi.fn()} onCancel={() => {}} />);
    const vehicleSelect = screen.getByLabelText("Vehicle");
    expect(vehicleSelect).toBeDisabled();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const onCancel = vi.fn();
    wrap(<IntakeForm onSubmit={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("resets vehicle selection when the customer changes", async () => {
    // Simulate Customer 1 having vehicle v1, Customer 2 having no vehicles.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.useVehicles).mockImplementation((id) =>
      (id === "c1"
        ? { data: [{ id: "v1", model: "Golf", plate_number: "123" }] }
        : { data: [] }) as any
    );

    wrap(<IntakeForm onSubmit={vi.fn()} onCancel={() => {}} />);

    // Pick Customer 1 then its vehicle.
    await userEvent.selectOptions(screen.getByLabelText("Customer"), "c1");
    await userEvent.selectOptions(screen.getByLabelText("Vehicle"), "v1");
    expect(screen.getByLabelText("Vehicle")).toHaveValue("v1");

    // Switch to Customer 2 — vehicle should be cleared.
    await userEvent.selectOptions(screen.getByLabelText("Customer"), "c2");
    expect(screen.getByLabelText("Vehicle")).toHaveValue("");
  });
});
