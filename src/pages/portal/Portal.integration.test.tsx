import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import App from "@/App";

// ── Supabase (no real network) ──────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({}),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

// ── Admin page hooks (not needed for portal pages, but DashboardPage is
//    imported by App so the mock must exist) ─────────────────────────────────
vi.mock("@/features/orders/hooks", () => ({
  useOrders: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock("@/features/invoices/hooks", () => ({
  useInvoices: vi.fn(() => ({ data: [] })),
}));

// ── Auth / role ─────────────────────────────────────────────────────────────
vi.mock("@/auth/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/auth/useRole", () => ({ useRole: vi.fn() }));

// ── Portal data ─────────────────────────────────────────────────────────────
vi.mock("@/pages/portal/portalData", () => ({
  useMyVehicles: vi.fn(),
  useMyVehicle: vi.fn(() => ({ data: null, isLoading: false })),
  useVehicleOrders: vi.fn(() => ({ data: [], isLoading: false })),
}));

import { useAuth } from "@/auth/useAuth";
import { useRole } from "@/auth/useRole";
import { useMyVehicles } from "@/pages/portal/portalData";

const VEHICLE = {
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
  notes: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function renderApp(initialEntries: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Portal integration", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");

    // Customer session + role for all portal tests
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: "c1" } } as never,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useRole).mockReturnValue({ loading: false, role: "customer", customerId: "c1" });
    vi.mocked(useMyVehicles).mockReturnValue({
      data: [VEHICLE],
      isLoading: false,
    } as unknown as ReturnType<typeof useMyVehicles>);
  });

  it("customer at /portal sees the portal home with their vehicle", async () => {
    renderApp(["/portal"]);

    // Portal home heading (i18n key portal.myVehicles = "My vehicles")
    expect(await screen.findByRole("heading", { name: /my vehicles/i })).toBeInTheDocument();
    // Vehicle card
    expect(screen.getByText("ID.4")).toBeInTheDocument();
    expect(screen.getByText("12-3456")).toBeInTheDocument();
  });

  it("customer at / is redirected to /portal and sees portal home, not the admin dashboard", async () => {
    renderApp(["/"]);

    // Portal home must appear (redirected from / → /portal via RequireRole)
    expect(await screen.findByRole("heading", { name: /my vehicles/i })).toBeInTheDocument();
    // Admin dashboard heading must NOT be present
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });
});
