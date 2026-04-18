import { randomUUID } from "crypto";
import type {
  BracketResponse,
  Entrant,
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
  bracketsByTournament.set(tournamentId, bracket);
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
}