import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { markNotificationRead } from "../store.js";

const router = Router();

router.post("/:id/ack", requireAuth, (req: AuthedRequest, res) => {
  const result = markNotificationRead(req.params.id, req.userId!);
  if (result === "not_found") {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (result === "forbidden") {
    res.status(403).json({ error: "You cannot acknowledge another user's notification" });
    return;
  }
  res.status(200).json({ ok: true });
});

export default router;
