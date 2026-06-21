import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { LoginPage } from "./LoginPage";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <LoginPage />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(async () => {
    // Ensure deterministic English labels regardless of test order
    await i18n.changeLanguage("en");
  });

  it("renders the email label and input", () => {
    renderLoginPage();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders the password label and input", () => {
    renderLoginPage();
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders the login button with the correct label", () => {
    renderLoginPage();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  it("shows translated error message on failed sign-in", async () => {
    const { supabase } = await import("@/lib/supabase");
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      error: { message: "Invalid login credentials" } as never,
      data: { user: null, session: null },
    });

    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(
        screen.getByText("Login failed. Please check your email and password."),
      ).toBeInTheDocument();
    });
  });
});
