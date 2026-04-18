import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.js";
import notificationRoutes from "./routes/notifications.js";
import tournamentRoutes from "./routes/tournaments.js";
import userRoutes from "./routes/users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/tournaments", tournamentRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/notifications", notificationRoutes);

  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const webDist = path.join(__dirname, "..", "frontend", "dist");
    app.use(express.static(webDist));
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  return app;
}
