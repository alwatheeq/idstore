import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { SoftwareUpdateForm } from "./SoftwareUpdateForm";

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("SoftwareUpdateForm", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("blocks submit when the target version is empty", async () => {
    const onSubmit = vi.fn();
    wrap(<SoftwareUpdateForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Version is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the new version and defaults to also setting the current version", async () => {
    const onSubmit = vi.fn();
    wrap(<SoftwareUpdateForm currentVersion="3.2" onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("To version"), "4.0");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ to_version: "4.0", from_version: "3.2" }),
        true,
      ),
    );
  });

  it("passes setCurrent=false when the checkbox is unchecked", async () => {
    const onSubmit = vi.fn();
    wrap(<SoftwareUpdateForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("To version"), "4.0");
    await userEvent.click(
      screen.getByLabelText("Also set this as the vehicle's current version"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ to_version: "4.0" }), false),
    );
  });
});
