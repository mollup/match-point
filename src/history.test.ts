import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import {
  __resetStoreForTests,
  createTournament,
  addEntrant,
  finalizeTournament,
  setMatchResult,
} from "./store.js";

afterEach(() => {
  __resetStoreForTests();
});

async function register(
  app: ReturnType<typeof createApp>,
  role: "organizer" | "player",
  suffix: string
) {
  const email = `${role}-${suffix}@test.local`;
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      email,
      password: "password123",
      displayName: `${role} ${suffix}`,
      games: ["Test Game"],
      region: "Test Region",
      role,
    });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

describe("GET /api/users/:id/history", () => {
  it("returns 200 with one entry for a finalized tournament", async () => {
    const app = createApp();
    const { userId: organizerId } = await register(app, "organizer", "org");
    const { userId: playerId } = await register(app, "player", "p1");

    const tournament = createTournament({
      name: "Spring Championship",
      game: "Street Fighter 6",
      organizerId,
    });

    addEntrant(tournament.id, {
      userId: playerId,
      displayName: "Player 1",
      gameSelection: "Street Fighter 6",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });

    setMatchResult(tournament.id, playerId, {
      placement: 1,
      wins: 3,
      losses: 0,
    });

    finalizeTournament(tournament.id);

    const res = await request(app).get(`/api/users/${playerId}/history`);
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0]).toMatchObject({
      tournamentId: tournament.id,
      name: "Spring Championship",
      game: "Street Fighter 6",
      placement: 1,
      wins: 3,
      losses: 0,
    });
    expect(typeof res.body.history[0].date).toBe("string");
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.total).toBe(1);
  });

  it("filters by game and returns empty array when no matches", async () => {
    const app = createApp();
    const { userId: organizerId } = await register(app, "organizer", "org");
    const { userId: playerId } = await register(app, "player", "p1");

    const tournament1 = createTournament({
      name: "SF6 Cup",
      game: "Street Fighter 6",
      organizerId,
    });

    const tournament2 = createTournament({
      name: "Tekken Pro",
      game: "Tekken 8",
      organizerId,
    });

    addEntrant(tournament1.id, {
      userId: playerId,
      displayName: "Player 1",
      gameSelection: "Street Fighter 6",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });

    addEntrant(tournament2.id, {
      userId: playerId,
      displayName: "Player 1",
      gameSelection: "Tekken 8",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });

    setMatchResult(tournament1.id, playerId, { placement: 2, wins: 2, losses: 1 });
    setMatchResult(tournament2.id, playerId, { placement: 1, wins: 3, losses: 0 });

    finalizeTournament(tournament1.id);
    finalizeTournament(tournament2.id);

    // Filter by "Street Fighter 6"
    const res1 = await request(app).get(
      `/api/users/${playerId}/history?game=Street Fighter 6`
    );
    expect(res1.status).toBe(200);
    expect(res1.body.history).toHaveLength(1);
    expect(res1.body.history[0].game).toBe("Street Fighter 6");
    expect(res1.body.total).toBe(1);

    // Filter by game that has no finalized tournaments
    const res2 = await request(app).get(`/api/users/${playerId}/history?game=Guilty Gear`);
    expect(res2.status).toBe(200);
    expect(res2.body.history).toHaveLength(0);
    expect(res2.body.total).toBe(0);
  });

  it("respects pagination parameters", async () => {
    const app = createApp();
    const { userId: organizerId } = await register(app, "organizer", "org");
    const { userId: playerId } = await register(app, "player", "p1");

    // Create 5 tournaments
    const tournamentIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const t = createTournament({
        name: `Tournament ${i + 1}`,
        game: "Test Game",
        organizerId,
      });
      tournamentIds.push(t.id);

      addEntrant(t.id, {
        userId: playerId,
        displayName: "Player 1",
        gameSelection: "Test Game",
        registeredAt: new Date().toISOString(),
        checkedIn: true,
      });

      setMatchResult(t.id, playerId, {
        placement: i + 1,
        wins: 5 - i,
        losses: i,
      });

      finalizeTournament(t.id);
    }

    // Get page 1 with pageSize 2
    const res1 = await request(app).get(`/api/users/${playerId}/history?page=1&pageSize=2`);
    expect(res1.status).toBe(200);
    expect(res1.body.history).toHaveLength(2);
    expect(res1.body.page).toBe(1);
    expect(res1.body.pageSize).toBe(2);
    expect(res1.body.total).toBe(5);

    // Get page 2 with pageSize 2
    const res2 = await request(app).get(`/api/users/${playerId}/history?page=2&pageSize=2`);
    expect(res2.status).toBe(200);
    expect(res2.body.history).toHaveLength(2);
    expect(res2.body.page).toBe(2);
    expect(res2.body.total).toBe(5);

    // Get page 3 with pageSize 2 (should have 1 remaining)
    const res3 = await request(app).get(`/api/users/${playerId}/history?page=3&pageSize=2`);
    expect(res3.status).toBe(200);
    expect(res3.body.history).toHaveLength(1);
    expect(res3.body.total).toBe(5);
  });

  it("returns 404 for non-existent user", async () => {
    const app = createApp();
    const res = await request(app).get("/api/users/00000000-0000-0000-0000-000000000000/history");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
  });

  it("returns empty history for user with no finalized tournaments", async () => {
    const app = createApp();
    const { userId: playerId } = await register(app, "player", "p1");

    const res = await request(app).get(`/api/users/${playerId}/history`);
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("excludes non-finalized tournaments from history", async () => {
    const app = createApp();
    const { userId: organizerId } = await register(app, "organizer", "org");
    const { userId: playerId } = await register(app, "player", "p1");

    const tournament1 = createTournament({
      name: "Finalized Tournament",
      game: "Game A",
      organizerId,
    });

    const tournament2 = createTournament({
      name: "Not Finalized Tournament",
      game: "Game B",
      organizerId,
    });

    addEntrant(tournament1.id, {
      userId: playerId,
      displayName: "Player 1",
      gameSelection: "Game A",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });

    addEntrant(tournament2.id, {
      userId: playerId,
      displayName: "Player 1",
      gameSelection: "Game B",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });

    setMatchResult(tournament1.id, playerId, { placement: 1, wins: 2, losses: 0 });
    setMatchResult(tournament2.id, playerId, { placement: 1, wins: 2, losses: 0 });

    finalizeTournament(tournament1.id);
    // tournament2 is NOT finalized

    const res = await request(app).get(`/api/users/${playerId}/history`);
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].name).toBe("Finalized Tournament");
  });
});

