import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { __resetStoreForTests } from "./store.js";

function ceilLog2(n: number): number {
  return Math.ceil(Math.log2(n));
}

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
  return { token: res.body.token as string, email };
}

describe("GET /api/tournaments", () => {
  it("lists tournaments with entrant counts", async () => {
    const app = createApp();
    const { token } = await register(app, "organizer", "o");
    await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "A", game: "G" });
    const res = await request(app).get("/api/tournaments");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toMatchObject({ name: "A", game: "G", entrantCount: 0 });
    expect(typeof res.body[0].id).toBe("string");
  });
});

describe("POST /api/tournaments", () => {
  it("returns 201 with id, name, game for organizer", async () => {
    const app = createApp();
    const { token } = await register(app, "organizer", "a");
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Winter Jam", game: "Street Fighter 6" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Winter Jam",
      game: "Street Fighter 6",
    });
    expect(typeof res.body.id).toBe("string");
    expect(res.body.id.length).toBeGreaterThan(0);
  });

  it("returns 403 for authenticated player", async () => {
    const app = createApp();
    const { token } = await register(app, "player", "p1");
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Open", game: "GGST" });
    expect(res.status).toBe(403);
  });

  it("returns 401 without auth", async () => {
    const app = createApp();
    const res = await request(app).post("/api/tournaments").send({ name: "X", game: "Y" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/tournaments/:id/bracket", () => {
  it("returns 404 when bracket has not been generated", async () => {
    const app = createApp();
    const { token } = await register(app, "organizer", "o");
    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", game: "Y" });
    const tid = tRes.body.id as string;
    const res = await request(app).get(`/api/tournaments/${tid}/bracket`);
    expect(res.status).toBe(404);
  });

  it("returns stored bracket without auth after organizer generates it", async () => {
    const app = createApp();
    const { token } = await register(app, "organizer", "o");
    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", game: "Y" });
    const tid = tRes.body.id as string;
    const postRes = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        players: [
          { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", displayName: "A" },
          { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", displayName: "B" },
        ],
      });
    expect(postRes.status).toBe(200);
    const getRes = await request(app).get(`/api/tournaments/${tid}/bracket`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(postRes.body);
  });
});

describe("POST /api/tournaments/:id/bracket", () => {
  it("returns 400 when fewer than 2 players", async () => {
    const app = createApp();
    const { token } = await register(app, "organizer", "o");
    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "T", game: "G" });
    const tid = tRes.body.id as string;

    const res = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        players: [
          { userId: "11111111-1111-4111-8111-111111111111", displayName: "Only" },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("returns single-elimination bracket with ceil(log2(n)) rounds", async () => {
    const app = createApp();
    const { token } = await register(app, "organizer", "o");
    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "T", game: "G" });
    const tid = tRes.body.id as string;

    const players = [
      { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", displayName: "Alice" },
      { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", displayName: "Bob" },
      { userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", displayName: "Carol" },
      { userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", displayName: "Dan" },
      { userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", displayName: "Eve" },
    ];

    const res = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${token}`)
      .send({ players });

    expect(res.status).toBe(200);
    expect(res.body.roundCount).toBe(ceilLog2(players.length));
    expect(res.body.rounds).toHaveLength(res.body.roundCount);
    for (const round of res.body.rounds) {
      const expectedMatches = 2 ** (res.body.roundCount - round.round);
      expect(round.matches).toHaveLength(expectedMatches);
    }
  });

  it("is deterministic for identical player inputs (any request order)", async () => {
    const app = createApp();
    const { token } = await register(app, "organizer", "o");
    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "T", game: "G" });
    const tid = tRes.body.id as string;

    const playersA = [
      { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", displayName: "Zed" },
      { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", displayName: "Amy" },
      { userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", displayName: "Ben" },
    ];
    const playersB = [...playersA].reverse();

    const r1 = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${token}`)
      .send({ players: playersA });
    const r2 = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${token}`)
      .send({ players: playersB });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body).toEqual(r2.body);
  });

  it("returns 403 when a player tries to generate a bracket", async () => {
    const app = createApp();
    const { token: orgToken } = await register(app, "organizer", "o");
    const { token: pToken } = await register(app, "player", "p1");

    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ name: "T", game: "G" });
    const tid = tRes.body.id as string;

    const res = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${pToken}`)
      .send({
        players: [
          { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", displayName: "A" },
          { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", displayName: "B" },
        ],
      });
    expect(res.status).toBe(403);
  });

  it("builds bracket from registrations when body omits players", async () => {
    const app = createApp();
    const { token: orgToken } = await register(app, "organizer", "o");
    const { token: p1 } = await register(app, "player", "p1");
    const { token: p2 } = await register(app, "player", "p2");

    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ name: "Locals", game: "Tekken 8" });
    const tid = tRes.body.id as string;

    const r1 = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${p1}`)
      .send({ displayName: "player p1", gameSelection: "Tekken 8" });
    const r2 = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${p2}`)
      .send({ displayName: "player p2", gameSelection: "Tekken 8" });

    // US11: check in both players and close the window before bracket gen
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${r1.body.userId}`)
      .set("Authorization", `Bearer ${orgToken}`);
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/${r2.body.userId}`)
      .set("Authorization", `Bearer ${orgToken}`);
    await request(app)
      .post(`/api/tournaments/${tid}/checkin/close`)
      .set("Authorization", `Bearer ${orgToken}`);

    const res = await request(app)
      .post(`/api/tournaments/${tid}/bracket`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.playerCount).toBe(2);
    expect(res.body.roundCount).toBe(1);
  });
});

/* ================================================================== */
/*  Player Registration – POST /api/tournaments/:id/register          */
/* ================================================================== */
describe("POST /api/tournaments/:id/register", () => {
  async function createTournamentAsOrg(
    app: ReturnType<typeof createApp>,
    opts?: { maxEntrants?: number }
  ) {
    const { token } = await register(app, "organizer", "org");
    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Weekly", game: "Street Fighter 6", ...opts });
    return { orgToken: token, tid: tRes.body.id as string };
  }

  it("returns 201 and a registration record on valid registration", async () => {
    const app = createApp();
    const { tid } = await createTournamentAsOrg(app);
    const { token } = await register(app, "player", "p1");

    const res = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "SonicFox", gameSelection: "Street Fighter 6" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      tournamentId: tid,
      displayName: "SonicFox",
      gameSelection: "Street Fighter 6",
    });
    expect(typeof res.body.userId).toBe("string");
    expect(typeof res.body.registeredAt).toBe("string");
  });

  it("returns 409 on duplicate registration for the same user and tournament", async () => {
    const app = createApp();
    const { tid } = await createTournamentAsOrg(app);
    const { token } = await register(app, "player", "p1");

    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "MKLeo", gameSelection: "Street Fighter 6" });

    const dup = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "MKLeo", gameSelection: "Street Fighter 6" });
    expect(dup.status).toBe(409);
  });

  it("returns 400 when required fields (displayName, gameSelection) are missing", async () => {
    const app = createApp();
    const { tid } = await createTournamentAsOrg(app);
    const { token } = await register(app, "player", "p1");

    // No body at all
    const r1 = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(r1.status).toBe(400);

    // Missing gameSelection
    const r2 = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "Test" });
    expect(r2.status).toBe(400);

    // Missing displayName
    const r3 = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${token}`)
      .send({ gameSelection: "Tekken 8" });
    expect(r3.status).toBe(400);
  });

  it("increments registered player count after each registration", async () => {
    const app = createApp();
    const { tid } = await createTournamentAsOrg(app);
    const { token: t1 } = await register(app, "player", "p1");
    const { token: t2 } = await register(app, "player", "p2");

    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${t1}`)
      .send({ displayName: "Player1", gameSelection: "SF6" });

    let detail = await request(app).get(`/api/tournaments/${tid}`);
    expect(detail.body.entrantCount).toBe(1);

    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${t2}`)
      .send({ displayName: "Player2", gameSelection: "SF6" });

    detail = await request(app).get(`/api/tournaments/${tid}`);
    expect(detail.body.entrantCount).toBe(2);
  });

  it("returns 401 without auth token", async () => {
    const app = createApp();
    const { tid } = await createTournamentAsOrg(app);

    const res = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .send({ displayName: "Anon", gameSelection: "SF6" });

    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-existent tournament", async () => {
    const app = createApp();
    const { token } = await register(app, "player", "p1");

    const res = await request(app)
      .post("/api/tournaments/does-not-exist/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "X", gameSelection: "Y" });

    expect(res.status).toBe(404);
  });

  it("returns 403 when registration is closed", async () => {
    const app = createApp();
    const { orgToken, tid } = await createTournamentAsOrg(app);
    const { token } = await register(app, "player", "p1");

    // Organizer closes registration
    await request(app)
      .patch(`/api/tournaments/${tid}`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ registrationOpen: false });

    const res = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "Late", gameSelection: "SF6" });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("closed");
  });

  it("returns 403 when tournament is full", async () => {
    const app = createApp();
    const { tid } = await createTournamentAsOrg(app, { maxEntrants: 2 });
    const { token: t1 } = await register(app, "player", "p1");
    const { token: t2 } = await register(app, "player", "p2");
    const { token: t3 } = await register(app, "player", "p3");

    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${t1}`)
      .send({ displayName: "P1", gameSelection: "SF6" });
    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${t2}`)
      .send({ displayName: "P2", gameSelection: "SF6" });

    const res = await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${t3}`)
      .send({ displayName: "P3", gameSelection: "SF6" });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("full");
  });
});

