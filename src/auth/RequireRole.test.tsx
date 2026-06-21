import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/auth/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/auth/useRole", () => ({ useRole: vi.fn() }));
import { useAuth } from "@/auth/useAuth";
import { useRole } from "@/auth/useRole";
import { RequireRole } from "@/auth/RequireRole";

const setup = (initial: string) =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route element={<RequireRole role="customer" loginPath="/portal/login" />}>
          <Route path="/portal" element={<div>PORTAL HOME</div>} />
        </Route>
        <Route path="/portal/login" element={<div>PORTAL LOGIN</div>} />
        <Route path="/" element={<div>ADMIN HOME</div>} />
      </Routes>
    </MemoryRouter>
  );

const mockAuth = (v: unknown) => (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v);
const mockRole = (v: unknown) => (useRole as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v);

describe("RequireRole", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("redirects to the login path when unauthenticated", () => {
    mockAuth({ session: null, loading: false });
    mockRole({ loading: false, role: undefined, customerId: null });
    setup("/portal");
    expect(screen.getByText("PORTAL LOGIN")).toBeInTheDocument();
  });
  it("renders the outlet for a matching role", () => {
    mockAuth({ session: { user: { id: "u" } }, loading: false });
    mockRole({ loading: false, role: "customer", customerId: "c1" });
    setup("/portal");
    expect(screen.getByText("PORTAL HOME")).toBeInTheDocument();
  });
  it("redirects a mismatched role to its own home (admin -> /)", () => {
    mockAuth({ session: { user: { id: "u" } }, loading: false });
    mockRole({ loading: false, role: "admin", customerId: null });
    setup("/portal");
    expect(screen.getByText("ADMIN HOME")).toBeInTheDocument();
  });
});