describe("GET /api/users/:id", () => {
  it("includes totalTournaments, totalWins, totalLosses, bestPlacement", async () => {
    const app = createApp();
    const { userId: organizerId } = await register(app, "organizer", "org");
    const { userId: playerId } = await register(app, "player", "p1");

    const tournament1 = createTournament({
      name: "Tournament 1",
      game: "Game A",
      organizerId,
    });

    const tournament2 = createTournament({
      name: "Tournament 2",
      game: "Game A",
      organizerId,
    });

    addEntrant(tournament1.id, {
      userId: playerId,
      displayName: "Player 1",
      gameSelection: "Game A",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });

    addEntrant(tournament2.id, {
      userId: playerId,
      displayName: "Player 1",
      gameSelection: "Game A",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });

    setMatchResult(tournament1.id, playerId, { placement: 3, wins: 2, losses: 1 });
    setMatchResult(tournament2.id, playerId, { placement: 1, wins: 4, losses: 0 });

    finalizeTournament(tournament1.id);
    finalizeTournament(tournament2.id);

    const res = await request(app).get(`/api/users/${playerId}`);
    expect(res.status).toBe(200);
    expect(res.body.totalTournaments).toBe(2);
    expect(res.body.totalWins).toBe(6);
    expect(res.body.totalLosses).toBe(1);
    expect(res.body.bestPlacement).toBe(1);
  });

  it("returns zero stats when user has no finalized tournaments", async () => {
    const app = createApp();
    const { userId: playerId } = await register(app, "player", "p1");

    const res = await request(app).get(`/api/users/${playerId}`);
    expect(res.status).toBe(200);
    expect(res.body.totalTournaments).toBe(0);
    expect(res.body.totalWins).toBe(0);
    expect(res.body.totalLosses).toBe(0);
    expect(res.body.bestPlacement).toBeNull();
  });
});
