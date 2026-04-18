export type UserRole = "organizer" | "player";

export interface UserProfile {
  id: string;
  username?: string;
  displayName: string;
  games: string[];
  region?: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface TournamentSummary {
  id: string;
  name: string;
  game: string;
  entrantCount: number;
  maxEntrants: number | null;
  registrationOpen: boolean;
  createdAt: string;
  checkInClosed: boolean;
}

export interface EntrantRecord {
  userId: string;
  displayName: string;
  gameSelection: string;
  registeredAt: string;
  checkedIn: boolean;
}

export interface TournamentDetail extends TournamentSummary {
  entrants: EntrantRecord[];
}

export interface BracketPlayer {
  userId: string;
  displayName: string;
}

export type BracketMatchStatus = "pending" | "ready" | "complete";

export interface BracketMatch {
  id: string;
  round: number;
  slot: number;
  player1: BracketPlayer | null;
  player2: BracketPlayer | null;
  advancesToMatchId: string | null;
  status: BracketMatchStatus;
  winnerUserId: string | null;
  stationLabel?: string | null;
}

export interface MatchCallNotificationDTO {
  id: string;
  tournamentId: string;
  matchId: string;
  round: number;
  opponentDisplayName: string;
  stationLabel: string | null;
  createdAt: string;
}

export interface BracketRound {
  round: number;
  matches: BracketMatch[];
}

export interface BracketResponse {
  tournamentId: string;
  playerCount: number;
  roundCount: number;
  rounds: BracketRound[];
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

function getStoredToken(): string | null {
  return localStorage.getItem("mp_token");
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem("mp_token", token);
  else localStorage.removeItem("mp_token");
}

function errorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error: unknown }).error;
    if (typeof e === "string") return e;
    return "Validation failed";
  }
  return `Request failed (${status})`;
}

type ApiInit = RequestInit & { auth?: boolean };

async function request<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const sendAuth = init.auth !== false;
  const token = sendAuth ? getStoredToken() : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || res.statusText);
  }

  if (!res.ok) {
    throw new Error(errorMessage(data, res.status));
  }
  return data as T;
}

export const api = {
  register(body: {
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
  }): Promise<{ token: string; user: AuthUser }> {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      headers: jsonHeaders,
      auth: false,
    });
  },

  login(body: { email: string; password: string }): Promise<{ token: string; user: AuthUser }> {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
      headers: jsonHeaders,
      auth: false,
    });
  },

  listTournaments(): Promise<TournamentSummary[]> {
    return request("/api/tournaments", { auth: false });
  },

  getTournament(id: string): Promise<TournamentDetail> {
    return request(`/api/tournaments/${id}`, { auth: false });
  },

  createTournament(body: { name: string; game: string }): Promise<{ id: string; name: string; game: string }> {
    return request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify(body),
      headers: jsonHeaders,
    });
  },

  registerForTournament(
    tournamentId: string,
    body: { displayName: string; gameSelection: string }
  ): Promise<{
    tournamentId: string;
    userId: string;
    displayName: string;
    gameSelection: string;
    registeredAt: string;
  }> {
    return request(`/api/tournaments/${tournamentId}/register`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: jsonHeaders,
    });
  },

  getEntrants(
    tournamentId: string
  ): Promise<{
    tournamentId: string;
    count: number;
    entrants: EntrantRecord[];
  }> {
    return request(`/api/tournaments/${tournamentId}/entrants`, { auth: false });
  },

  checkInEntrant(tournamentId: string, entrantId: string): Promise<EntrantRecord> {
    return request(`/api/tournaments/${tournamentId}/checkin/${entrantId}`, {
      method: "POST",
      headers: jsonHeaders,
    });
  },

  uncheckInEntrant(tournamentId: string, entrantId: string): Promise<EntrantRecord> {
    return request(`/api/tournaments/${tournamentId}/checkin/${entrantId}`, {
      method: "DELETE",
    });
  },

  closeCheckIn(
    tournamentId: string
  ): Promise<{
    id: string;
    name: string;
    game: string;
    maxEntrants: number | null;
    registrationOpen: boolean;
    checkInClosed: boolean;
  }> {
    return request(`/api/tournaments/${tournamentId}/checkin/close`, {
      method: "POST",
      headers: jsonHeaders,
    });
  },

  generateBracket(tournamentId: string): Promise<BracketResponse> {
    return request(`/api/tournaments/${tournamentId}/bracket`, {
      method: "POST",
      body: "{}",
      headers: jsonHeaders,
    });
  },

  /** Public: returns null if bracket has not been published yet. */
  async getTournamentBracket(tournamentId: string): Promise<BracketResponse | null> {
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket`);
    if (res.status === 404) return null;
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error("Invalid response");
    }
    if (!res.ok) {
      throw new Error(errorMessage(data, res.status));
    }
    return data as BracketResponse;
  },

  getUser(id: string): Promise<UserProfile> {
    return request(`/api/users/${id}`, { auth: false });
  },

  patchUser(
    id: string,
    body: { displayName?: string; games?: string[]; region?: string }
  ): Promise<UserProfile> {
    return request(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: jsonHeaders,
    });
  },

  getMatchCallNotifications(userId: string): Promise<MatchCallNotificationDTO[]> {
    return request(`/api/users/${userId}/notifications`, { headers: jsonHeaders });
  },

  ackMatchCallNotification(notificationId: string): Promise<{ ok: boolean }> {
    return request(`/api/notifications/${notificationId}/ack`, {
      method: "POST",
      headers: jsonHeaders,
    });
  },
};
