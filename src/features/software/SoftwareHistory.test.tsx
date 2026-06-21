import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { SoftwareHistory } from "./SoftwareHistory";
import type { SoftwareUpdate } from "./types";

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const update = (over: Partial<SoftwareUpdate> = {}): SoftwareUpdate => ({
  id: "u1",
  branch_id: "b1",
  vehicle_id: "v1",
  service_order_id: null,
  from_version: "3.2",
  to_version: "4.0",
  applied_at: "2026-06-22",
  notes: null,
  created_at: "2026-06-22T00:00:00Z",
  ...over,
});

describe("SoftwareHistory", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows the empty state with no updates", () => {
    wrap(<SoftwareHistory updates={[]} />);
    expect(screen.getByText("No software updates recorded yet")).toBeInTheDocument();
  });

  it("renders versions and date for each update", () => {
    wrap(<SoftwareHistory updates={[update({ notes: "OTA campaign" })]} />);
    expect(screen.getByText("3.2")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("2026-06-22")).toBeInTheDocument();
    expect(screen.getByText("OTA campaign")).toBeInTheDocument();
  });

  it("shows a delete control only when onDelete is provided", async () => {
    const onDelete = vi.fn();
    const { rerender } = wrap(<SoftwareHistory updates={[update()]} />);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    rerender(
      <I18nextProvider i18n={i18n}>
        <SoftwareHistory updates={[update()]} onDelete={onDelete} />
      </I18nextProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("u1");
  });
});
