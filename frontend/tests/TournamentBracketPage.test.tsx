/**
 * Tests for frontend/src/pages/TournamentBracketPage.tsx
 *
 * Covers pure utility functions (exported solely for testability):
 * hashStr, mockScores, winner1Wins, roundLabel, formatEventCode, displayUrl,
 * feederHint, buildSlotDisplays, pickLiveMatchId, nextMatchLabel.
 * Also covers the TournamentBracketPage component: load (API calls),
 * copyUrl / onExport interaction.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  hashStr,
  mockScores,
  winner1Wins,
  roundLabel,
  formatEventCode,
  displayUrl,
  feederHint,
  buildSlotDisplays,
  pickLiveMatchId,
  nextMatchLabel,
  TournamentBracketPage,
} from "../src/pages/TournamentBracketPage";
import { api } from "../src/api";
import type { BracketMatch, BracketResponse } from "../src/api";

vi.mock("../src/api", () => ({
  api: {
    getTournament: vi.fn(),
    getTournamentBracket: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ id: "t-abc" }),
    useOutletContext: () => ({ setCurrentEventTitle: vi.fn() }),
  };
});

// ─── hashStr ─────────────────────────────────────────────────────────────────

describe("hashStr", () => {
  it("returns 0 for an empty string", () => {
    expect(hashStr("")).toBe(0);
  });

  it("is deterministic — same input always returns same hash", () => {
    expect(hashStr("hello")).toBe(hashStr("hello"));
  });

  it("returns different values for different inputs", () => {
    expect(hashStr("match-1")).not.toBe(hashStr("match-2"));
  });

  it("returns a non-negative integer", () => {
    const h = hashStr("some-id");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
});

// ─── mockScores ──────────────────────────────────────────────────────────────

describe("mockScores", () => {
  it("returns a tuple of exactly two numbers", () => {
    const scores = mockScores("match-abc");
    expect(scores).toHaveLength(2);
    expect(typeof scores[0]).toBe("number");
    expect(typeof scores[1]).toBe("number");
  });

  it("both scores are non-negative", () => {
    const [s1, s2] = mockScores("match-xyz");
    expect(s1).toBeGreaterThanOrEqual(0);
    expect(s2).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic — same matchId always returns same scores", () => {
    expect(mockScores("fixed-id")).toEqual(mockScores("fixed-id"));
  });
});

// ─── winner1Wins ─────────────────────────────────────────────────────────────

describe("winner1Wins", () => {
  it("returns a boolean", () => {
    expect(typeof winner1Wins("match-1")).toBe("boolean");
  });

  it("is deterministic — same matchId always returns same result", () => {
    expect(winner1Wins("stable-id")).toBe(winner1Wins("stable-id"));
  });

  it("result equals hashStr(id) % 2 === 0", () => {
    const id = "test-match";
    expect(winner1Wins(id)).toBe(hashStr(id) % 2 === 0);
  });
});

// ─── roundLabel ──────────────────────────────────────────────────────────────

describe("roundLabel", () => {
  it("returns 'Grand finals' for the last round", () => {
    expect(roundLabel(4, 4)).toBe("Grand finals");
    expect(roundLabel(1, 1)).toBe("Grand finals");
  });

  it("returns 'Semi finals' for the second-to-last round when totalRounds >= 2", () => {
    expect(roundLabel(3, 4)).toBe("Semi finals");
    expect(roundLabel(1, 2)).toBe("Semi finals");
  });

  it("returns 'Quarter finals' for the third-to-last round when totalRounds >= 3", () => {
    expect(roundLabel(2, 4)).toBe("Quarter finals");
    expect(roundLabel(1, 3)).toBe("Quarter finals");
  });

  it("returns 'Round N' for earlier rounds", () => {
    expect(roundLabel(1, 4)).toBe("Round 1");
    expect(roundLabel(2, 5)).toBe("Round 2");
  });
});

// ─── formatEventCode ─────────────────────────────────────────────────────────

describe("formatEventCode", () => {
  it("starts with 'MP-'", () => {
    expect(formatEventCode("some-uuid-here")).toMatch(/^MP-/);
  });

  it("includes the current year", () => {
    const year = String(new Date().getFullYear());
    expect(formatEventCode("some-uuid-here")).toContain(year);
  });

  it("matches the pattern MP-YYYY-XXX", () => {
    expect(formatEventCode("abcdef123456")).toMatch(/^MP-\d{4}-[A-Z0-9]{3}$/);
  });

  it("removes dashes from the id when building the compact code", () => {
    // id with dashes — should still produce a valid code without dashes in suffix
    const code = formatEventCode("ab-cd-ef-12-34");
    expect(code).toMatch(/^MP-\d{4}-[A-Z0-9]{3}$/);
  });
});

// ─── displayUrl ──────────────────────────────────────────────────────────────

describe("displayUrl", () => {
  it("returns a URL containing the tournament id", () => {
    expect(displayUrl("my-tournament-id")).toContain("my-tournament-id");
  });

  it("returns a URL ending with /bracket", () => {
    expect(displayUrl("tid")).toMatch(/\/bracket$/);
  });

  it("includes the expected path segment /t/:id/bracket", () => {
    expect(displayUrl("xyz")).toContain("/t/xyz/bracket");
  });
});

// ─── feederHint ──────────────────────────────────────────────────────────────

describe("feederHint", () => {
  it("returns null for round 1 (no feeder matches)", () => {
    expect(feederHint(1, 1, 1)).toBeNull();
    expect(feederHint(1, 3, 2)).toBeNull();
  });

  it("returns a hint string for round 2 with side 1", () => {
    const hint = feederHint(2, 1, 1);
    expect(hint).toBeTruthy();
    expect(hint).toContain("winner");
  });

  it("returns a hint string for round 2 with side 2", () => {
    const hint = feederHint(2, 1, 2);
    expect(hint).toBeTruthy();
    expect(hint).toContain("winner");
  });

  it("computes feeder match number as 2*slot-1 for side 1", () => {
    // slot=2, side=1 → k = 2*2-1 = 3
    expect(feederHint(2, 2, 1)).toContain("Match 3");
  });

  it("computes feeder match number as 2*slot for side 2", () => {
    // slot=2, side=2 → k = 2*2 = 4
    expect(feederHint(2, 2, 2)).toContain("Match 4");
  });
});

// ─── buildSlotDisplays ───────────────────────────────────────────────────────

const p1 = { userId: "u1", displayName: "Alice" };
const p2 = { userId: "u2", displayName: "Bob" };

function makeMatch(overrides: Partial<BracketMatch> = {}): BracketMatch {
  return {
    id: "match-999",
    round: 1,
    slot: 1,
    player1: null,
    player2: null,
    advancesToMatchId: null,
    ...overrides,
  };
}

describe("buildSlotDisplays", () => {
  it("shows 'TBD' for both slots when neither player is set", () => {
    const { top, bottom } = buildSlotDisplays(makeMatch(), 1, 1, null);
    expect(top.name).toBe("TBD");
    expect(bottom.name).toBe("TBD");
  });

  it("shows player names when both players are present", () => {
    const { top, bottom } = buildSlotDisplays(makeMatch({ player1: p1, player2: p2 }), 1, 1, null);
    expect(top.name).toBe("Alice");
    expect(bottom.name).toBe("Bob");
  });

  it("shows scores (not '—') when both players are present", () => {
    const { top, bottom } = buildSlotDisplays(makeMatch({ player1: p1, player2: p2 }), 1, 1, null);
    expect(top.score).not.toBe("—");
    expect(bottom.score).not.toBe("—");
  });

  it("marks the match as live when matchId equals liveMatchId", () => {
    const { top } = buildSlotDisplays(makeMatch({ id: "live-id", player1: p1, player2: p2 }), 1, 1, "live-id");
    expect(top.live).toBe(true);
  });

  it("is not live when liveMatchId is a different id", () => {
    const { top } = buildSlotDisplays(makeMatch({ id: "m1", player1: p1, player2: p2 }), 1, 1, "other-id");
    expect(top.live).toBe(false);
  });

  it("shows 'Bye' at the bottom when only player1 is set", () => {
    const { top, bottom } = buildSlotDisplays(makeMatch({ player1: p1, player2: null }), 1, 1, null);
    expect(top.name).toBe("Alice");
    expect(bottom.name).toBe("Bye");
  });

  it("shows 'Bye' at the top when only player2 is set", () => {
    const { top, bottom } = buildSlotDisplays(makeMatch({ player1: null, player2: p2 }), 1, 1, null);
    expect(top.name).toBe("Bye");
    expect(bottom.name).toBe("Bob");
  });

  it("marks the player with the Bye as winner", () => {
    const { top } = buildSlotDisplays(makeMatch({ player1: p1, player2: null }), 1, 1, null);
    expect(top.winner).toBe(true);
  });
});

// ─── pickLiveMatchId ──────────────────────────────────────────────────────────

function buildBracket(rounds: BracketResponse["rounds"]): BracketResponse {
  return { tournamentId: "t1", playerCount: 2, roundCount: rounds.length, rounds };
}

describe("pickLiveMatchId", () => {
  it("returns null when there are no rounds", () => {
    expect(pickLiveMatchId(buildBracket([]))).toBeNull();
  });

  it("returns null when round 1 has no fully-seeded match", () => {
    const bracket = buildBracket([
      { round: 1, matches: [makeMatch({ id: "m1", player1: p1, player2: null })] },
    ]);
    expect(pickLiveMatchId(bracket)).toBeNull();
  });

  it("returns the id of the first match in round 1 with both players set", () => {
    const bracket = buildBracket([
      { round: 1, matches: [makeMatch({ id: "live-m", player1: p1, player2: p2 })] },
    ]);
    expect(pickLiveMatchId(bracket)).toBe("live-m");
  });

  it("skips incomplete matches and picks the first complete one", () => {
    const bracket = buildBracket([
      {
        round: 1,
        matches: [
          makeMatch({ id: "incomplete", player1: p1, player2: null }),
          makeMatch({ id: "complete", player1: p1, player2: p2 }),
        ],
      },
    ]);
    expect(pickLiveMatchId(bracket)).toBe("complete");
  });
});

// ─── nextMatchLabel ───────────────────────────────────────────────────────────

describe("nextMatchLabel", () => {
  it("returns a warming-up message when liveId is null", () => {
    const bracket = buildBracket([]);
    expect(nextMatchLabel(bracket, null)).toContain("warming up");
  });

  it("returns 'Next match TBD' when liveId is not found in any round", () => {
    const bracket = buildBracket([
      { round: 1, matches: [makeMatch({ id: "m1" })] },
    ]);
    expect(nextMatchLabel(bracket, "nonexistent")).toBe("Next match TBD");
  });

  it("returns 'P1 vs P2' when both players are present in the live match", () => {
    const bracket = buildBracket([
      { round: 1, matches: [makeMatch({ id: "m1", player1: p1, player2: p2 })] },
    ]);
    expect(nextMatchLabel(bracket, "m1")).toBe("Alice vs Bob");
  });
});

// ─── TournamentBracketPage – component integration ───────────────────────────

describe("TournamentBracketPage – component", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading message before data arrives", () => {
    vi.mocked(api.getTournament).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getTournamentBracket).mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <TournamentBracketPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/loading bracket/i)).toBeInTheDocument();
  });

  it("shows 'Bracket not published yet' when bracket is null", async () => {
    vi.mocked(api.getTournament).mockResolvedValue({
      id: "t-abc",
      name: "Test Open",
      game: "CS2",
      entrantCount: 0,
      maxEntrants: null,
      registrationOpen: true,
      createdAt: "2025-01-01",
      entrants: [],
    });
    vi.mocked(api.getTournamentBracket).mockResolvedValue(null);
    render(
      <MemoryRouter>
        <TournamentBracketPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/bracket not published yet/i)).toBeInTheDocument());
  });

  it("renders the tournament title when data loads", async () => {
    vi.mocked(api.getTournament).mockResolvedValue({
      id: "t-abc",
      name: "Apex Masters",
      game: "Apex",
      entrantCount: 2,
      maxEntrants: null,
      registrationOpen: true,
      createdAt: "2025-01-01",
      entrants: [],
    });
    vi.mocked(api.getTournamentBracket).mockResolvedValue({
      tournamentId: "t-abc",
      playerCount: 2,
      roundCount: 1,
      rounds: [{ round: 1, matches: [makeMatch({ id: "m1", player1: p1, player2: p2 })] }],
    });
    render(
      <MemoryRouter>
        <TournamentBracketPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Apex Masters")).toBeInTheDocument());
  });

  it("copies the URL when the COPY button is clicked", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });

    vi.mocked(api.getTournament).mockResolvedValue({
      id: "t-abc", name: "Test", game: "G", entrantCount: 2, maxEntrants: null,
      registrationOpen: true, createdAt: "2025-01-01", entrants: [],
    });
    vi.mocked(api.getTournamentBracket).mockResolvedValue({
      tournamentId: "t-abc", playerCount: 2, roundCount: 1,
      rounds: [{ round: 1, matches: [makeMatch({ id: "m1", player1: p1, player2: p2 })] }],
    });
    render(
      <MemoryRouter>
        <TournamentBracketPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText("COPY"));
    fireEvent.click(screen.getByText("COPY"));
    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalled());
  });
});
