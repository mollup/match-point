import type { BracketMatch, BracketPlayer, BracketResponse, BracketRound } from "../types.js";

function ceilLog2(n: number): number {
  if (n <= 1) return 0;
  return Math.ceil(Math.log2(n));
}

/** Stable ordering: same inputs always produce the same seed order. */
export function sortPlayersForSeeding(players: BracketPlayer[]): BracketPlayer[] {
  return [...players].sort((a, b) => {
    const nameCmp = a.displayName.localeCompare(b.displayName, "en");
    if (nameCmp !== 0) return nameCmp;
    return a.userId.localeCompare(b.userId, "en");
  });
}

/**
 * Single elimination: ⌈log₂(n)⌉ rounds for n ≥ 2.
 * Seeds 1..N (power of two); players occupy seeds 1..n after sorting, seeds n+1..N are byes.
 * First round pairs seed i with seed N−i+1 (standard favorite vs underdog pairing).
 */
export function buildSingleEliminationBracket(
  tournamentId: string,
  players: BracketPlayer[]
): BracketResponse {
  if (players.length < 2) {
    throw new BracketValidationError("At least two players are required to generate a bracket.");
  }

  const sorted = sortPlayersForSeeding(players);
  const n = sorted.length;
  const roundCount = ceilLog2(n);
  const bracketSize = 2 ** roundCount;

  /** seed index 0..bracketSize-1 → player or null (bye) */
  const bySeed: (BracketPlayer | null)[] = new Array(bracketSize).fill(null);
  for (let i = 0; i < n; i++) {
    bySeed[i] = sorted[i]!;
  }

  const rounds: BracketRound[] = [];

  for (let r = 1; r <= roundCount; r++) {
    const matchCount = bracketSize / 2 ** r;
    const matches: BracketMatch[] = [];

    if (r === 1) {
      for (let m = 0; m < matchCount; m++) {
        const seedLow = m + 1;
        const seedHigh = bracketSize - m;
        const p1 = bySeed[seedLow - 1] ?? null;
        const p2 = bySeed[seedHigh - 1] ?? null;
        matches.push({
          id: `r${r}-m${m + 1}`,
          round: r,
          slot: m + 1,
          player1: p1,
          player2: p2,
          advancesToMatchId: r < roundCount ? `r${r + 1}-m${Math.floor(m / 2) + 1}` : null,
          status: "pending",
          winnerUserId: null,
          stationLabel: null,
        });
      }
    } else {
      const prev = rounds[r - 2]!.matches;
      for (let m = 0; m < matchCount; m++) {
        const left = prev[m * 2]!;
        const right = prev[m * 2 + 1]!;
        const p1 = resolveAdvance(left);
        const p2 = resolveAdvance(right);
        matches.push({
          id: `r${r}-m${m + 1}`,
          round: r,
          slot: m + 1,
          player1: p1,
          player2: p2,
          advancesToMatchId: r < roundCount ? `r${r + 1}-m${Math.floor(m / 2) + 1}` : null,
          status: "pending",
          winnerUserId: null,
          stationLabel: null,
        });
      }
    }

    rounds.push({ round: r, matches });
  }

  return {
    tournamentId,
    playerCount: n,
    roundCount,
    rounds,
  };
}

function resolveAdvance(prev: BracketMatch): BracketPlayer | null {
  const { player1, player2 } = prev;
  if (player1 && !player2) return player1;
  if (!player1 && player2) return player2;
  if (player1 && player2) return null;
  return null;
}

export class BracketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BracketValidationError";
  }
}
