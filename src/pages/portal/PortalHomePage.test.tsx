import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/index";
import type { Vehicle } from "@/features/customers/types";

vi.mock("@/pages/portal/portalData", () => ({
  useMyVehicles: vi.fn(),
}));

import { useMyVehicles } from "@/pages/portal/portalData";
import { PortalHomePage } from "@/pages/portal/PortalHomePage";

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </I18nextProvider>,
  );

describe("PortalHomePage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders vehicle cards with links when vehicles exist", () => {
    const vehicles: Vehicle[] = [
      {
        id: "v1",
        branch_id: "b1",
        customer_id: "c1",
        model: "ID.4",
        plate_number: "12-3456",
        vin: null,
        model_year: 2023,
        color: "white",
        current_odometer: 10000,
        hv_battery_state: null,
        software_version: null,
        target_software_version: null,
        notes: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "v2",
        branch_id: "b1",
        customer_id: "c1",
        model: "ID.6",
        plate_number: "99-0001",
        vin: null,
        model_year: 2024,
        color: "black",
        current_odometer: null,
        hv_battery_state: null,
        software_version: null,
        target_software_version: null,
        notes: null,
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      },
    ];
    vi.mocked(useMyVehicles).mockReturnValue({
      data: vehicles,
      isLoading: false,
    } as unknown as ReturnType<typeof useMyVehicles>);

    wrap(<PortalHomePage />);

    expect(screen.getByText("ID.4")).toBeInTheDocument();
    expect(screen.getByText("ID.6")).toBeInTheDocument();

    const link1 = screen.getByRole("link", { name: /ID\.4/ });
    expect(link1).toHaveAttribute("href", "/portal/vehicles/v1");

    const link2 = screen.getByRole("link", { name: /ID\.6/ });
    expect(link2).toHaveAttribute("href", "/portal/vehicles/v2");
  });

  it("shows no-vehicles message when list is empty", () => {
    vi.mocked(useMyVehicles).mockReturnValue({
      data: [] as Vehicle[],
      isLoading: false,
    } as unknown as ReturnType<typeof useMyVehicles>);

    wrap(<PortalHomePage />);

    expect(screen.getByText("No vehicles on file")).toBeInTheDocument();
  });
});
