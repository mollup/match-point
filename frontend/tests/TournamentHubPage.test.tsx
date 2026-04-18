/**
 * Tests for frontend/src/pages/TournamentHubPage.tsx
 *
 * Covers: loadList (success + failure), loading UI, filtered search,
 * ?create=1 deep link, setCurrentEventTitle, organizer vs player UI,
 * startCreate / backToFind, submitBasics (create + error + skip when draft),
 * setup steps 2–3.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TournamentHubPage } from "../src/pages/TournamentHubPage";
import { api } from "../src/api";
import { useAuth } from "../src/auth-context";

vi.mock("../src/api", () => ({
  api: {
    listTournaments: vi.fn(),
    createTournament: vi.fn(),
  },
}));

vi.mock("../src/auth-context", () => ({ useAuth: vi.fn() }));

const setCurrentEventTitle = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useOutletContext: () => ({ setCurrentEventTitle }),
  };
});

function buildTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    name: "Test Open",
    game: "CS2",
    entrantCount: 5,
    maxEntrants: 16,
    registrationOpen: true,
    createdAt: "2025-01-01",
    ...overrides,
  };
}

function renderHub(user: Record<string, unknown> | null = null, path = "/tournament") {
  vi.mocked(useAuth).mockReturnValue({ user } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tournament" element={<TournamentHubPage />} />
        <Route path="/t/:id" element={<div>detail-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setCurrentEventTitle.mockClear();
});

// ─── loadList ─────────────────────────────────────────────────────────────────

describe("TournamentHubPage – loadList", () => {
  it("calls api.listTournaments on mount", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderHub();
    await waitFor(() => expect(vi.mocked(api.listTournaments)).toHaveBeenCalledTimes(1));
  });

  it("renders the list of tournaments returned by the API", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([
      buildTournament({ id: "t1", name: "Apex Open" }),
      buildTournament({ id: "t2", name: "Valorant Cup" }),
    ]);
    renderHub();
    await waitFor(() => expect(screen.getByText("Apex Open")).toBeInTheDocument());
    expect(screen.getByText("Valorant Cup")).toBeInTheDocument();
  });

  it("shows an empty tournaments message when the list is empty", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderHub();
    await waitFor(() => expect(screen.getByText(/no tournaments match/i)).toBeInTheDocument());
  });

  it("shows Loading before listTournaments resolves", () => {
    vi.mocked(api.listTournaments).mockReturnValue(new Promise(() => {}));
    renderHub();
    expect(screen.getByText(/^loading/i)).toBeInTheDocument();
  });

  it("sets list to empty when listTournaments throws", async () => {
    vi.mocked(api.listTournaments).mockRejectedValue(new Error("network"));
    renderHub();
    await waitFor(() => expect(screen.getByText(/no tournaments match/i)).toBeInTheDocument());
  });

  it("renders singular 'entrant' when count is 1", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([buildTournament({ id: "solo", name: "Solo Cup", entrantCount: 1 })]);
    renderHub();
    await waitFor(() => expect(screen.getByText(/1 entrant(?!s)/i)).toBeInTheDocument());
  });
});

// ─── filtered useMemo ──────────────────────────────────────────────────────────

describe("TournamentHubPage – filtered", () => {
  beforeEach(() => {
    vi.mocked(api.listTournaments).mockResolvedValue([
      buildTournament({ id: "t1", name: "Apex Open", game: "Apex Legends" }),
      buildTournament({ id: "t2", name: "Valorant Cup", game: "Valorant" }),
      buildTournament({ id: "t3", name: "CS2 Masters", game: "CS2" }),
    ]);
  });

  it("shows all tournaments when the search query is empty", async () => {
    renderHub();
    await waitFor(() => expect(screen.getByText("Apex Open")).toBeInTheDocument());
    expect(screen.getByText("Valorant Cup")).toBeInTheDocument();
    expect(screen.getByText("CS2 Masters")).toBeInTheDocument();
  });

  it("filters tournaments by name (case-insensitive)", async () => {
    renderHub();
    await waitFor(() => screen.getByText("Apex Open"));

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "apex" } });

    await waitFor(() => {
      expect(screen.getByText("Apex Open")).toBeInTheDocument();
      expect(screen.queryByText("Valorant Cup")).not.toBeInTheDocument();
    });
  });

  it("filters tournaments by game name (case-insensitive)", async () => {
    renderHub();
    await waitFor(() => screen.getByText("Apex Open"));

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "cs2" } });

    await waitFor(() => {
      expect(screen.getByText("CS2 Masters")).toBeInTheDocument();
      expect(screen.queryByText("Apex Open")).not.toBeInTheDocument();
    });
  });

  it("shows nothing when the query matches no tournaments", async () => {
    renderHub();
    await waitFor(() => screen.getByText("Apex Open"));

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "zzznomatch" } });

    await waitFor(() => {
      expect(screen.queryByText("Apex Open")).not.toBeInTheDocument();
      expect(screen.queryByText("Valorant Cup")).not.toBeInTheDocument();
    });
  });
});

// ─── Player vs organizer (find phase) ───────────────────────────────────────

describe("TournamentHubPage – find phase roles", () => {
  it("does not show New event setup for players", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderHub({ role: "player", displayName: "Pat" });
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/new event setup/i)).not.toBeInTheDocument();
  });
});

// ─── ?create=1 deep link ──────────────────────────────────────────────────────

describe("TournamentHubPage – create query param", () => {
  it("opens setup step 1 for organizers when ?create=1", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderHub({ role: "organizer", displayName: "Org" }, "/tournament?create=1");
    await waitFor(() => expect(screen.getByLabelText(/event title/i)).toBeInTheDocument());
  });

  it("calls setCurrentEventTitle while in setup with the event name", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderHub({ role: "organizer", displayName: "Org" });
    await waitFor(() => screen.getByText(/new event setup/i));
    fireEvent.click(screen.getByText(/new event setup/i));
    await waitFor(() => expect(screen.getByLabelText(/event title/i)).toBeInTheDocument());
    await waitFor(() =>
      expect(setCurrentEventTitle).toHaveBeenCalledWith(expect.stringContaining("Apex"))
    );
  });
});

// ─── startCreate / backToFind ─────────────────────────────────────────────────

describe("TournamentHubPage – startCreate and backToFind", () => {
  it("transitions to the setup wizard when an organizer clicks Create Tournament", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderHub({ role: "organizer", displayName: "Org" });
    await waitFor(() => screen.getByText(/new event setup/i));

    fireEvent.click(screen.getByText(/new event setup/i));
    await waitFor(() => expect(screen.getByText(/event title/i)).toBeInTheDocument());
  });

  it("returns to the find phase when cancel / back is clicked", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    renderHub({ role: "organizer", displayName: "Org" });
    await waitFor(() => screen.getByText(/new event setup/i));
    fireEvent.click(screen.getByText(/new event setup/i));

    await waitFor(() => screen.getByText(/event title/i));
    // "Cancel" button inside the setup step returns to find phase
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText(/event title/i)).not.toBeInTheDocument());
  });
});

// ─── submitBasics ─────────────────────────────────────────────────────────────

describe("TournamentHubPage – submitBasics", () => {
  it("calls api.createTournament with the entered name and game", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    vi.mocked(api.createTournament).mockResolvedValue({ id: "new-t", name: "New Event", game: "SC2" });
    renderHub({ role: "organizer", displayName: "Org" });

    await waitFor(() => screen.getByText(/new event setup/i));
    fireEvent.click(screen.getByText(/new event setup/i));

    // The form pre-fills with default values; clear and type new values
    await waitFor(() => screen.getByLabelText(/event title/i));
    fireEvent.change(screen.getByLabelText(/event title/i), { target: { value: "New Event" } });
    fireEvent.change(screen.getByLabelText(/^game$/i), { target: { value: "SC2" } });
    fireEvent.click(screen.getByRole("button", { name: /continue to roster/i }));

    await waitFor(() =>
      expect(vi.mocked(api.createTournament)).toHaveBeenCalledWith({ name: "New Event", game: "SC2" })
    );
  });

  it("shows an error message when createTournament fails", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    vi.mocked(api.createTournament).mockRejectedValue(new Error("Server busy"));
    renderHub({ role: "organizer", displayName: "Org" });

    await waitFor(() => screen.getByText(/new event setup/i));
    fireEvent.click(screen.getByText(/new event setup/i));
    await waitFor(() => screen.getByLabelText(/event title/i));
    fireEvent.click(screen.getByRole("button", { name: /continue to roster/i }));

    await waitFor(() => expect(screen.getByText("Server busy")).toBeInTheDocument());
  });

  it("advances to roster without calling create again when returning to step 1 with a draft id", async () => {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    vi.mocked(api.createTournament).mockResolvedValue({ id: "draft-id", name: "Evt", game: "G" });
    renderHub({ role: "organizer", displayName: "Org" });

    await waitFor(() => screen.getByText(/new event setup/i));
    fireEvent.click(screen.getByText(/new event setup/i));
    await waitFor(() => screen.getByLabelText(/event title/i));
    fireEvent.click(screen.getByRole("button", { name: /continue to roster/i }));
    await waitFor(() => expect(screen.getByText(/adding players/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
    await waitFor(() => screen.getByLabelText(/event title/i));
    vi.mocked(api.createTournament).mockClear();

    fireEvent.click(screen.getByRole("button", { name: /continue to roster/i }));
    await waitFor(() => expect(screen.getByText(/adding players/i)).toBeInTheDocument());
    expect(vi.mocked(api.createTournament)).not.toHaveBeenCalled();
  });
});

// ─── Setup steps 2 and 3 ───────────────────────────────────────────────────────

describe("TournamentHubPage – setup steps 2–3", () => {
  async function goToRosterStep() {
    vi.mocked(api.listTournaments).mockResolvedValue([]);
    vi.mocked(api.createTournament).mockResolvedValue({ id: "evt-99", name: "Evt", game: "G" });
    renderHub({ role: "organizer", displayName: "Org" });
    await waitFor(() => screen.getByText(/new event setup/i));
    fireEvent.click(screen.getByText(/new event setup/i));
    await waitFor(() => screen.getByLabelText(/event title/i));
    fireEvent.click(screen.getByRole("button", { name: /continue to roster/i }));
    await waitFor(() => expect(screen.getByText(/adding players/i)).toBeInTheDocument());
  }

  it("shows roster progress and can continue to the engine step", async () => {
    await goToRosterStep();
    fireEvent.click(screen.getByRole("button", { name: /continue to engine/i }));
    await waitFor(() => expect(screen.getByText(/bracket engine/i)).toBeInTheDocument());
  });

  it("shows a link to the new event on step 3 after creation", async () => {
    await goToRosterStep();
    fireEvent.click(screen.getByRole("button", { name: /continue to engine/i }));
    await waitFor(() => expect(screen.getByRole("link", { name: /open event.*generate bracket/i })).toHaveAttribute("href", "/t/evt-99"));
  });
});
