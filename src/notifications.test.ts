import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { buildSingleEliminationBracket } from "./bracket/singleElimination.js";
import { createApp } from "./app.js";
import {
  __resetStoreForTests,
  addEntrant,
  createTournament,
  createUser,
  getTournamentBracket,
  listUnreadMatchCallNotifications,
  setTournamentBracket,
} from "./store.js";

afterEach(() => {
  __resetStoreForTests();
});

async function registerAuth(
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
      role,
    });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.user.id as string, email };
}

describe("US12 match-call notifications", () => {
  it("enqueues notifications for both entrants when a match becomes ready (bracket generation)", async () => {
    const app = createApp();
    const { token: orgToken } = await registerAuth(app, "organizer", "o");
    const p1 = await registerAuth(app, "player", "a");
    const p2 = await registerAuth(app, "player", "b");

    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ name: "Locals", game: "SF6" });
    const tid = tRes.body.id as string;

    for (const p of [p1, p2]) {
      await request(app)
        .post(`/api/tournaments/${tid}/register`)
        .set("Authorization", `Bearer ${p.token}`)
        .send({ displayName: `D-${p.userId.slice(0, 4)}`, gameSelection: "SF6" });
    }

    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${p1.userId}`)
      .set("Authorization", `Bearer ${orgToken}`);
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${p2.userId}`)
      .set("Authorization", `Bearer ${orgToken}`);
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/close`)
      .set("Authorization", `Bearer ${orgToken}`);

    await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({});

    const n1 = await request(app)
      .get(`/api/users/${p1.userId}/notifications`)
      .set("Authorization", `Bearer ${p1.token}`);
    expect(n1.status).toBe(200);
    expect(n1.body).toHaveLength(1);
    expect(n1.body[0]).toMatchObject({
      tournamentId: tid,
      round: 1,
      opponentDisplayName: expect.any(String),
    });
    expect(typeof n1.body[0].matchId).toBe("string");
    expect(typeof n1.body[0].createdAt).toBe("string");
    expect(n1.body[0].stationLabel).toBeNull();

    const n2 = await request(app)
      .get(`/api/users/${p2.userId}/notifications`)
      .set("Authorization", `Bearer ${p2.token}`);
    expect(n2.status).toBe(200);
    expect(n2.body).toHaveLength(1);
    expect(n2.body[0].tournamentId).toBe(tid);
    expect(n1.body[0].opponentDisplayName).toBe(`D-${p2.userId.slice(0, 4)}`);
    expect(n2.body[0].opponentDisplayName).toBe(`D-${p1.userId.slice(0, 4)}`);
  });

  it("GET /api/users/:id/notifications returns 403 for another user", async () => {
    const app = createApp();
    const a = await registerAuth(app, "player", "a");
    const b = await registerAuth(app, "player", "b");
    const res = await request(app)
      .get(`/api/users/${b.userId}/notifications`)
      .set("Authorization", `Bearer ${a.token}`);
    expect(res.status).toBe(403);
  });

  it("POST /api/notifications/:id/ack returns 200, 404, and 403 appropriately", async () => {
    const app = createApp();
    const { token: orgToken } = await registerAuth(app, "organizer", "o");
    const p1 = await registerAuth(app, "player", "a");
    const p2 = await registerAuth(app, "player", "b");

    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ name: "Locals", game: "SF6" });
    const tid = tRes.body.id as string;

    for (const p of [p1, p2]) {
      await request(app)
        .post(`/api/tournaments/${tid}/register`)
        .set("Authorization", `Bearer ${p.token}`)
        .send({ displayName: "Reg", gameSelection: "SF6" });
    }
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${p1.userId}`)
      .set("Authorization", `Bearer ${orgToken}`);
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${p2.userId}`)
      .set("Authorization", `Bearer ${orgToken}`);
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/close`)
      .set("Authorization", `Bearer ${orgToken}`);
    await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({});

    const list = await request(app)
      .get(`/api/users/${p1.userId}/notifications`)
      .set("Authorization", `Bearer ${p1.token}`);
    const nid = list.body[0].id as string;

    const ok = await request(app)
      .post(`/api/notifications/${nid}/ack`)
      .set("Authorization", `Bearer ${p1.token}`);
    expect(ok.status).toBe(200);

    const again = await request(app)
      .get(`/api/users/${p1.userId}/notifications`)
      .set("Authorization", `Bearer ${p1.token}`);
    expect(again.body).toHaveLength(0);

    const missing = await request(app)
      .post("/api/notifications/00000000-0000-4000-8000-000000000099/ack")
      .set("Authorization", `Bearer ${p1.token}`);
    expect(missing.status).toBe(404);

    const listB = await request(app)
      .get(`/api/users/${p2.userId}/notifications`)
      .set("Authorization", `Bearer ${p2.token}`);
    const otherNid = listB.body[0].id as string;
    const forbidden = await request(app)
      .post(`/api/notifications/${otherNid}/ack`)
      .set("Authorization", `Bearer ${p1.token}`);
    expect(forbidden.status).toBe(403);
  });

  it("does not notify a user who is not an entrant (fixture: bracket override list)", async () => {
    const app = createApp();
    const { token: orgToken } = await registerAuth(app, "organizer", "o");
    const entrant = await registerAuth(app, "player", "in");
    const ghostId = "99999999-9999-4999-8999-999999999999";

    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ name: "T", game: "G" });
    const tid = tRes.body.id as string;

    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${entrant.token}`)
      .send({ displayName: "Real", gameSelection: "G" });

    await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({
        players: [
          { userId: entrant.userId, displayName: "Real" },
          { userId: ghostId, displayName: "Ghost" },
        ],
      });

    const nEntrant = await request(app)
      .get(`/api/users/${entrant.userId}/notifications`)
      .set("Authorization", `Bearer ${entrant.token}`);
    expect(nEntrant.status).toBe(200);
    expect(nEntrant.body).toHaveLength(1);

    expect(listUnreadMatchCallNotifications(ghostId)).toHaveLength(0);
  });

  it("is idempotent for the same (tournament, match, player) when match-ready is replayed", async () => {
    const app = createApp();
    const { token: orgToken } = await registerAuth(app, "organizer", "o");
    const p1 = await registerAuth(app, "player", "a");
    const p2 = await registerAuth(app, "player", "b");

    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ name: "Locals", game: "SF6" });
    const tid = tRes.body.id as string;

    for (const p of [p1, p2]) {
      await request(app)
        .post(`/api/tournaments/${tid}/register`)
        .set("Authorization", `Bearer ${p.token}`)
        .send({ displayName: "R", gameSelection: "SF6" });
    }

    const body = {
      players: [
        { userId: p1.userId, displayName: "A" },
        { userId: p2.userId, displayName: "B" },
      ],
    };

    await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send(body);
    const first = await request(app)
      .get(`/api/users/${p1.userId}/notifications`)
      .set("Authorization", `Bearer ${p1.token}`);
    expect(first.body).toHaveLength(1);

    await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send(body);
    const second = await request(app)
      .get(`/api/users/${p1.userId}/notifications`)
      .set("Authorization", `Bearer ${p1.token}`);
    expect(second.body).toHaveLength(1);
    expect(second.body[0].id).toBe(first.body[0].id);
  });

  it("enqueues when a later-round match becomes ready after reporting a winner", async () => {
    const app = createApp();
    const { token: orgToken } = await registerAuth(app, "organizer", "o");
    const players = await Promise.all([
      registerAuth(app, "player", "p1"),
      registerAuth(app, "player", "p2"),
      registerAuth(app, "player", "p3"),
      registerAuth(app, "player", "p4"),
    ]);

    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ name: "Quad", game: "SF6" });
    const tid = tRes.body.id as string;

    for (const p of players) {
      await request(app)
        .post(`/api/tournaments/${tid}/register`)
        .set("Authorization", `Bearer ${p.token}`)
        .send({ displayName: "R", gameSelection: "SF6" });
    }

    const bracketRes = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({
        players: players.map((p) => ({ userId: p.userId, displayName: p.userId.slice(0, 6) })),
      });
    expect(bracketRes.status).toBe(200);
    const r1Matches = bracketRes.body.rounds[0].matches.filter(
      (m: { player1: unknown; player2: unknown }) => m.player1 && m.player2
    );
    expect(r1Matches.length).toBeGreaterThanOrEqual(1);
    const m0 = r1Matches[0];

    await request(app)
      .post(`/api/tournaments/${tid}/matches/${m0.id}/winner`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ winnerUserId: m0.player1.userId });

    await request(app)
      .post(`/api/tournaments/${tid}/matches/${r1Matches[1].id}/winner`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ winnerUserId: r1Matches[1].player1.userId });

    const bracket = getTournamentBracket(tid)!;
    const r2Ready = bracket.rounds[1].matches.find(
      (m: { status: string }) => m.status === "ready"
    );
    expect(r2Ready).toBeDefined();

    const winnerId = r1Matches[0].player1.userId as string;
    const list = await request(app)
      .get(`/api/users/${winnerId}/notifications`)
      .set("Authorization", `Bearer ${players.find((p) => p.userId === winnerId)!.token}`);
    expect(list.status).toBe(200);
    const rounds = list.body.map((x: { round: number }) => x.round);
    expect(rounds.some((r: number) => r === 2)).toBe(true);
  });
});

describe("US12 notification payload — stationLabel", () => {
  it("includes stationLabel when set on the match before the bracket is stored", () => {
    __resetStoreForTests();
    const org = createUser({
      email: "o@test.local",
      passwordHash: "x",
      displayName: "Org",
      role: "organizer",
    });
    const p1 = createUser({
      email: "a@test.local",
      passwordHash: "x",
      displayName: "Amy",
      role: "player",
    });
    const p2 = createUser({
      email: "b@test.local",
      passwordHash: "x",
      displayName: "Bob",
      role: "player",
    });
    const tid = createTournament({ name: "T", game: "G", organizerId: org.id }).id;
    addEntrant(tid, {
      userId: p1.id,
      displayName: p1.displayName,
      gameSelection: "G",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });
    addEntrant(tid, {
      userId: p2.id,
      displayName: p2.displayName,
      gameSelection: "G",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
    });

    const bracket = buildSingleEliminationBracket(tid, [
      { userId: p1.id, displayName: p1.displayName },
      { userId: p2.id, displayName: p2.displayName },
    ]);
    const m = bracket.rounds[0]!.matches.find((x) => x.player1 && x.player2);
    expect(m).toBeDefined();
    m!.stationLabel = "Stream 1";

    setTournamentBracket(tid, bracket);

    const forP1 = listUnreadMatchCallNotifications(p1.id);
    expect(forP1).toHaveLength(1);
    expect(forP1[0].stationLabel).toBe("Stream 1");
  });
});
