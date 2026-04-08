/**
 * Tests for frontend/src/layouts/DashboardLayout.tsx
 *
 * Covers: NavItem (renders link + active class), TournamentsNavLink (active
 * on tournament routes), DashboardLayout auth guard (redirects unauthenticated
 * users), loading state, closeSidebar (closes on Escape key + nav change),
 * and computed initials.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, Outlet } from "react-router-dom";
import { DashboardLayout } from "../src/layouts/DashboardLayout";
import { useAuth } from "../src/auth-context";

vi.mock("../src/auth-context", () => ({ useAuth: vi.fn() }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function buildAuthState(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "u1", email: "a@b.com", displayName: "Alice Bob", role: "player" as const },
    ready: true,
    logout: vi.fn(),
    ...overrides,
  };
}

function renderLayout(path = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<DashboardLayout><Outlet /></DashboardLayout>}>
          <Route path="/dashboard" element={<div>dashboard-content</div>} />
          <Route path="/tournament" element={<div>tournament-content</div>} />
          <Route path="/t/:id/bracket" element={<div>bracket-content</div>} />
          <Route path="/players" element={<div>players-content</div>} />
          <Route path="/settings" element={<div>settings-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(buildAuthState() as ReturnType<typeof useAuth>);
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe("DashboardLayout – loading state", () => {
  it("renders a loading indicator while auth is not ready", () => {
    vi.mocked(useAuth).mockReturnValue(buildAuthState({ ready: false }) as ReturnType<typeof useAuth>);
    renderLayout();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe("DashboardLayout – auth guard", () => {
  it("redirects to /login when the user is not authenticated and route is not public bracket", () => {
    vi.mocked(useAuth).mockReturnValue(buildAuthState({ user: null }) as ReturnType<typeof useAuth>);
    renderLayout("/dashboard");
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/login"),
      expect.objectContaining({ replace: true })
    );
  });

  it("allows access to bracket pages without authentication (public route)", () => {
    vi.mocked(useAuth).mockReturnValue(buildAuthState({ user: null }) as ReturnType<typeof useAuth>);
    renderLayout("/t/some-id/bracket");
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ─── NavItem ──────────────────────────────────────────────────────────────────

describe("DashboardLayout – NavItem", () => {
  it("renders a nav link for Dashboard", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders a nav link for Players", () => {
    renderLayout();
    expect(screen.getAllByRole("link", { name: /players/i })[0]).toBeInTheDocument();
  });

  it("renders a nav link for Settings", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("applies the 'active' class to the Dashboard link when on /dashboard", () => {
    renderLayout("/dashboard");
    const link = screen.getByRole("link", { name: /^dashboard$/i });
    expect(link.className).toContain("active");
  });
});

// ─── TournamentsNavLink ───────────────────────────────────────────────────────

describe("DashboardLayout – TournamentsNavLink", () => {
  it("renders a Tournaments navigation link", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: /tournaments/i })).toBeInTheDocument();
  });

  it("applies the 'active' class when the current route is /tournament", () => {
    renderLayout("/tournament");
    const link = screen.getByRole("link", { name: /tournaments/i });
    expect(link.className).toContain("active");
  });

  it("applies the 'active' class when on a bracket sub-route", () => {
    renderLayout("/t/abc/bracket");
    const link = screen.getByRole("link", { name: /tournaments/i });
    expect(link.className).toContain("active");
  });

  it("does NOT apply the 'active' class on the /dashboard route", () => {
    renderLayout("/dashboard");
    const link = screen.getByRole("link", { name: /tournaments/i });
    expect(link.className).not.toContain("active");
  });
});

// ─── initials computation ─────────────────────────────────────────────────────

describe("DashboardLayout – initials", () => {
  it("shows the first two initials of the user's display name", () => {
    vi.mocked(useAuth).mockReturnValue(
      buildAuthState({ user: { id: "u1", email: "a@b.com", displayName: "Alice Bob", role: "player" } }) as ReturnType<typeof useAuth>
    );
    renderLayout();
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("shows a single initial for single-word display names", () => {
    vi.mocked(useAuth).mockReturnValue(
      buildAuthState({ user: { id: "u1", email: "a@b.com", displayName: "Alice", role: "player" } }) as ReturnType<typeof useAuth>
    );
    renderLayout();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});

// ─── closeSidebar on Escape key ───────────────────────────────────────────────

describe("DashboardLayout – closeSidebar", () => {
  it("opens the sidebar when the hamburger menu button is clicked", async () => {
    renderLayout();
    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(menuBtn);
    await waitFor(() => {
      const sidebar = document.querySelector(".dashboard-sidebar");
      expect(sidebar?.className).toContain("open");
    });
  });

  it("closes the sidebar when the Escape key is pressed", async () => {
    renderLayout();
    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(menuBtn);
    await waitFor(() => document.querySelector(".dashboard-sidebar--open"));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    await waitFor(() => {
      const sidebar = document.querySelector(".dashboard-sidebar");
      expect(sidebar?.className).not.toContain("--open");
    });
  });
});
