/**
 * Tests for frontend/src/App.tsx
 *
 * BrowserRouter is replaced with MemoryRouter (via mock) so initial URLs are
 * controllable. AuthProvider and page components are stubbed to isolate routing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";

const routerState = { entries: ["/dashboard"] as string[] };

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={routerState.entries} initialIndex={0}>
        {children}
      </actual.MemoryRouter>
    ),
  };
});

vi.mock("../src/auth-context", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../src/components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../src/layouts/DashboardLayout", async () => {
  const { Outlet } = await import("react-router-dom");
  return {
    DashboardLayout: () => <Outlet />,
  };
});

vi.mock("../src/pages/DashboardPage", () => ({
  DashboardPage: () => <div data-testid="page-dashboard">Dashboard</div>,
}));

vi.mock("../src/pages/Login", () => ({
  Login: () => <div data-testid="page-login">Login</div>,
}));

vi.mock("../src/pages/Register", () => ({
  Register: () => <div data-testid="page-register">Register</div>,
}));

vi.mock("../src/pages/NewTournament", () => ({
  NewTournament: () => <div data-testid="page-new">NewTournament</div>,
}));

vi.mock("../src/pages/TournamentDetail", () => ({
  TournamentDetailPage: () => <div data-testid="page-t-detail">TournamentDetail</div>,
}));

vi.mock("../src/pages/TournamentHubPage", () => ({
  TournamentHubPage: () => <div data-testid="page-hub">TournamentHub</div>,
}));

vi.mock("../src/pages/TournamentBracketPage", () => ({
  TournamentBracketPage: () => <div data-testid="page-bracket">Bracket</div>,
}));

vi.mock("../src/pages/PlayerProfilePage", () => ({
  PlayerProfilePage: () => <div data-testid="page-profile">Profile</div>,
}));

vi.mock("../src/pages/PlayersPage", () => ({
  PlayersPage: () => <div data-testid="page-players">Players</div>,
}));

vi.mock("../src/pages/SettingsPage", () => ({
  SettingsPage: () => <div data-testid="page-settings">Settings</div>,
}));

function renderApp(path: string) {
  routerState.entries = [path];
  return render(<App />);
}

beforeEach(() => {
  routerState.entries = ["/dashboard"];
});

describe("App routing", () => {
  it("redirects / to /dashboard and shows the dashboard page", async () => {
    renderApp("/");
    await waitFor(() => expect(screen.getByTestId("page-dashboard")).toBeInTheDocument());
  });

  it("renders /dashboard", () => {
    renderApp("/dashboard");
    expect(screen.getByTestId("page-dashboard")).toBeInTheDocument();
  });

  it("renders /login inside Layout", () => {
    renderApp("/login");
    expect(screen.getByTestId("page-login")).toBeInTheDocument();
  });

  it("renders /register inside Layout", () => {
    renderApp("/register");
    expect(screen.getByTestId("page-register")).toBeInTheDocument();
  });

  it("renders /t/:id for tournament detail inside Layout", () => {
    renderApp("/t/my-event");
    expect(screen.getByTestId("page-t-detail")).toBeInTheDocument();
  });

  it("renders /t/:id/bracket under DashboardLayout", () => {
    renderApp("/t/my-event/bracket");
    expect(screen.getByTestId("page-bracket")).toBeInTheDocument();
  });

  it("renders /tournament", () => {
    renderApp("/tournament");
    expect(screen.getByTestId("page-hub")).toBeInTheDocument();
  });

  it("redirects /tournaments to /tournament", async () => {
    renderApp("/tournaments");
    await waitFor(() => expect(screen.getByTestId("page-hub")).toBeInTheDocument());
  });

  it("renders /players", () => {
    renderApp("/players");
    expect(screen.getByTestId("page-players")).toBeInTheDocument();
  });

  it("renders /players/:id as profile", () => {
    renderApp("/players/u1");
    expect(screen.getByTestId("page-profile")).toBeInTheDocument();
  });

  it("renders /settings", () => {
    renderApp("/settings");
    expect(screen.getByTestId("page-settings")).toBeInTheDocument();
  });

  it("renders /new", () => {
    renderApp("/new");
    expect(screen.getByTestId("page-new")).toBeInTheDocument();
  });

  it("redirects unknown paths to /dashboard", async () => {
    renderApp("/does-not-exist");
    await waitFor(() => expect(screen.getByTestId("page-dashboard")).toBeInTheDocument());
  });
});
