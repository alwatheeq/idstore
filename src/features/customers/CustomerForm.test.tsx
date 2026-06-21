import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { CustomerForm } from "@/features/customers/CustomerForm";
import type { Customer } from "@/features/customers/types";

const wrap = (ui: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("CustomerForm", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("blocks submit and shows an error when name is empty", async () => {
    const onSubmit = vi.fn();
    wrap(<CustomerForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a normalized payload (empties → null)", async () => {
    const onSubmit = vi.fn();
    wrap(<CustomerForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Sara");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Sara", phone: null, email: null, notes: null }),
      ),
    );
  });

  it("pre-fills the form when defaultValues arrive asynchronously (edit mode)", async () => {
    const existing: Customer = {
      id: "c1",
      branch_id: "b1",
      name: "Khalid",
      phone: "+962790000001",
      email: "khalid@example.com",
      notes: "VIP",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    const { rerender } = wrap(<CustomerForm onSubmit={vi.fn()} onCancel={() => {}} />);

    // Simulate async data arrival — re-render with defaultValues now populated
    await act(async () => {
      rerender(
        <I18nextProvider i18n={i18n}>
          <CustomerForm defaultValues={existing} onSubmit={vi.fn()} onCancel={() => {}} />
        </I18nextProvider>,
      );
    });

    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Khalid");
    expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe("+962790000001");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("khalid@example.com");
    expect((screen.getByLabelText("Notes") as HTMLInputElement).value).toBe("VIP");
  });
});
