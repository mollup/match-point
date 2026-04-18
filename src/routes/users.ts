import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signToken } from "../auth/token.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createUser,
  getUserById,
  isEmailTaken,
  isUsernameTaken,
  listUnreadMatchCallNotifications,
  softDeleteUser,
  toPublicUserProfile,
  updateUserProfile,
} from "../store.js";

const router = Router();

const createUserSchema = z.object({
  username: z.string().trim().min(1).max(40),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(1).max(120),
  games: z.array(z.string().trim().min(1).max(120)).min(1),
  region: z.string().trim().min(1).max(120),
  role: z.enum(["organizer", "player"]).default("player"),
});

router.post("/", (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { username, email, password, displayName, games, region, role } = parsed.data;

  if (isEmailTaken(email)) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  if (isUsernameTaken(username)) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const user = createUser({
    username,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    displayName,
    games,
    region,
    role,
  });

  const token = signToken({ sub: user.id, role: user.role });
  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      games: user.games,
      region: user.region,
      role: user.role,
    },
  });
});

router.get("/:id/notifications", requireAuth, (req: AuthedRequest, res) => {
  if (req.userId !== req.params.id) {
    res.status(403).json({ error: "You can only read your own notifications" });
    return;
  }
  const items = listUnreadMatchCallNotifications(req.userId).map((n) => ({
    id: n.id,
    tournamentId: n.tournamentId,
    matchId: n.matchId,
    round: n.round,
    opponentDisplayName: n.opponentDisplayName,
    stationLabel: n.stationLabel,
    createdAt: n.createdAt,
  }));
  res.status(200).json(items);
});

router.get("/:id", (req, res) => {
  const user = getUserById(req.params.id);
  if (!user || user.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toPublicUserProfile(user));
});

const patchSchema = z
  .object({
    username: z.string().trim().min(1).max(40).optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    games: z.array(z.string().trim().min(1).max(120)).min(1).optional(),
    region: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

router.patch("/:id", requireAuth, (req: AuthedRequest, res) => {
  const user = getUserById(req.params.id);
  if (!user || user.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (req.userId !== user.id) {
    res.status(403).json({ error: "You can only edit your own profile" });
    return;
  }

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  if (parsed.data.username && parsed.data.username.toLowerCase() !== user.username.toLowerCase()) {
    if (isUsernameTaken(parsed.data.username)) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
  }

  const updated = updateUserProfile(user.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(toPublicUserProfile(updated));
});

router.delete("/:id", requireAuth, (req: AuthedRequest, res) => {
  const user = getUserById(req.params.id);
  if (!user || user.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (req.userId !== user.id) {
    res.status(403).json({ error: "You can only delete your own profile" });
    return;
  }

  const deleted = softDeleteUser(user.id);
  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(204).send();
});

export default router;