describe("POST /api/users", () => {
  it("creates a player profile with required fields and returns 201", async () => {
    const app = createApp();
    const res = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre Miller",
      games: ["Street Fighter 6", "Tekken 8"],
      region: "Pittsburgh",
    });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({
      username: "andre",
      email: "andre@test.local",
      displayName: "Andre Miller",
      games: ["Street Fighter 6", "Tekken 8"],
      region: "Pittsburgh",
      role: "player",
    });
    expect(typeof res.body.user.id).toBe("string");
  });

  it("returns 400 when required profile fields are missing", async () => {
    const app = createApp();
    const res = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when games array is empty", async () => {
    const app = createApp();
    const res = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre Miller",
      games: [],
      region: "Pittsburgh",
    });

    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate email (case-insensitive)", async () => {
    const app = createApp();
    await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre Miller",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });

    const dup = await request(app).post("/api/users").send({
      username: "andre-two",
      email: "Andre@Test.Local",
      password: "password123",
      displayName: "Andre Two",
      games: ["Tekken 8"],
      region: "Western PA",
    });

    expect(dup.status).toBe(409);
  });

  it("returns 409 for duplicate username (case-insensitive)", async () => {
    const app = createApp();
    await request(app).post("/api/users").send({
      username: "AndRe",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre Miller",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });

    const dup = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre-two@test.local",
      password: "password123",
      displayName: "Andre Two",
      games: ["Tekken 8"],
      region: "Western PA",
    });

    expect(dup.status).toBe(409);
  });
});

