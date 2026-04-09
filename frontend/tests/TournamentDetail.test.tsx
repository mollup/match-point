/**
 * Tests for frontend/src/pages/TournamentDetail.tsx
 *
 * Covers: load (getTournament + getTournamentBracket), spots labels, entrants
 * list, hub link, guest login CTA, pre-fill, registration flow (submit, cancel,
 * errors), organizer bracket (success, navigate, error), flags (closed, full,
 * already registered).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TournamentDetailPage } from "../src/pages/TournamentDetail";
import { api } from "../src/api";
import { useAuth } from "../src/auth-context";

vi.mock("../src/api", () => ({
  api: {
    getTournament: vi.fn(),
    getTournamentBracket: vi.fn(),
    registerForTournament: vi.fn(),
    generateBracket: vi.fn(),
  },
}));

vi.mock("../src/auth-context", () => ({ useAuth: vi.fn() }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "tournament-abc" }),
  };
});

function buildDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "tournament-abc",
    name: "Test Open",
    game: "CS2",
    entrantCount: 2,
    maxEntrants: 16,
    registrationOpen: true,
    createdAt: "2025-01-01",
    entrants: [{ userId: "u99", displayName: "OtherPlayer", gameSelection: "CS2", registeredAt: "2025-01-01" }],
    ...overrides,
  };
}

function renderDetail(authUser: Record<string, unknown> | null = null) {
  vi.mocked(useAuth).mockReturnValue({ user: authUser, ready: true } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={["/t/tournament-abc"]}>
      <Routes>
        <Route path="/t/:id" element={<TournamentDetailPage />} />
        <Route path="/t/:id/bracket" element={<div>bracket-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getTournamentBracket).mockResolvedValue(null);
});

// ─── load – initial data fetch ────────────────────────────────────────────────

describe("TournamentDetailPage – load", () => {
  it("shows a loading message before data arrives", () => {
    vi.mocked(api.getTournament).mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders the tournament name after data loads", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    renderDetail();
    await waitFor(() => expect(screen.getByText("Test Open")).toBeInTheDocument());
  });

  it("displays the game name in the subline", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail({ game: "Valorant" }));
    renderDetail();
    await waitFor(() => expect(screen.getByText(/Valorant/)).toBeInTheDocument());
  });

  it("shows an error banner when the fetch fails", async () => {
    vi.mocked(api.getTournament).mockRejectedValue(new Error("Not found"));
    renderDetail();
    await waitFor(() => expect(screen.getByText("Not found")).toBeInTheDocument());
  });

  it("renders a 'View bracket' link when a bracket exists", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    vi.mocked(api.getTournamentBracket).mockResolvedValue({
      tournamentId: "tournament-abc",
      playerCount: 2,
      roundCount: 1,
      rounds: [],
    });
    renderDetail();
    await waitFor(() => expect(screen.getByText(/view bracket/i)).toBeInTheDocument());
  });

  it("calls getTournament and getTournamentBracket with the route id", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    renderDetail();
    await waitFor(() => expect(screen.getByText("Test Open")).toBeInTheDocument());
    expect(vi.mocked(api.getTournament)).toHaveBeenCalledWith("tournament-abc");
    expect(vi.mocked(api.getTournamentBracket)).toHaveBeenCalledWith("tournament-abc");
  });

  it("renders a link back to the tournament hub", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    renderDetail();
    await waitFor(() => expect(screen.getByRole("link", { name: /tournament/i })).toHaveAttribute("href", "/tournament"));
  });
});

// ─── Spots label & entrants ───────────────────────────────────────────────────

describe("TournamentDetailPage – spots and entrants list", () => {
  it("shows X / Y spots filled when maxEntrants is set", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail({ entrantCount: 3, maxEntrants: 16 }));
    renderDetail();
    await waitFor(() => expect(screen.getByText(/3 \/ 16 spots filled/i)).toBeInTheDocument());
  });

  it("shows entrant count without max cap using plural entrants", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail({ entrantCount: 2, maxEntrants: null }));
    renderDetail();
    await waitFor(() => expect(screen.getByText(/2 entrants/i)).toBeInTheDocument());
  });

  it("uses singular entrant when count is 1 and no max", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(
      buildDetail({ entrantCount: 1, maxEntrants: null, entrants: [] })
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText(/1 entrant\b/i)).toBeInTheDocument());
  });

  it("shows empty state when there are no entrants", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail({ entrantCount: 0, entrants: [] }));
    renderDetail();
    await waitFor(() => expect(screen.getByText(/no one has signed up yet/i)).toBeInTheDocument());
  });

  it("lists entrant display names", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(
      buildDetail({
        entrants: [
          { userId: "a", displayName: "Alpha", gameSelection: "CS2", registeredAt: "2025-01-01" },
          { userId: "b", displayName: "Bravo", gameSelection: "CS2", registeredAt: "2025-01-02" },
        ],
      })
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Bravo")).toBeInTheDocument();
    });
  });
});

// ─── Guest (not logged in) ────────────────────────────────────────────────────

describe("TournamentDetailPage – guest user", () => {
  it("prompts to log in as a player with a next link", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    renderDetail(null);
    await waitFor(() => expect(screen.getByRole("link", { name: /^log in$/i })).toHaveAttribute("href", "/login?next=%2Ft%2Ftournament-abc"));
  });
});

// ─── onRegister ───────────────────────────────────────────────────────────────

describe("TournamentDetailPage – onRegister", () => {
  it("calls api.registerForTournament when the registration form is submitted", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    vi.mocked(api.registerForTournament).mockResolvedValue({
      tournamentId: "tournament-abc",
      userId: "u1",
      displayName: "Alice",
      gameSelection: "CS2",
      registeredAt: "2025-01-01",
    });
    renderDetail({ id: "u1", displayName: "Alice", role: "player" });

    await waitFor(() => expect(screen.getByText(/sign up for this event/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/sign up for this event/i));
    await waitFor(() => expect(screen.getByRole("button", { name: /confirm registration/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /confirm registration/i }));
    await waitFor(() => expect(vi.mocked(api.registerForTournament)).toHaveBeenCalledWith(
      "tournament-abc",
      expect.objectContaining({ displayName: "Alice" })
    ));
  });

  it("shows a success message after successful registration", async () => {
    vi.mocked(api.getTournament)
      .mockResolvedValueOnce(buildDetail())
      .mockResolvedValue(buildDetail({ entrants: [{ userId: "u1", displayName: "Alice", gameSelection: "CS2", registeredAt: "2025-01-01" }] }));
    vi.mocked(api.registerForTournament).mockResolvedValue({
      tournamentId: "tournament-abc",
      userId: "u1",
      displayName: "Alice",
      gameSelection: "CS2",
      registeredAt: "2025-01-01",
    });
    renderDetail({ id: "u1", displayName: "Alice", role: "player" });

    await waitFor(() => screen.getByText(/sign up for this event/i));
    fireEvent.click(screen.getByText(/sign up for this event/i));
    await waitFor(() => screen.getByRole("button", { name: /confirm registration/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm registration/i }));

    await waitFor(() => expect(screen.getByText(/you are registered/i)).toBeInTheDocument());
  });

  it("shows an error banner when registration fails", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    vi.mocked(api.registerForTournament).mockRejectedValue(new Error("Already registered"));
    renderDetail({ id: "u1", displayName: "Alice", role: "player" });

    await waitFor(() => screen.getByText(/sign up for this event/i));
    fireEvent.click(screen.getByText(/sign up for this event/i));
    await waitFor(() => screen.getByRole("button", { name: /confirm registration/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm registration/i }));

    await waitFor(() => expect(screen.getByText("Already registered")).toBeInTheDocument());
  });

  it("pre-fills game selection from the tournament game", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail({ game: "Rocket League" }));
    renderDetail({ id: "u1", displayName: "Alice", role: "player" });
    await waitFor(() => screen.getByText(/sign up for this event/i));
    fireEvent.click(screen.getByText(/sign up for this event/i));
    await waitFor(() => expect(screen.getByLabelText(/^game$/i)).toHaveValue("Rocket League"));
  });

  it("closes the form when Cancel is clicked", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    renderDetail({ id: "u1", displayName: "Alice", role: "player" });
    await waitFor(() => screen.getByText(/sign up for this event/i));
    fireEvent.click(screen.getByText(/sign up for this event/i));
    await waitFor(() => screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByLabelText(/^game$/i)).not.toBeInTheDocument());
  });
});

// ─── onBracket ────────────────────────────────────────────────────────────────

describe("TournamentDetailPage – onBracket", () => {
  it("calls api.generateBracket when the organizer clicks Generate bracket", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    vi.mocked(api.generateBracket).mockResolvedValue({
      tournamentId: "tournament-abc",
      playerCount: 2,
      roundCount: 1,
      rounds: [],
    });
    renderDetail({ id: "org1", displayName: "Org", role: "organizer" });

    await waitFor(() => screen.getByRole("button", { name: /generate bracket/i }));
    fireEvent.click(screen.getByRole("button", { name: /generate bracket/i }));

    await waitFor(() => expect(vi.mocked(api.generateBracket)).toHaveBeenCalledWith("tournament-abc"));
  });

  it("navigates to the bracket page after bracket generation", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    vi.mocked(api.generateBracket).mockResolvedValue({
      tournamentId: "tournament-abc",
      playerCount: 2,
      roundCount: 1,
      rounds: [],
    });
    renderDetail({ id: "org1", displayName: "Org", role: "organizer" });

    await waitFor(() => screen.getByRole("button", { name: /generate bracket/i }));
    fireEvent.click(screen.getByRole("button", { name: /generate bracket/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/t/tournament-abc/bracket"));
  });

  it("shows an error when generateBracket fails", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    vi.mocked(api.generateBracket).mockRejectedValue(new Error("Need at least 2 players"));
    renderDetail({ id: "org1", displayName: "Org", role: "organizer" });

    await waitFor(() => screen.getByRole("button", { name: /generate bracket/i }));
    fireEvent.click(screen.getByRole("button", { name: /generate bracket/i }));

    await waitFor(() => expect(screen.getByText("Need at least 2 players")).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ─── Computed flags ───────────────────────────────────────────────────────────

describe("TournamentDetailPage – computed flags", () => {
  it("shows 'Registration is closed' when registrationOpen is false", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail({ registrationOpen: false }));
    renderDetail({ id: "u1", displayName: "Alice", role: "player" });
    await waitFor(() => expect(screen.getByText(/registration is closed/i)).toBeInTheDocument());
  });

  it("shows 'Registration is full' when entrantCount equals maxEntrants", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail({ entrantCount: 4, maxEntrants: 4 }));
    renderDetail({ id: "u1", displayName: "Alice", role: "player" });
    await waitFor(() => expect(screen.getByText(/registration is full/i)).toBeInTheDocument());
  });

  it("shows '✓ You are registered.' when the current user is already in the entrants list", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(
      buildDetail({
        entrants: [{ userId: "u1", displayName: "Alice", gameSelection: "CS2", registeredAt: "2025-01-01" }],
      })
    );
    renderDetail({ id: "u1", displayName: "Alice", role: "player" });
    await waitFor(() => expect(screen.getByText(/you are registered/i)).toBeInTheDocument());
  });

  it("does not offer Sign up for organizers", async () => {
    vi.mocked(api.getTournament).mockResolvedValue(buildDetail());
    renderDetail({ id: "org1", displayName: "Org", role: "organizer" });
    await waitFor(() => expect(screen.queryByText(/sign up for this event/i)).not.toBeInTheDocument());
  });
});
