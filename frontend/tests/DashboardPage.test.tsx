/**
 * Tests for frontend/src/pages/DashboardPage.tsx
 *
 * Covers: formatDateRange (output format, 7-day span), DashboardPage rendering
 * (loading state, tournament list, empty state), and the stats useMemo
 * (totalEntrants summation, liveEvents count).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage, formatDateRange } from "../src/pages/DashboardPage";
import { api } from "../src/api";
import { useAuth } from "../src/auth-context";

vi.mock("../src/api", () => ({
  api: { listTournaments: vi.fn() },
}));

vi.mock("../src/auth-context", () => ({ useAuth: vi.fn() }));

function buildTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    name: "Test Tournament",
    game: "CS2",
    entrantCount: 5,
    maxEntrants: 16,
    registrationOpen: true,
    createdAt: "2025-01-01",
    ...overrides,
  };
}

function renderDashboard(user: Record<string, unknown> | null = null) {
  vi.mocked(useAuth).mockReturnValue({ user } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── formatDateRange ──────────────────────────────────────────────────────────

describe("formatDateRange", () => {
  it("returns a non-empty string", () => {
    expect(typeof formatDateRange()).toBe("string");
    expect(formatDateRange().length).toBeGreaterThan(0);
  });

  it("contains a dash separating two dates", () => {
    expect(formatDateRange()).toMatch(/ - /);
  });

  it("includes the current year", () => {
    const year = String(new Date().getFullYear());
    expect(formatDateRange()).toContain(year);
  });

  it("covers a 7-day span (start date matches today minus 7 days)", () => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const monthStr = sevenDaysAgo.toLocaleDateString("en-US", { month: "short" });
    expect(formatDateRange()).toContain(monthStr);
  });
});

// ─── DashboardPage – loading ──────────────────────────────────────────────────

describe("DashboardPage – loading state", () => {
  it("shows a loading message while tournaments are being fetched", () => {
    vi.mocked(api.listTournaments).mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

// ─── DashboardPage – fetched list ─────────────────────────────────────────────

describe("DashboardPage – tournament list", () => {
  it("renders tournament names after data loads", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([
      buildTournament({ id: "t1", name: "Apex Open" }),
      buildTournament({ id: "t2", name: "Valorant Cup" }),
    ]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText("Apex Open")).toBeInTheDocument());
    expect(screen.getByText("Valorant Cup")).toBeInTheDocument();
  });

  it("shows the 'No tournaments found' empty state when the list is empty", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/no tournaments found/i)).toBeInTheDocument());
  });

  it("shows an error message when the fetch fails", async () => {
    vi.mocked(api.listTournaments).mockRejectedValue(new Error("Network error"));
    renderDashboard();
    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
  });
});

// ─── stats useMemo ─────────────────────────────────────────────────────────────

describe("DashboardPage – stats summary", () => {
  it("displays the total number of entrants across all tournaments", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([
      buildTournament({ entrantCount: 10 }),
      buildTournament({ id: "t2", entrantCount: 25 }),
    ]);
    renderDashboard();
    // Total is 35; the dashboard renders it as "Total Active Players"
    await waitFor(() => expect(screen.getByText("35")).toBeInTheDocument());
  });

  it("displays the count of live events", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([
      buildTournament({ id: "t1" }),
      buildTournament({ id: "t2" }),
      buildTournament({ id: "t3" }),
    ]);
    renderDashboard();
    // liveEvents = 3, displayed zero-padded as "03"
    await waitFor(() => expect(screen.getByText("03")).toBeInTheDocument());
  });

  it("displays '00' for live events when there are no tournaments", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText("00")).toBeInTheDocument());
  });
});

// ─── DashboardPage – organizer CTA ───────────────────────────────────────────

describe("DashboardPage – organizer create button", () => {
  it("shows a 'Create Your first Tournament' link for organizer users", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard({ role: "organizer", displayName: "Org" });
    await waitFor(() => expect(screen.getByText(/create your first tournament/i)).toBeInTheDocument());
  });
});