/* ================================================================== */
/*  Entrant List – GET /api/tournaments/:id/entrants                  */
/* ================================================================== */
describe("GET /api/tournaments/:id/entrants", () => {
  it("returns an accurate, ordered list of all registered players", async () => {
    const app = createApp();
    const { token: orgToken } = await register(app, "organizer", "org");
    const tRes = await request(app)
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ name: "Locals", game: "GGST" });
    const tid = tRes.body.id as string;

    const { token: t1 } = await register(app, "player", "p1");
    const { token: t2 } = await register(app, "player", "p2");
    const { token: t3 } = await register(app, "player", "p3");

    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${t1}`)
      .send({ displayName: "Alice", gameSelection: "GGST" });
    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${t2}`)
      .send({ displayName: "Bob", gameSelection: "GGST" });
    await request(app)
      .post(`/api/tournaments/${tid}/register`)
      .set("Authorization", `Bearer ${t3}`)
      .send({ displayName: "Carol", gameSelection: "GGST" });

    const res = await request(app).get(`/api/tournaments/${tid}/entrants`);

    expect(res.status).toBe(200);
    expect(res.body.tournamentId).toBe(tid);
    expect(res.body.count).toBe(3);
    expect(res.body.entrants).toHaveLength(3);
    // Verify order is by registration time
    const times = res.body.entrants.map((e: { registeredAt: string }) =>
      new Date(e.registeredAt).getTime()
    );
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }
    // Verify names match
    expect(res.body.entrants.map((e: { displayName: string }) => e.displayName)).toEqual([
      "Alice",
      "Bob",
      "Carol",
    ]);
  });

  it("returns 404 for a non-existent tournament", async () => {
    const app = createApp();
    const res = await request(app).get("/api/tournaments/fake-id/entrants");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/users/:id", () => {
  it("returns public profile without requiring authentication", async () => {
    const app = createApp();
    const created = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre Miller",
      games: ["Street Fighter 6", "Tekken 8"],
      region: "Pittsburgh",
    });

    const id = created.body.user.id as string;
    const res = await request(app).get(`/api/users/${id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      username: "andre",
      displayName: "Andre Miller",
      games: ["Street Fighter 6", "Tekken 8"],
      region: "Pittsburgh",
      role: "player",
    });
    expect(res.body.email).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("returns 404 for non-existent ids", async () => {
    const app = createApp();
    const res = await request(app).get("/api/users/00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/users/:id", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/api/users/00000000-0000-4000-8000-000000000000")
      .send({ displayName: "New Name" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when updating another user profile", async () => {
    const app = createApp();
    const owner = await request(app).post("/api/users").send({
      username: "owner",
      email: "owner@test.local",
      password: "password123",
      displayName: "Owner",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });
    const other = await request(app).post("/api/users").send({
      username: "other",
      email: "other@test.local",
      password: "password123",
      displayName: "Other",
      games: ["Tekken 8"],
      region: "Western PA",
    });

    const res = await request(app)
      .patch(`/api/users/${other.body.user.id as string}`)
      .set("Authorization", `Bearer ${owner.body.token as string}`)
      .send({ displayName: "Hacked" });

    expect(res.status).toBe(403);
  });

  it("updates only provided profile fields for the authenticated owner", async () => {
    const app = createApp();
    const created = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre Miller",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });

    const id = created.body.user.id as string;
    const token = created.body.token as string;
    const res = await request(app)
      .patch(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        games: ["Street Fighter 6", "2XKO"],
        region: "Western PA",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      username: "andre",
      displayName: "Andre Miller",
      games: ["Street Fighter 6", "2XKO"],
      region: "Western PA",
      role: "player",
    });
    expect(res.body.email).toBeUndefined();
  });

  it("returns 400 when patch body is empty", async () => {
    const app = createApp();
    const created = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre Miller",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });

    const id = created.body.user.id as string;
    const token = created.body.token as string;
    const res = await request(app)
      .patch(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 409 if updating username to an existing username", async () => {
    const app = createApp();
    const first = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });
    const second = await request(app).post("/api/users").send({
      username: "sam",
      email: "sam@test.local",
      password: "password123",
      displayName: "Sam",
      games: ["Tekken 8"],
      region: "Western PA",
    });

    const res = await request(app)
      .patch(`/api/users/${second.body.user.id as string}`)
      .set("Authorization", `Bearer ${second.body.token as string}`)
      .send({ username: "AnDrE" });

    expect(res.status).toBe(409);
    expect(first.status).toBe(201);
  });

  it("returns 400 when attempting to patch email (immutable for MVP)", async () => {
    const app = createApp();
    const created = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });

    const res = await request(app)
      .patch(`/api/users/${created.body.user.id as string}`)
      .set("Authorization", `Bearer ${created.body.token as string}`)
      .send({ email: "new-email@test.local" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/users/:id", () => {
  it("soft-deletes own profile and makes it inaccessible", async () => {
    const app = createApp();
    const created = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });

    const id = created.body.user.id as string;
    const token = created.body.token as string;

    const delRes = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/api/users/${id}`);
    expect(getRes.status).toBe(404);

    const active = await request(app).post("/api/users").send({
      username: "active",
      email: "active@test.local",
      password: "password123",
      displayName: "Active User",
      games: ["Tekken 8"],
      region: "Western PA",
    });

    const patchRes = await request(app)
      .patch(`/api/users/${id}`)
      .set("Authorization", `Bearer ${active.body.token as string}`)
      .send({ region: "Nowhere" });
    expect(patchRes.status).toBe(404);
  });

  it("returns 403 when trying to delete another user", async () => {
    const app = createApp();
    const owner = await request(app).post("/api/users").send({
      username: "owner",
      email: "owner@test.local",
      password: "password123",
      displayName: "Owner",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });
    const other = await request(app).post("/api/users").send({
      username: "other",
      email: "other@test.local",
      password: "password123",
      displayName: "Other",
      games: ["Tekken 8"],
      region: "Western PA",
    });

    const res = await request(app)
      .delete(`/api/users/${other.body.user.id as string}`)
      .set("Authorization", `Bearer ${owner.body.token as string}`);

    expect(res.status).toBe(403);
  });

  it("allows reusing username and email after soft delete", async () => {
    const app = createApp();
    const created = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre",
      games: ["Street Fighter 6"],
      region: "Pittsburgh",
    });

    const id = created.body.user.id as string;
    const token = created.body.token as string;

    const delRes = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(delRes.status).toBe(204);

    const recreated = await request(app).post("/api/users").send({
      username: "andre",
      email: "andre@test.local",
      password: "password123",
      displayName: "Andre Reborn",
      games: ["Tekken 8"],
      region: "Western PA",
    });

    expect(recreated.status).toBe(201);
  });
});
