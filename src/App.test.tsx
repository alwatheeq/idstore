import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import App from "@/App";

// Mock hooks used by DashboardPage so it doesn't need a real QueryClient
vi.mock("@/features/orders/hooks", () => ({ useOrders: vi.fn(() => ({ data: [], isLoading: false })) }));
vi.mock("@/features/invoices/hooks", () => ({ useInvoices: vi.fn(() => ({ data: [] })) }));

// Mock supabase so AppLayout's signOut button and AuthProvider don't call real network
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({}),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

// Mock useAuth so we can control session state without AuthProvider/Supabase
vi.mock("@/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

// Mock useRole so RequireRole can be controlled in tests
vi.mock("@/auth/useRole", () => ({
  useRole: vi.fn(),
}));

import { useAuth } from "@/auth/useAuth";
import { useRole } from "@/auth/useRole";

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

describe("App routing", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("Test A: authenticated admin at '/' sees dashboard heading and sidebar nav", async () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: "u" } } as never,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useRole).mockReturnValue({ loading: false, role: "admin", customerId: null });

    renderApp(["/"]);

    // Dashboard page heading
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    // Sidebar nav item
    expect(screen.getByText(/Service Orders/)).toBeInTheDocument();
  });

  it("Test B: unauthenticated user at '/' is redirected to admin login", async () => {
    vi.mocked(useAuth).mockReturnValue({ session: null, loading: false, signOut: vi.fn() });
    vi.mocked(useRole).mockReturnValue({ loading: false, role: undefined, customerId: null });

    renderApp(["/"]);

    // Login page renders
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  it("Test C: authenticated customer at '/' is NOT shown the admin dashboard", async () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: "c1" } } as never,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useRole).mockReturnValue({ loading: false, role: "customer", customerId: "c1" });

    renderApp(["/"]);

    // RequireRole(role="admin") redirects customers to /portal.
    // The admin Dashboard heading must NOT appear.
    const heading = screen.queryByRole("heading", { name: "Dashboard" });
    expect(heading).not.toBeInTheDocument();
  });
});
