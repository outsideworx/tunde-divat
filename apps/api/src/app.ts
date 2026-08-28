import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/authRoutes.js";
import { productRoutes } from "./routes/productRoutes.js";
import { imageRoutes } from "./routes/imageRoutes.js";
import { pickupRoutes } from "./routes/pickupRoutes.js";
import { reservationRoutes } from "./routes/reservationRoutes.js";
import { errorHandler } from "./utils/errors.js";

export function createApp() {
  const app = express();
  const allowedOrigins = new Set([
    env.CORS_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]);
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        const isLocalNetworkDevOrigin =
          env.NODE_ENV !== "production" &&
          !!origin &&
          /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):5173$/.test(origin);
        callback(null, !origin || allowedOrigins.has(origin) || isLocalNetworkDevOrigin);
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/pickups", pickupRoutes);
  app.use("/api/reservations", reservationRoutes);
  app.use("/api/images", imageRoutes);
  app.use(errorHandler);
  return app;
}
