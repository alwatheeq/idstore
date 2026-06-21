import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import type { DueVehicle } from "@/features/software/types";

vi.mock("@/features/software/hooks", () => ({ useDueVehicles: vi.fn() }));

import { useDueVehicles } from "@/features/software/hooks";
import { SoftwarePage } from "@/pages/SoftwarePage";

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );

const mockDue = useDueVehicles as unknown as ReturnType<typeof vi.fn>;

const dueVehicle = (over: Partial<DueVehicle> = {}): DueVehicle =>
  ({
    id: "v1",
    branch_id: "b1",
    customer_id: "c1",
    vin: null,
    plate_number: "12-3456",
    model: "ID.4",
    model_year: 2023,
    color: null,
    current_odometer: null,
    hv_battery_state: null,
    software_version: "3.2",
    target_software_version: "4.0",
    notes: null,
    created_at: "",
    updated_at: "",
    customers: { name: "Ahmad" },
    ...over,
  }) as DueVehicle;

describe("SoftwarePage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows the empty state when nothing is due", () => {
    mockDue.mockReturnValue({ data: [], isLoading: false });
    wrap(<SoftwarePage />);
    expect(screen.getByText("All vehicles are up to date")).toBeInTheDocument();
  });

  it("lists due vehicles linking to the vehicle page", () => {
    mockDue.mockReturnValue({ data: [dueVehicle()], isLoading: false });
    wrap(<SoftwarePage />);
    expect(screen.getByText("Ahmad")).toBeInTheDocument();
    expect(screen.getByText("12-3456")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/vehicles/v1");
  });
});
