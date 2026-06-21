import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { PortalLoginPage } from "./PortalLoginPage";

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
        <PortalLoginPage />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe("PortalLoginPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders phone and PIN fields and the sign-in button", () => {
    renderLoginPage();
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("PIN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows invalid-login error when signInWithPassword fails", async () => {
    const { supabase } = await import("@/lib/supabase");
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      error: { message: "x" } as never,
      data: { user: null, session: null },
    });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Phone number"), "0791234567");
    await userEvent.type(screen.getByLabelText("PIN"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid phone number or PIN"),
    ).toBeInTheDocument();
  });
});
