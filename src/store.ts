import { randomUUID } from "crypto";
import {
  findMatch,
  recordMatchWinner as applyMatchWinner,
  syncBracketDerivedState,
} from "./bracket/bracketState.js";
import type {
  BracketResponse,
  Entrant,
  MatchCallNotification,
  PublicUserProfile,
  Tournament,
  User,
  UserRole,
} from "./types.js";

const users = new Map<string, User>();
const usersByEmail = new Map<string, string>();
const usersByUsername = new Map<string, string>();
const tournaments = new Map<string, Tournament>();
const entrantsByTournament = new Map<string, Entrant[]>();
const bracketsByTournament = new Map<string, BracketResponse>();
const notificationsById = new Map<string, MatchCallNotification>();
const matchReadyNotificationKeys = new Set<string>();

function matchReadyKey(tournamentId: string, matchId: string, playerId: string): string {
  return `${tournamentId}\0${matchId}\0${playerId}`;
}

/**
 * Creates unread match-call notifications for both players when a match becomes ready.
 * Idempotent per (matchId, playerId). Skips users who are not entrants in the tournament.
 * Runs immediately (always within the 2s SLA for this in-memory queue).
 */
export function enqueueMatchReadyNotifications(
  tournamentId: string,
  newlyReadyMatchIds: readonly string[]
): void {
  const bracket = bracketsByTournament.get(tournamentId);
  if (!bracket) return;
  const entrants = getEntrants(tournamentId);
  const entrantIds = new Set(entrants.map((e) => e.userId));

  for (const matchId of newlyReadyMatchIds) {
    const m = findMatch(bracket, matchId);
    if (!m || m.status !== "ready" || !m.player1 || !m.player2) continue;

    for (const player of [m.player1, m.player2]) {
      if (!entrantIds.has(player.userId)) continue;
      const key = matchReadyKey(tournamentId, m.id, player.userId);
      if (matchReadyNotificationKeys.has(key)) continue;
      matchReadyNotificationKeys.add(key);

      const opponent = player.userId === m.player1.userId ? m.player2 : m.player1;
      const n: MatchCallNotification = {
        id: randomUUID(),
        userId: player.userId,
        kind: "match_call",
        tournamentId,
        matchId: m.id,
        round: m.round,
        opponentDisplayName: opponent.displayName,
        stationLabel: m.stationLabel ?? null,
        read: false,
        createdAt: new Date().toISOString(),
      };
      notificationsById.set(n.id, n);
    }
  }
}

export function listUnreadMatchCallNotifications(userId: string): MatchCallNotification[] {
  return [...notificationsById.values()].filter(
    (n) => n.userId === userId && !n.read && n.kind === "match_call"
  );
}

export function getNotificationById(id: string): MatchCallNotification | undefined {
  return notificationsById.get(id);
}

export function markNotificationRead(id: string, ownerUserId: string): "ok" | "not_found" | "forbidden" {
  const n = notificationsById.get(id);
  if (!n) return "not_found";
  if (n.userId !== ownerUserId) return "forbidden";
  n.read = true;
  return "ok";
}

export function reportBracketMatchWinner(
  tournamentId: string,
  matchId: string,
  winnerUserId: string
): { bracket: BracketResponse; newlyReadyMatchIds: string[] } | undefined {
  const bracket = bracketsByTournament.get(tournamentId);
  if (!bracket) return undefined;
  const newlyReady = applyMatchWinner(bracket, matchId, winnerUserId);
  return { bracket, newlyReadyMatchIds: newlyReady };
}

export function setMatchStationLabel(
  tournamentId: string,
  matchId: string,
  stationLabel: string | null
): boolean {
  const bracket = bracketsByTournament.get(tournamentId);
  if (!bracket) return false;
  const m = findMatch(bracket, matchId);
  if (!m) return false;
  m.stationLabel = stationLabel;
  return true;
}

export function createUser(input: {
  username?: string;
  email: string;
  passwordHash: string;
  displayName: string;
  games?: string[];
  region?: string;
  role: UserRole;
}): User {
  const id = randomUUID();
  const username = (input.username ?? input.displayName).trim();
  const user: User = {
    id,
    username,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    displayName: input.displayName,
    games: input.games ?? [],
    region: input.region ?? "",
    role: input.role,
  };
  users.set(id, user);
  usersByEmail.set(user.email, id);
  usersByUsername.set(user.username.toLowerCase(), id);
  return user;
}

export function findUserByEmail(email: string): User | undefined {
  const id = usersByEmail.get(email.toLowerCase());
  const user = id ? users.get(id) : undefined;
  if (!user || user.deletedAt) return undefined;
  return user;
}

