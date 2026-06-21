import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { CustomerForm } from "@/features/customers/CustomerForm";

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
});
