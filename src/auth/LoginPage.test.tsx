import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { LoginPage } from "./LoginPage";

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
});