export function getUserById(id: string): User | undefined {
  return users.get(id);
}

export function findUserByUsername(username: string): User | undefined {
  const id = usersByUsername.get(username.toLowerCase());
  return id ? users.get(id) : undefined;
}

export function isEmailTaken(email: string): boolean {
  return usersByEmail.has(email.toLowerCase());
}

export function isUsernameTaken(username: string): boolean {
  return usersByUsername.has(username.toLowerCase());
}

export function softDeleteUser(id: string): User | undefined {
  const user = users.get(id);
  if (!user || user.deletedAt) return undefined;

  user.deletedAt = new Date().toISOString();
  usersByEmail.delete(user.email.toLowerCase());
  usersByUsername.delete(user.username.toLowerCase());
  users.set(user.id, user);
  return user;
}

export function updateUserProfile(
  id: string,
  patch: {
    username?: string;
    displayName?: string;
    games?: string[];
    region?: string;
  }
): User | undefined {
  const user = users.get(id);
  if (!user || user.deletedAt) return undefined;

  if (patch.username && patch.username !== user.username) {
    usersByUsername.delete(user.username.toLowerCase());
    user.username = patch.username;
    usersByUsername.set(user.username.toLowerCase(), user.id);
  }
  if (typeof patch.displayName === "string") user.displayName = patch.displayName;
  if (Array.isArray(patch.games)) user.games = [...patch.games];
  if (typeof patch.region === "string") user.region = patch.region;

  users.set(user.id, user);
  return user;
}

export function toPublicUserProfile(user: User): PublicUserProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    games: [...user.games],
    region: user.region,
    role: user.role,
  };
}

export function createTournament(input: {
  name: string;
  game: string;
  organizerId: string;
  maxEntrants?: number | null;
  registrationOpen?: boolean;
}): Tournament {
  const id = randomUUID();
  const tournament: Tournament = {
    id,
    name: input.name,
    game: input.game,
    organizerId: input.organizerId,
    maxEntrants: input.maxEntrants ?? null,
    registrationOpen: input.registrationOpen ?? true,
    createdAt: new Date().toISOString(),
    checkInClosed: false,
  };
  tournaments.set(id, tournament);
  entrantsByTournament.set(id, []);
  return tournament;
}

export function updateTournament(
  id: string,
  updates: Partial<Pick<Tournament, "registrationOpen" | "maxEntrants">>
): Tournament | undefined {
  const t = tournaments.get(id);
  if (!t) return undefined;
  if (updates.registrationOpen !== undefined) t.registrationOpen = updates.registrationOpen;
  if (updates.maxEntrants !== undefined) t.maxEntrants = updates.maxEntrants;
  return t;
}

export function getTournament(id: string): Tournament | undefined {
  return tournaments.get(id);
}

export function listTournaments(): Tournament[] {
  return [...tournaments.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addEntrant(tournamentId: string, entrant: Entrant): void {
  const list = entrantsByTournament.get(tournamentId);
  if (!list) throw new Error("Unknown tournament");
  list.push({ ...entrant, checkedIn: entrant.checkedIn ?? false });
}

export function getEntrants(tournamentId: string): Entrant[] {
  return entrantsByTournament.get(tournamentId) ?? [];
}

export function setEntrantCheckedIn(
  tournamentId: string,
  entrantUserId: string,
  checkedIn: boolean
): Entrant | undefined {
  const list = entrantsByTournament.get(tournamentId);
  if (!list) return undefined;
  const entrant = list.find((e) => e.userId === entrantUserId);
  if (!entrant) return undefined;
  entrant.checkedIn = checkedIn;
  return entrant;
}

export function closeCheckIn(tournamentId: string): Tournament | undefined {
  const t = tournaments.get(tournamentId);
  if (!t) return undefined;
  t.checkInClosed = true;
  return t;
}

export function setTournamentBracket(tournamentId: string, bracket: BracketResponse): void {
  const newlyReady = syncBracketDerivedState(bracket);
  bracketsByTournament.set(tournamentId, bracket);
  enqueueMatchReadyNotifications(tournamentId, newlyReady);
}

export function getTournamentBracket(tournamentId: string): BracketResponse | undefined {
  return bracketsByTournament.get(tournamentId);
}

/** Test helper: reset all in-memory state */
export function __resetStoreForTests(): void {
  users.clear();
  usersByEmail.clear();
  usersByUsername.clear();
  tournaments.clear();
  entrantsByTournament.clear();
  bracketsByTournament.clear();
  notificationsById.clear();
  matchReadyNotificationKeys.clear();
}