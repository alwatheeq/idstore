import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/customers/hooks", () => ({
  useCustomer: vi.fn(),
  useDeleteCustomer: vi.fn(),
  useVehicles: vi.fn(),
  useCreateVehicle: vi.fn(),
  useUpdateVehicle: vi.fn(),
  useDeleteVehicle: vi.fn(),
}));

import {
  useCustomer,
  useDeleteCustomer,
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from "@/features/customers/hooks";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";

const mockMutation = { mutate: vi.fn(), isPending: false };

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/customers/c1"]}>
        <Routes>
          <Route path="/customers/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

describe("CustomerDetailPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");

    (useCustomer as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        id: "c1",
        name: "Ahmad",
        phone: "079",
        email: null,
        notes: null,
      },
      isLoading: false,
    });
    (useDeleteCustomer as ReturnType<typeof vi.fn>).mockReturnValue(mockMutation);
    (useVehicles as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          id: "v1",
          model: "ID.4",
          model_year: 2022,
          plate_number: "12-3456",
          vin: null,
          current_odometer: 15000,
        },
      ],
    });
    (useCreateVehicle as ReturnType<typeof vi.fn>).mockReturnValue(mockMutation);
    (useUpdateVehicle as ReturnType<typeof vi.fn>).mockReturnValue(mockMutation);
    (useDeleteVehicle as ReturnType<typeof vi.fn>).mockReturnValue(mockMutation);
  });

  it("renders the customer name heading", () => {
    wrap(<CustomerDetailPage />);
    expect(screen.getByRole("heading", { name: "Ahmad" })).toBeInTheDocument();
  });

  it("renders the Vehicles section title", () => {
    wrap(<CustomerDetailPage />);
    expect(screen.getByRole("heading", { name: "Vehicles" })).toBeInTheDocument();
  });

  it("renders vehicle data", () => {
    wrap(<CustomerDetailPage />);
    expect(screen.getByText(/ID\.4/)).toBeInTheDocument();
  });

  it("shows empty vehicles message when no vehicles", () => {
    (useVehicles as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });
    wrap(<CustomerDetailPage />);
    expect(
      screen.getByText("No vehicles for this customer yet"),
    ).toBeInTheDocument();
  });
});
