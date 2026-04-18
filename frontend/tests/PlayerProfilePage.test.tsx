/**
 * Tests for frontend/src/pages/PlayerProfilePage.tsx
 *
 * Covers: loadProfile (API call + state transitions), openEdit (shows form),
 * cancelEdit (returns to view), addGame (adds unique games), removeGame
 * (removes a game), saveEdit (calls api.patchUser, validates non-empty games).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlayerProfilePage } from "../src/pages/PlayerProfilePage";
import { api } from "../src/api";
import { useAuth } from "../src/auth-context";

vi.mock("../src/api", () => ({
  api: {
    getUser: vi.fn(),
    patchUser: vi.fn(),
  },
}));

vi.mock("../src/auth-context", () => ({ useAuth: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ id: "u1" }),
  };
});

const ownUser = { id: "u1", email: "alice@test.com", displayName: "Alice", role: "player" as const };

function buildProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    displayName: "Alice",
    games: ["CS2", "Valorant"],
    region: "NA",
    createdAt: "2025-01-01",
    ...overrides,
  };
}

function renderProfile(authUser: Record<string, unknown> | null = ownUser as Record<string, unknown>) {
  vi.mocked(useAuth).mockReturnValue({ user: authUser, ready: true } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={["/players/u1"]}>
      <Routes>
        <Route path="/players/:id" element={<PlayerProfilePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── loadProfile ──────────────────────────────────────────────────────────────

describe("PlayerProfilePage – loadProfile", () => {
  it("calls api.getUser with the profile id on mount", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile());
    renderProfile();
    await waitFor(() => expect(vi.mocked(api.getUser)).toHaveBeenCalledWith("u1"));
  });

  it("renders the user's display name after loading", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile({ displayName: "Alice" }));
    renderProfile();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
  });

  it("renders the user's game tags", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile({ games: ["CS2", "Valorant"] }));
    renderProfile();
    await waitFor(() => expect(screen.getByText("CS2")).toBeInTheDocument());
    expect(screen.getByText("Valorant")).toBeInTheDocument();
  });

  it("transitions to error state when api.getUser throws", async () => {
    vi.mocked(api.getUser).mockRejectedValue(new Error("Profile not found"));
    renderProfile();
    await waitFor(() => expect(screen.getByText(/profile not found/i)).toBeInTheDocument());
  });

  it("shows the empty-profile 'Welcome' state when the user has no games", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile({ games: [] }));
    renderProfile();
    await waitFor(() => expect(screen.getByText(/welcome to the/i)).toBeInTheDocument());
  });
});

// ─── openEdit ────────────────────────────────────────────────────────────────

describe("PlayerProfilePage – openEdit", () => {
  it("shows the edit form when the Edit Profile button is clicked", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile());
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() => expect(screen.getByLabelText(/display name/i)).toBeInTheDocument());
  });

  it("pre-fills the display name field with the current profile value", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile({ displayName: "Alice" }));
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() => {
      const input = screen.getByLabelText(/display name/i) as HTMLInputElement;
      expect(input.value).toBe("Alice");
    });
  });
});

// ─── cancelEdit ──────────────────────────────────────────────────────────────

describe("PlayerProfilePage – cancelEdit", () => {
  it("returns to the view state when Cancel is clicked", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile());
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() => screen.getByRole("button", { name: /cancel/i }));

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument());
  });
});

// ─── addGame ─────────────────────────────────────────────────────────────────

describe("PlayerProfilePage – addGame", () => {
  async function openEditAndWait() {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile({ games: ["CS2"] }));
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() => screen.getByLabelText(/display name/i));
  }

  it("adds a new game to the list", async () => {
    await openEditAndWait();
    const gameInput = screen.getByPlaceholderText(/type a game/i);
    fireEvent.change(gameInput, { target: { value: "Dota 2" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() => expect(screen.getByText("Dota 2")).toBeInTheDocument());
  });

  it("does not add a duplicate game", async () => {
    await openEditAndWait();
    const gameInput = screen.getByPlaceholderText(/type a game/i);
    fireEvent.change(gameInput, { target: { value: "CS2" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    // CS2 should appear exactly once
    const tags = screen.getAllByText("CS2");
    expect(tags).toHaveLength(1);
  });

  it("clears the input field after adding a game", async () => {
    await openEditAndWait();
    const gameInput = screen.getByPlaceholderText(/type a game/i) as HTMLInputElement;
    fireEvent.change(gameInput, { target: { value: "Dota 2" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => expect(gameInput.value).toBe(""));
  });
});

// ─── removeGame ──────────────────────────────────────────────────────────────

describe("PlayerProfilePage – removeGame", () => {
  it("removes a game tag when its remove button is clicked", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile({ games: ["CS2", "Valorant"] }));
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() => screen.getByText("Valorant"));

    // aria-label is "Remove <game>"
    fireEvent.click(screen.getByRole("button", { name: "Remove Valorant" }));
    await waitFor(() => expect(screen.queryByText("Valorant")).not.toBeInTheDocument());
  });
});

// ─── saveEdit ────────────────────────────────────────────────────────────────

describe("PlayerProfilePage – saveEdit", () => {
  it("calls api.patchUser with updated fields on form submit", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile());
    vi.mocked(api.patchUser).mockResolvedValue(buildProfile({ displayName: "Alice Updated" }));
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() => screen.getByLabelText(/display name/i));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Alice Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(vi.mocked(api.patchUser)).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ displayName: "Alice Updated" })
      )
    );
  });

  it("shows a success toast after saving", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile());
    vi.mocked(api.patchUser).mockResolvedValue(buildProfile());
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() => screen.getByRole("button", { name: /save/i }));

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument());
  });

  it("shows a validation error when attempting to save with no games", async () => {
    vi.mocked(api.getUser).mockResolvedValue(buildProfile({ games: ["CS2"] }));
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() => screen.getByText("CS2"));

    // Remove the only game
    const removeBtn = screen.getByRole("button", { name: /remove|×/i });
    fireEvent.click(removeBtn);

    // Try to save
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(screen.getByText(/at least one game/i)).toBeInTheDocument());
    expect(vi.mocked(api.patchUser)).not.toHaveBeenCalled();
  });
});
