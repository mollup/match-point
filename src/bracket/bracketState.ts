import type { BracketMatch, BracketPlayer, BracketResponse } from "../types.js";

/** Advancement from a feeder match into the next round (byes + recorded winners). */
export function resolveAdvanceFromMatch(prev: BracketMatch): BracketPlayer | null {
  if (prev.status === "complete" && prev.winnerUserId) {
    const w = prev.winnerUserId;
    if (prev.player1?.userId === w) return prev.player1;
    if (prev.player2?.userId === w) return prev.player2;
  }
  const { player1, player2 } = prev;
  if (player1 && !player2) return player1;
  if (!player1 && player2) return player2;
  if (player1 && player2) return null;
  return null;
}

function ensureMatchDefaults(m: BracketMatch): void {
  if (!m.status) m.status = "pending";
  if (m.winnerUserId === undefined) m.winnerUserId = null;
  if (m.stationLabel === undefined) m.stationLabel = null;
}

/** Auto-complete bye-only first-round matches so later rounds can fill. */
export function normalizeByeMatchesInRound1(bracket: BracketResponse): void {
  const r1 = bracket.rounds[0]?.matches;
  if (!r1) return;
  for (const m of r1) {
    ensureMatchDefaults(m);
    if (m.status === "complete") continue;
    if (m.player1 && !m.player2) {
      m.winnerUserId = m.player1.userId;
      m.status = "complete";
    } else if (!m.player1 && m.player2) {
      m.winnerUserId = m.player2.userId;
      m.status = "complete";
    }
  }
}

function snapshotStatuses(bracket: BracketResponse): Map<string, BracketMatch["status"]> {
  const map = new Map<string, BracketMatch["status"]>();
  for (const r of bracket.rounds) {
    for (const m of r.matches) {
      ensureMatchDefaults(m);
      map.set(m.id, m.status);
    }
  }
  return map;
}

/** Recompute derived players (round 2+) and statuses for every match. */
export function syncBracketDerivedState(bracket: BracketResponse): string[] {
  for (const r of bracket.rounds) {
    for (const m of r.matches) ensureMatchDefaults(m);
  }

  normalizeByeMatchesInRound1(bracket);

  const prevStatuses = snapshotStatuses(bracket);

  for (let ri = 1; ri < bracket.rounds.length; ri++) {
    const prevRound = bracket.rounds[ri - 1]!.matches;
    const round = bracket.rounds[ri]!.matches;
    for (let m = 0; m < round.length; m++) {
      const left = prevRound[m * 2]!;
      const right = prevRound[m * 2 + 1]!;
      const match = round[m]!;
      match.player1 = resolveAdvanceFromMatch(left);
      match.player2 = resolveAdvanceFromMatch(right);
    }
  }

  const newlyReady: string[] = [];
  for (const r of bracket.rounds) {
    for (const m of r.matches) {
      if (m.winnerUserId) {
        m.status = "complete";
      } else if (m.player1 && m.player2) {
        m.status = "ready";
      } else {
        m.status = "pending";
      }
      if (m.status === "ready" && prevStatuses.get(m.id) !== "ready") {
        newlyReady.push(m.id);
      }
    }
  }

  return newlyReady;
}

export function findMatch(bracket: BracketResponse, matchId: string): BracketMatch | undefined {
  for (const r of bracket.rounds) {
    const m = r.matches.find((x) => x.id === matchId);
    if (m) return m;
  }
  return undefined;
}

/**
 * Record a winner for a playable match (both players present), then resync the bracket.
 * Returns updated match ids that newly entered `ready`, or throws on invalid input.
 */
export function recordMatchWinner(
  bracket: BracketResponse,
  matchId: string,
  winnerUserId: string
): string[] {
  const match = findMatch(bracket, matchId);
  if (!match) {
    throw new BracketProgressError("Match not found");
  }
  ensureMatchDefaults(match);
  if (!match.player1 || !match.player2) {
    throw new BracketProgressError("Match is not playable yet");
  }
  if (match.status === "complete") {
    throw new BracketProgressError("Match is already complete");
  }
  if (winnerUserId !== match.player1.userId && winnerUserId !== match.player2.userId) {
    throw new BracketProgressError("Winner must be one of the players in this match");
  }
  match.winnerUserId = winnerUserId;
  match.status = "complete";
  return syncBracketDerivedState(bracket);
}

export class BracketProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BracketProgressError";
  }
}
