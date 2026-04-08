/**
 * Tests for frontend/src/pages/TournamentHubPage.tsx
 *
 * Covers: loadList (API call on mount), filtered useMemo (query matching by
 * name and game), startCreate / backToFind phase transitions, and
 * submitBasics (organizer creates a tournament).
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

// TournamentHubPage uses useOutletContext; mock it so it doesn't throw
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useOutletContext: () => ({ setCurrentEventTitle: vi.fn() }),
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
});
