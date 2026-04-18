import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { __resetStoreForTests } from "./store.js";

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
      role,
    });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

async function createTournamentAndEntrants(
  app: ReturnType<typeof createApp>,
  playerCount: number
) {
  const org = await register(app, "organizer", "org");
  const tRes = await request(app)
    .post("/api/tournaments")
    .set("Authorization", `Bearer ${org.token}`)
    .send({ name: "Check-In Test", game: "SF6" });
  const tid = tRes.body.id as string;

  const players: { token: string; userId: string }[] = [];
  for (let i = 0; i < playerCount; i++) {
    const p = await register(app, "player", `p${i + 1}`);
    const regRes = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${p.token}`)
      .send({ displayName: `Player ${i + 1}`, gameSelection: "SF6" });
    expect(regRes.status).toBe(201);
    players.push(p);
  }
  return { orgToken: org.token, tid, players };
}

describe("POST /api/tournaments/:id/checkin/:entrantId", () => {
  it("returns 200 and the updated entrant with checkedIn:true when organizer checks a player in", async () => {
    const app = createApp();
    const { orgToken, tid, players } = await createTournamentAndEntrants(app, 2);

    const res = await request(app)
      .post(`/api/tournaments/${tid}/checkin/${players[0].userId}`)
      .set("Authorization", `Bearer ${orgToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: players[0].userId,
      checkedIn: true,
    });
  });

  it("returns 403 when a non-organizer player tries to check someone in", async () => {
    const app = createApp();
    const { tid, players } = await createTournamentAndEntrants(app, 2);

    const res = await request(app)
      .post(`/api/tournaments/${tid}/checkin/${players[1].userId}`)
      .set("Authorization", `Bearer ${players[0].token}`);

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/tournaments/:id/checkin/:entrantId", () => {
  it("returns 200 and flips checkedIn back to false", async () => {
    const app = createApp();
    const { orgToken, tid, players } = await createTournamentAndEntrants(app, 1);

    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${players[0].userId}`)
      .set("Authorization", `Bearer ${orgToken}`);

    const res = await request(app)
      .delete(`/api/tournaments/${tid}/checkin/${players[0].userId}`)
      .set("Authorization", `Bearer ${orgToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: players[0].userId,
      checkedIn: false,
    });
  });
});

describe("GET /api/tournaments/:id/entrants (check-in surface)", () => {
  it("returns checkedIn status for every entrant", async () => {
    const app = createApp();
    const { orgToken, tid, players } = await createTournamentAndEntrants(app, 3);

    // Check in only the first player
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${players[0].userId}`)
      .set("Authorization", `Bearer ${orgToken}`);

    const res = await request(app).get(`/api/tournaments/${tid}/entrants`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    for (const e of res.body.entrants) {
      expect(typeof e.checkedIn).toBe("boolean");
    }
    const checkedIn = res.body.entrants.find(
      (e: { userId: string }) => e.userId === players[0].userId
    );
    expect(checkedIn.checkedIn).toBe(true);
    const others = res.body.entrants.filter(
      (e: { userId: string }) => e.userId !== players[0].userId
    );
    for (const e of others) expect(e.checkedIn).toBe(false);
  });
});

describe("POST /api/tournaments/:id/bracket with check-in gating", () => {
  it("returns 409 when called before check-in is closed (no explicit players body)", async () => {
    const app = createApp();
    const { orgToken, tid, players } = await createTournamentAndEntrants(app, 2);

    // Players are registered but check-in is still open — bracket must be blocked
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${players[0].userId}`)
      .set("Authorization", `Bearer ${orgToken}`);

    const res = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({});

    expect(res.status).toBe(409);
  });

  it("excludes entrants with checkedIn:false once checkInClosed is true", async () => {
    const app = createApp();
    const { orgToken, tid, players } = await createTournamentAndEntrants(app, 4);

    // Check in 3 of 4; leave players[3] as a no-show
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/tournaments/${tid}/checkin/${players[i].userId}`)
        .set("Authorization", `Bearer ${orgToken}`);
    }
    const closeRes = await request(app)
      .post(`/api/tournaments/${tid}/checkin/close`)
      .set("Authorization", `Bearer ${orgToken}`);
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.checkInClosed).toBe(true);

    const res = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.playerCount).toBe(3);
    // The no-show's userId must not appear in any bracket match
    const seenIds = new Set<string>();
    for (const round of res.body.rounds) {
      for (const match of round.matches) {
        if (match.player1) seenIds.add(match.player1.userId);
        if (match.player2) seenIds.add(match.player2.userId);
      }
    }
    expect(seenIds.has(players[3].userId)).toBe(false);
  });
});

describe("POST /api/tournaments/:id/checkin/close", () => {
  it("transitions the tournament to checkInClosed:true and rejects further check-in calls with 409", async () => {
    const app = createApp();
    const { orgToken, tid, players } = await createTournamentAndEntrants(app, 2);

    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${players[0].userId}`)
      .set("Authorization", `Bearer ${orgToken}`);

    const closeRes = await request(app)
      .post(`/api/tournaments/${tid}/checkin/close`)
      .set("Authorization", `Bearer ${orgToken}`);
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.checkInClosed).toBe(true);

    const lateCheckIn = await request(app)
      .post(`/api/tournaments/${tid}/checkin/${players[1].userId}`)
      .set("Authorization", `Bearer ${orgToken}`);
    expect(lateCheckIn.status).toBe(409);
  });
});
