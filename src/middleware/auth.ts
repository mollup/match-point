import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../auth/token.js";
import { getUserById } from "../store.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: "organizer" | "player";
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyToken(token);
    const user = getUserById(payload.sub);
    if (!user || user.deletedAt) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireOrganizer(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== "organizer") {
    res.status(403).json({ error: "Organizer role required" });
    return;
  }
  next();
}
