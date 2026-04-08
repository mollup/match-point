/**
 * Tests for frontend/src/api.ts
 *
 * Covers: setStoredToken, api.login, api.register, api.listTournaments,
 * api.getTournament, api.createTournament, api.registerForTournament,
 * api.getEntrants, api.generateBracket, api.getTournamentBracket,
 * api.getUser, api.patchUser
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, setStoredToken } from "../src/api";

// ─── setStoredToken ────────────────────────────────────────────────────────────

describe("setStoredToken", () => {
  beforeEach(() => localStorage.clear());

  it("stores the token in localStorage under 'mp_token' when a string is provided", () => {
    setStoredToken("abc123");
    expect(localStorage.getItem("mp_token")).toBe("abc123");
  });

  it("removes the token from localStorage when null is passed", () => {
    localStorage.setItem("mp_token", "existing-token");
    setStoredToken(null);
    expect(localStorage.getItem("mp_token")).toBeNull();
  });

  it("overwrites an existing token with the new value", () => {
    setStoredToken("first-token");
    setStoredToken("second-token");
    expect(localStorage.getItem("mp_token")).toBe("second-token");
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetchOk(data: unknown, status = 200) {
  vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(data), { status })
  );
}

function mockFetchError(data: unknown, status: number) {
  vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(data), { status })
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// ─── api.login ────────────────────────────────────────────────────────────────

describe("api.login", () => {
  it("sends a POST request to /api/auth/login", async () => {
    mockFetchOk({ token: "t", user: { id: "1", email: "a@b.com", displayName: "A", role: "player" } });
    await api.login({ email: "a@b.com", password: "pass" });
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(opts?.method).toBe("POST");
  });

  it("returns token and user on a successful response", async () => {
    const payload = { token: "tok123", user: { id: "1", email: "a@b.com", displayName: "Alice", role: "player" } };
    mockFetchOk(payload);
    const result = await api.login({ email: "a@b.com", password: "pass" });
    expect(result.token).toBe("tok123");
    expect(result.user.displayName).toBe("Alice");
  });

  it("throws with the server error message on a 401 response", async () => {
    mockFetchError({ error: "Invalid credentials" }, 401);
    await expect(api.login({ email: "bad@email.com", password: "wrong" })).rejects.toThrow("Invalid credentials");
  });
});

// ─── api.register ─────────────────────────────────────────────────────────────

describe("api.register", () => {
  it("sends a POST request to /api/auth/register", async () => {
    const payload = { token: "t", user: { id: "2", email: "b@c.com", displayName: "Bob", role: "organizer" } };
    mockFetchOk(payload);
    await api.register({ email: "b@c.com", password: "password1", displayName: "Bob", role: "organizer" });
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/auth/register");
  });

  it("returns token and user on success", async () => {
    const payload = { token: "reg-tok", user: { id: "2", email: "b@c.com", displayName: "Bob", role: "organizer" } };
    mockFetchOk(payload);
    const result = await api.register({ email: "b@c.com", password: "password1", displayName: "Bob", role: "organizer" });
    expect(result.token).toBe("reg-tok");
    expect(result.user.role).toBe("organizer");
  });

  it("throws when the server returns a 409 conflict (duplicate email)", async () => {
    mockFetchError({ error: "Email already taken" }, 409);
    await expect(
      api.register({ email: "taken@test.com", password: "pass12", displayName: "User", role: "player" })
    ).rejects.toThrow("Email already taken");
  });
});

// ─── api.listTournaments ──────────────────────────────────────────────────────

describe("api.listTournaments", () => {
  it("sends GET /api/tournaments and returns an array", async () => {
    const data = [
      { id: "1", name: "T1", game: "CS2", entrantCount: 10, maxEntrants: 16, registrationOpen: true, createdAt: "2025-01-01" },
    ];
    mockFetchOk(data);
    const result = await api.listTournaments();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe("T1");
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/tournaments");
  });

  it("returns an empty array when there are no tournaments", async () => {
    mockFetchOk([]);
    const result = await api.listTournaments();
    expect(result).toHaveLength(0);
  });
});

// ─── api.getTournament ────────────────────────────────────────────────────────

describe("api.getTournament", () => {
  it("sends GET /api/tournaments/:id", async () => {
    const data = { id: "abc", name: "T2", game: "SC2", entrantCount: 0, maxEntrants: null, registrationOpen: true, createdAt: "2025-01-01", entrants: [] };
    mockFetchOk(data);
    await api.getTournament("abc");
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/tournaments/abc");
  });

  it("returns the tournament detail on success", async () => {
    const data = { id: "xyz", name: "T3", game: "Valorant", entrantCount: 5, maxEntrants: 8, registrationOpen: false, createdAt: "2025-02-01", entrants: [] };
    mockFetchOk(data);
    const result = await api.getTournament("xyz");
    expect(result.id).toBe("xyz");
    expect(result.registrationOpen).toBe(false);
  });

  it("throws on a 404 response", async () => {
    mockFetchError({ error: "Not found" }, 404);
    await expect(api.getTournament("missing")).rejects.toThrow("Not found");
  });
});

// ─── api.createTournament ─────────────────────────────────────────────────────

describe("api.createTournament", () => {
  it("sends POST /api/tournaments with name and game in body", async () => {
    mockFetchOk({ id: "new-id", name: "New Tourney", game: "Valorant" });
    await api.createTournament({ name: "New Tourney", game: "Valorant" });
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/tournaments");
    expect(opts?.method).toBe("POST");
    expect(JSON.parse(opts?.body as string)).toMatchObject({ name: "New Tourney", game: "Valorant" });
  });

  it("returns the created tournament id", async () => {
    mockFetchOk({ id: "created-id", name: "New", game: "Valorant" });
    const result = await api.createTournament({ name: "New", game: "Valorant" });
    expect(result.id).toBe("created-id");
  });
});

// ─── api.registerForTournament ────────────────────────────────────────────────

describe("api.registerForTournament", () => {
  it("sends POST to /api/tournaments/:id/register", async () => {
    const data = { tournamentId: "t1", userId: "u1", displayName: "Player1", gameSelection: "CS2", registeredAt: "2025-01-01" };
    mockFetchOk(data);
    await api.registerForTournament("t1", { displayName: "Player1", gameSelection: "CS2" });
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/tournaments/t1/register");
  });

  it("throws when registration is closed", async () => {
    mockFetchError({ error: "Registration is closed" }, 400);
    await expect(
      api.registerForTournament("t1", { displayName: "X", gameSelection: "Y" })
    ).rejects.toThrow("Registration is closed");
  });

  it("throws when tournament is full", async () => {
    mockFetchError({ error: "Tournament is full" }, 400);
    await expect(
      api.registerForTournament("t1", { displayName: "X", gameSelection: "Y" })
    ).rejects.toThrow("Tournament is full");
  });
});

// ─── api.getEntrants ──────────────────────────────────────────────────────────

describe("api.getEntrants", () => {
  it("returns the entrant list for a tournament", async () => {
    const data = {
      tournamentId: "t1",
      count: 2,
      entrants: [{ userId: "u1", displayName: "P1", gameSelection: "G", registeredAt: "2025-01-01" }],
    };
    mockFetchOk(data);
    const result = await api.getEntrants("t1");
    expect(result.count).toBe(2);
    expect(result.entrants[0].displayName).toBe("P1");
  });

  it("sends GET to /api/tournaments/:id/entrants", async () => {
    mockFetchOk({ tournamentId: "t2", count: 0, entrants: [] });
    await api.getEntrants("t2");
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/tournaments/t2/entrants");
  });
});

// ─── api.generateBracket ──────────────────────────────────────────────────────

describe("api.generateBracket", () => {
  it("sends POST to /api/tournaments/:id/bracket", async () => {
    const data = { tournamentId: "t1", playerCount: 4, roundCount: 2, rounds: [] };
    mockFetchOk(data);
    await api.generateBracket("t1");
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/tournaments/t1/bracket");
    expect(opts?.method).toBe("POST");
  });

  it("returns the bracket response", async () => {
    const data = { tournamentId: "t1", playerCount: 8, roundCount: 3, rounds: [] };
    mockFetchOk(data);
    const result = await api.generateBracket("t1");
    expect(result.playerCount).toBe(8);
    expect(result.roundCount).toBe(3);
  });
});

// ─── api.getTournamentBracket ─────────────────────────────────────────────────

describe("api.getTournamentBracket", () => {
  it("returns null when the bracket has not been published (404)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("", { status: 404 }));
    const result = await api.getTournamentBracket("t1");
    expect(result).toBeNull();
  });

  it("returns bracket data on a 200 response", async () => {
    const data = { tournamentId: "t1", playerCount: 4, roundCount: 2, rounds: [] };
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(data), { status: 200 })
    );
    const result = await api.getTournamentBracket("t1");
    expect(result?.tournamentId).toBe("t1");
    expect(result?.playerCount).toBe(4);
  });
});

// ─── api.getUser ──────────────────────────────────────────────────────────────

describe("api.getUser", () => {
  it("sends GET to /api/users/:id", async () => {
    const data = { id: "u1", displayName: "Alice", games: ["CS2"], createdAt: "2025-01-01" };
    mockFetchOk(data);
    await api.getUser("u1");
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/users/u1");
  });

  it("returns the user profile on success", async () => {
    const data = { id: "u1", displayName: "Alice", games: ["CS2", "Valorant"], region: "NA", createdAt: "2025-01-01" };
    mockFetchOk(data);
    const result = await api.getUser("u1");
    expect(result.displayName).toBe("Alice");
    expect(result.games).toContain("CS2");
  });

  it("throws with 'User not found' on a 404 response", async () => {
    mockFetchError({ error: "User not found" }, 404);
    await expect(api.getUser("missing")).rejects.toThrow("User not found");
  });
});

// ─── api.patchUser ────────────────────────────────────────────────────────────

describe("api.patchUser", () => {
  it("sends PATCH to /api/users/:id", async () => {
    const data = { id: "u1", displayName: "Updated", games: ["Valorant"], createdAt: "2025-01-01" };
    mockFetchOk(data);
    await api.patchUser("u1", { displayName: "Updated" });
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/users/u1");
    expect(opts?.method).toBe("PATCH");
  });

  it("returns the updated user profile", async () => {
    const data = { id: "u1", displayName: "NewName", games: ["Valorant"], region: "EU", createdAt: "2025-01-01" };
    mockFetchOk(data);
    const result = await api.patchUser("u1", { displayName: "NewName", region: "EU", games: ["Valorant"] });
    expect(result.displayName).toBe("NewName");
    expect(result.region).toBe("EU");
  });

  it("includes the updated games array in the request body", async () => {
    const data = { id: "u1", displayName: "A", games: ["SC2", "Dota2"], createdAt: "2025-01-01" };
    mockFetchOk(data);
    await api.patchUser("u1", { games: ["SC2", "Dota2"] });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(opts?.body as string)).toMatchObject({ games: ["SC2", "Dota2"] });
  });
});
