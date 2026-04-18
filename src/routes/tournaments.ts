import { Router } from "express";
import { z } from "zod";
import { BracketProgressError } from "../bracket/bracketState.js";
import { BracketValidationError, buildSingleEliminationBracket } from "../bracket/singleElimination.js";
import type { BracketPlayer } from "../types.js";
import {
  addEntrant,
  closeCheckIn,
  createTournament,
  getEntrants,
  getTournament,
  getTournamentBracket,
  getUserById,
  listTournaments,
  enqueueMatchReadyNotifications,
  reportBracketMatchWinner,
  setEntrantCheckedIn,
  setTournamentBracket,
  updateTournament,
} from "../store.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, requireOrganizer } from "../middleware/auth.js";

const router = Router();

/* ------------------------------------------------------------------ */
/*  GET /api/tournaments – list all tournaments                       */
/* ------------------------------------------------------------------ */
router.get("/", (_req, res) => {
  const items = listTournaments().map((t) => ({
    id: t.id,
    name: t.name,
    game: t.game,
    entrantCount: getEntrants(t.id).length,
    maxEntrants: t.maxEntrants,
    registrationOpen: t.registrationOpen,
    createdAt: t.createdAt,
    checkInClosed: t.checkInClosed,
  }));
  res.json(items);
});

/* ------------------------------------------------------------------ */
/*  POST /api/tournaments – create a tournament (organizer only)      */
/* ------------------------------------------------------------------ */
const createTournamentSchema = z.object({
  name: z.string().min(1).max(200),
  game: z.string().min(1).max(120),
  maxEntrants: z.number().int().min(2).optional(),
});

router.post("/", requireAuth, requireOrganizer, (req: AuthedRequest, res) => {
  const parsed = createTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const tournament = createTournament({
    name: parsed.data.name,
    game: parsed.data.game,
    organizerId: req.userId!,
    maxEntrants: parsed.data.maxEntrants ?? null,
  });
  res.status(201).json({
    id: tournament.id,
    name: tournament.name,
    game: tournament.game,
    maxEntrants: tournament.maxEntrants,
    registrationOpen: tournament.registrationOpen,
  });
});

/* ------------------------------------------------------------------ */
/*  GET /api/tournaments/:id/bracket                                  */
/* ------------------------------------------------------------------ */
router.get("/:id/bracket", (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }
  const bracket = getTournamentBracket(req.params.id);
  if (!bracket) {
    res.status(404).json({ error: "Bracket not available" });
    return;
  }
  res.json(bracket);
});

/* ------------------------------------------------------------------ */
/*  POST /api/tournaments/:id/register – player registration          */
/* ------------------------------------------------------------------ */
const registerSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  gameSelection: z.string().min(1, "Game selection is required"),
});

router.post("/:id/register", requireAuth, (req: AuthedRequest, res) => {
  /* --- Validate required body fields -------------------------------- */
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  /* --- Tournament must exist ---------------------------------------- */
  const tournament = getTournament(req.params.id);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  /* --- Auth user must exist ----------------------------------------- */
  const user = getUserById(req.userId!);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  /* --- Registration must be open ------------------------------------ */
  if (!tournament.registrationOpen) {
    res.status(403).json({ error: "Registration is closed for this tournament" });
    return;
  }

  /* --- Capacity check ----------------------------------------------- */
  const currentEntrants = getEntrants(tournament.id);
  if (tournament.maxEntrants !== null && currentEntrants.length >= tournament.maxEntrants) {
    res.status(403).json({ error: "Registration is full. No more spots are available." });
    return;
  }

  /* --- Duplicate check ---------------------------------------------- */
  const existing = currentEntrants.some((e) => e.userId === user.id);
  if (existing) {
    res.status(409).json({ error: "Already registered for this tournament" });
    return;
  }

  /* --- Create registration ------------------------------------------ */
  const entrant = {
    userId: user.id,
    displayName: parsed.data.displayName,
    gameSelection: parsed.data.gameSelection,
    registeredAt: new Date().toISOString(),
    checkedIn: false,
  };
  addEntrant(tournament.id, entrant);

  res.status(201).json({
    tournamentId: tournament.id,
    userId: user.id,
    displayName: entrant.displayName,
    gameSelection: entrant.gameSelection,
    registeredAt: entrant.registeredAt,
  });
});

/* ------------------------------------------------------------------ */
/*  GET /api/tournaments/:id/entrants – ordered entrant list          */
/* ------------------------------------------------------------------ */
router.get("/:id/entrants", (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }
  const entrants = getEntrants(tournament.id)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()
    )
    .map((e) => ({
      userId: e.userId,
      displayName: e.displayName,
      gameSelection: e.gameSelection,
      registeredAt: e.registeredAt,
      checkedIn: e.checkedIn,
    }));
  res.json({ tournamentId: tournament.id, count: entrants.length, entrants });
});

/* ------------------------------------------------------------------ */
/*  POST /api/tournaments/:id/checkin/close – close check-in window    */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/checkin/close",
  requireAuth,
  requireOrganizer,
  (req: AuthedRequest, res) => {
    const tournament = getTournament(req.params.id);
    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }
    if (tournament.checkInClosed) {
      res.status(409).json({ error: "Check-in is already closed" });
      return;
    }
    const updated = closeCheckIn(tournament.id);
    res.status(200).json({
      id: updated!.id,
      name: updated!.name,
      game: updated!.game,
      maxEntrants: updated!.maxEntrants,
      registrationOpen: updated!.registrationOpen,
      checkInClosed: updated!.checkInClosed,
    });
  }
);

