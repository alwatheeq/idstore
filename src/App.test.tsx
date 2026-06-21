import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import App from "@/App";

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

import { useAuth } from "@/auth/useAuth";

function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </MemoryRouter>
  );
}

describe("App routing", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("Test A: authenticated user at '/' sees dashboard heading and sidebar nav", async () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: {} } as never,
      loading: false,
      signOut: vi.fn(),
    });

    renderApp(["/"]);

    // Dashboard page heading
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    // Sidebar nav item
    expect(screen.getByText(/Service Orders/)).toBeInTheDocument();
  });

  it("Test B: unauthenticated user at '/' is redirected to login", async () => {
    vi.mocked(useAuth).mockReturnValue({ session: null, loading: false, signOut: vi.fn() });

    renderApp(["/"]);

    // Login page renders
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
  });
});
