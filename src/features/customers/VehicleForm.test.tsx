import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { VehicleForm } from "@/features/customers/VehicleForm";

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("VehicleForm model picker", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("lists known VW EV models in the picker", () => {
    wrap(<VehicleForm onSubmit={vi.fn()} onCancel={() => {}} />);
    const select = screen.getByLabelText("Model") as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(["ID.3", "ID.4", "ID. Buzz", "Other"]));
  });

  it("submits the chosen model's label", async () => {
    const onSubmit = vi.fn();
    wrap(<VehicleForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Model"), "id4");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ model: "ID.4" })),
    );
  });

  it("reveals a free-text box for 'Other' and submits the custom value", async () => {
    const onSubmit = vi.fn();
    wrap(<VehicleForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Model"), "__other__");
    const custom = screen.getByLabelText("Custom model");
    await userEvent.type(custom, "e-Golf");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ model: "e-Golf" })),
    );
  });
});
