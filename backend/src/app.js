import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { query } from "./config/postgres.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { apiRouter } from "./routes/index.js";

const app = express();
app.disable("x-powered-by");
app.set("query parser", "simple");

if (env.trustProxy) {
  app.set("trust proxy", 1);
}

function isAllowedLocalDevOrigin(origin) {
  if (env.nodeEnv === "production") {
    return false;
  }

  try {
    const url = new URL(origin);
    const isLoopbackHost = ["localhost", "127.0.0.1"].includes(url.hostname);
    const isPrivateLanHost =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(url.hostname);

    return (isLoopbackHost || isPrivateLanHost) && ["5173", "5174", "5175"].includes(url.port);
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendUrls.includes(origin) || isAllowedLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(helmet());
app.use(cookieParser());
app.use("/api/v1/auth", express.json({ limit: "64kb" }));
app.use(express.json({ limit: "12mb" }));

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    service: "sr-aiims-hms-api",
    environment: env.nodeEnv
  });
});

app.get("/ready", async (_req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    if (env.persistenceEnabled) {
      await query("SELECT 1");
    }
    res.json({ ok: true, service: "sr-aiims-hms-api", database: env.persistenceEnabled ? "ready" : "disabled" });
  } catch {
    res.status(503).json({ ok: false, service: "sr-aiims-hms-api", database: "unavailable" });
  }
});

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
