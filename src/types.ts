export type UserRole = "organizer" | "player";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  games: string[];
  region: string;
  deletedAt?: string;
  role: UserRole;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string;
  games: string[];
  region: string;
  role: UserRole;
}

export interface Tournament {
  id: string;
  name: string;
  game: string;
  organizerId: string;
  maxEntrants: number | null;
  registrationOpen: boolean;
  createdAt: string;
  checkInClosed: boolean;
}

export interface Entrant {
  userId: string;
  displayName: string;
  gameSelection: string;
  registeredAt: string;
  checkedIn: boolean;
}

export interface BracketPlayer {
  userId: string;
  displayName: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  slot: number;
  player1: BracketPlayer | null;
  player2: BracketPlayer | null;
  /** Winner advances to this match id in the next round, if any */
  advancesToMatchId: string | null;
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