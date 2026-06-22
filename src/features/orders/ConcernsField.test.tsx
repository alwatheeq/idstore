import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { ConcernsField } from "./ConcernsField";

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("ConcernsField", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders preset concerns and adds one when clicked", async () => {
    const onChange = vi.fn();
    wrap(<ConcernsField value={[]} onChange={onChange} />);
    expect(screen.getByText("Won't charge")).toBeInTheDocument();
    expect(screen.getByText("Unusual noise")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Won't charge"));
    expect(onChange).toHaveBeenCalledWith(["wont_charge"]);
  });

  it("removes an already-selected concern when clicked", async () => {
    const onChange = vi.fn();
    wrap(<ConcernsField value={["wont_charge"]} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Won't charge"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