/* ------------------------------------------------------------------ */
/*  POST /api/tournaments/:id/checkin/:entrantId – mark present       */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/checkin/:entrantId",
  requireAuth,
  requireOrganizer,
  (req: AuthedRequest, res) => {
    const tournament = getTournament(req.params.id);
    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }
    if (tournament.checkInClosed) {
      res.status(409).json({ error: "Check-in is closed for this tournament" });
      return;
    }
    const entrant = setEntrantCheckedIn(tournament.id, req.params.entrantId, true);
    if (!entrant) {
      res.status(404).json({ error: "Entrant not found" });
      return;
    }
    res.status(200).json({
      userId: entrant.userId,
      displayName: entrant.displayName,
      gameSelection: entrant.gameSelection,
      registeredAt: entrant.registeredAt,
      checkedIn: entrant.checkedIn,
    });
  }
);

/* ------------------------------------------------------------------ */
/*  DELETE /api/tournaments/:id/checkin/:entrantId – reverse check-in */
/* ------------------------------------------------------------------ */
router.delete(
  "/:id/checkin/:entrantId",
  requireAuth,
  requireOrganizer,
  (req: AuthedRequest, res) => {
    const tournament = getTournament(req.params.id);
    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }
    if (tournament.checkInClosed) {
      res.status(409).json({ error: "Check-in is closed for this tournament" });
      return;
    }
    const entrant = setEntrantCheckedIn(tournament.id, req.params.entrantId, false);
    if (!entrant) {
      res.status(404).json({ error: "Entrant not found" });
      return;
    }
    res.status(200).json({
      userId: entrant.userId,
      displayName: entrant.displayName,
      gameSelection: entrant.gameSelection,
      registeredAt: entrant.registeredAt,
      checkedIn: entrant.checkedIn,
    });
  }
);

/* ------------------------------------------------------------------ */
/*  PATCH /api/tournaments/:id – update registration status           */
/* ------------------------------------------------------------------ */
const patchTournamentSchema = z.object({
  registrationOpen: z.boolean().optional(),
  maxEntrants: z.number().int().min(2).nullable().optional(),
});

router.patch("/:id", requireAuth, requireOrganizer, (req: AuthedRequest, res) => {
  const parsed = patchTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const tournament = updateTournament(req.params.id, parsed.data);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }
  res.json({
    id: tournament.id,
    name: tournament.name,
    game: tournament.game,
    maxEntrants: tournament.maxEntrants,
    registrationOpen: tournament.registrationOpen,
  });
});

/* ------------------------------------------------------------------ */
/*  POST /api/tournaments/:id/bracket – generate bracket              */
/* ------------------------------------------------------------------ */
const bracketBodySchema = z
  .object({
    players: z
      .array(
        z.object({
          userId: z.string().uuid(),
          displayName: z.string().min(1),
        })
      )
      .optional(),
  })
  .optional();

const reportWinnerSchema = z.object({
  winnerUserId: z.string().uuid(),
});

router.post(
  "/:id/matches/:matchId/winner",
  requireAuth,
  requireOrganizer,
  (req: AuthedRequest, res) => {
    const parsed = reportWinnerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const tournament = getTournament(req.params.id);
    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }
    try {
      const outcome = reportBracketMatchWinner(
        req.params.id,
        req.params.matchId,
        parsed.data.winnerUserId
      );
      if (!outcome) {
        res.status(404).json({ error: "Bracket not found" });
        return;
      }
      enqueueMatchReadyNotifications(req.params.id, outcome.newlyReadyMatchIds);
      res.status(200).json({ bracket: outcome.bracket });
    } catch (e) {
      if (e instanceof BracketProgressError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }
);

router.post("/:id/bracket", requireAuth, requireOrganizer, (req: AuthedRequest, res) => {
  const parsed = bracketBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const tournament = getTournament(req.params.id);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  let players: BracketPlayer[];
  if (parsed.data?.players?.length) {
    players = parsed.data.players;
  } else {
    if (!tournament.checkInClosed) {
      res
        .status(409)
        .json({ error: "Check-in must be closed before generating the bracket" });
      return;
    }
    players = getEntrants(tournament.id)
      .filter((e) => e.checkedIn)
      .map((e) => ({
        userId: e.userId,
        displayName: e.displayName,
      }));
  }

  try {
    const bracket = buildSingleEliminationBracket(tournament.id, players);
    setTournamentBracket(tournament.id, bracket);
    res.status(200).json(bracket);
  } catch (e) {
    if (e instanceof BracketValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});


router.get("/:id", (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }
  const entrants = getEntrants(tournament.id).map((e) => ({
    userId: e.userId,
    displayName: e.displayName,
    gameSelection: e.gameSelection,
    registeredAt: e.registeredAt,
    checkedIn: e.checkedIn,
  }));
  res.json({
    id: tournament.id,
    name: tournament.name,
    game: tournament.game,
    maxEntrants: tournament.maxEntrants,
    registrationOpen: tournament.registrationOpen,
    entrantCount: entrants.length,
    createdAt: tournament.createdAt,
    checkInClosed: tournament.checkInClosed,
    entrants,
  });
});

export default router;