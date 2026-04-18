/**
 * Tests for frontend/src/pages/DashboardPage.tsx
 *
 * Covers: formatDateRange, listTournaments on mount, loading / error / empty /
 * list UI, stats (totals, live count, matchId), preview cap (4 rows), singular
 * entrant copy, organizer vs player empty state, links (View All, Open, create).
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

  it("calls api.listTournaments once on mount", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => expect(vi.mocked(api.listTournaments)).toHaveBeenCalledTimes(1));
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

  it("renders the dashboard heading and date pill", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => expect(screen.getByRole("heading", { name: /^dashboard$/i })).toBeInTheDocument());
    expect(screen.getByText(/executive overview/i)).toBeInTheDocument();
    expect(screen.getByText(formatDateRange())).toBeInTheDocument();
  });

  it("includes a View All link to /tournament", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute("href", "/tournament"));
  });

  it("only previews the first four tournaments when more exist", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([
      buildTournament({ id: "a", name: "T1" }),
      buildTournament({ id: "b", name: "T2" }),
      buildTournament({ id: "c", name: "T3" }),
      buildTournament({ id: "d", name: "T4" }),
      buildTournament({ id: "e", name: "T5 Hidden" }),
    ]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText("T1")).toBeInTheDocument());
    expect(screen.getByText("T4")).toBeInTheDocument();
    expect(screen.queryByText("T5 Hidden")).not.toBeInTheDocument();
  });

  it("links each row to /t/:id with an Open link", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([buildTournament({ id: "tid-xyz", name: "One Event" })]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText("One Event")).toBeInTheDocument());
    const mainLink = screen.getByRole("link", { name: /one event/i });
    expect(mainLink).toHaveAttribute("href", "/t/tid-xyz");
    const openLinks = screen.getAllByRole("link", { name: /^open$/i });
    expect(openLinks.some((el) => el.getAttribute("href") === "/t/tid-xyz")).toBe(true);
  });

  it("uses singular entrant when a tournament has one entrant", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([buildTournament({ name: "Solo", entrantCount: 1 })]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/1 entrant\b/i)).toBeInTheDocument());
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

  it("shows MATCH ID from the first tournament id prefix on the revenue card", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([buildTournament({ id: "abcdefgh-extra", name: "X" })]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/MATCH ID: abcdefgh/i)).toBeInTheDocument());
  });
});

// ─── DashboardPage – organizer CTA ───────────────────────────────────────────

describe("DashboardPage – organizer create button", () => {
  it("shows a 'Create Your first Tournament' link for organizer users", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard({ role: "organizer", displayName: "Org" });
    await waitFor(() => expect(screen.getByText(/create your first tournament/i)).toBeInTheDocument());
  });

  it("links create CTA to /tournament?create=1", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard({ role: "organizer", displayName: "Org" });
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /create your first tournament/i })).toHaveAttribute(
        "href",
        "/tournament?create=1"
      )
    );
  });
});

describe("DashboardPage – player empty state", () => {
  it("does not show create tournament for players when the list is empty", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderDashboard({ role: "player", displayName: "Pat" });
    await waitFor(() => expect(screen.queryByText(/create your first tournament/i)).not.toBeInTheDocument());
    expect(screen.getByText(/ask an organizer to publish/i)).toBeInTheDocument();
  });
});
