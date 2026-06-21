import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import type { Vehicle } from "@/features/customers/types";

vi.mock("@/features/customers/hooks", () => ({ useVehicle: vi.fn() }));
vi.mock("@/features/orders/hooks", () => ({ useOrdersByVehicle: vi.fn() }));
vi.mock("@/features/software/hooks", () => ({
  useVehicleUpdates: vi.fn(),
  useCreateSoftwareUpdate: vi.fn(),
  useDeleteSoftwareUpdate: vi.fn(),
}));

import { useVehicle } from "@/features/customers/hooks";
import { useOrdersByVehicle } from "@/features/orders/hooks";
import {
  useVehicleUpdates,
  useCreateSoftwareUpdate,
  useDeleteSoftwareUpdate,
} from "@/features/software/hooks";
import { VehicleDetailPage } from "@/pages/VehicleDetailPage";

const fn = (h: unknown) => h as unknown as ReturnType<typeof vi.fn>;

const vehicle: Vehicle = {
  id: "v1",
  branch_id: "b1",
  customer_id: "c1",
  vin: "WVW123",
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
};

const wrap = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/vehicles/v1"]}>
        <Routes>
          <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

describe("VehicleDetailPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    fn(useVehicle).mockReturnValue({ data: vehicle, isLoading: false });
    fn(useOrdersByVehicle).mockReturnValue({ data: [] });
    fn(useVehicleUpdates).mockReturnValue({ data: [] });
    fn(useCreateSoftwareUpdate).mockReturnValue({ mutate: vi.fn(), isPending: false });
    fn(useDeleteSoftwareUpdate).mockReturnValue({ mutate: vi.fn() });
  });

  it("shows current and target versions and a due badge", () => {
    wrap();
    expect(screen.getByText("3.2")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("Update due")).toBeInTheDocument();
  });

  it("reveals the log-update form when 'Log update' is clicked", async () => {
    wrap();
    expect(screen.queryByLabelText("To version")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Log update" }));
    expect(screen.getByLabelText("To version")).toBeInTheDocument();
  });
});
