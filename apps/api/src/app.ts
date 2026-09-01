import { existsSync } from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env, isProduction } from "./config/env.js";
import { authRoutes } from "./routes/authRoutes.js";
import { productRoutes } from "./routes/productRoutes.js";
import { imageRoutes } from "./routes/imageRoutes.js";
import { pickupRoutes } from "./routes/pickupRoutes.js";
import { reservationRoutes } from "./routes/reservationRoutes.js";
import { errorHandler } from "./utils/errors.js";

export function createApp() {
  const app = express();
  // Behind Traefik there is exactly one proxy hop. Trust that single hop so
  // express-rate-limit reads the real client IP from X-Forwarded-For. A bounded
  // value (not `true`) prevents clients from spoofing the header to evade limits.
  if (isProduction) {
    app.set("trust proxy", 1);
  }
  const allowedOrigins = new Set([
    env.CORS_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]);
  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: env.WEB_DIST_DIR
        ? {
            directives: {
              ...helmet.contentSecurityPolicy.getDefaultDirectives(),
              "img-src": ["'self'", "data:", "blob:"],
              "style-src": ["'self'", "'unsafe-inline'"],
              "connect-src": ["'self'"]
            }
          }
        : undefined
    })
  );
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

  if (env.WEB_DIST_DIR) {
    const webDistDir = path.resolve(env.WEB_DIST_DIR);
    const indexHtml = path.join(webDistDir, "index.html");
    app.use(express.static(webDistDir));
    app.get(/^(?!\/api\/).*/, (_req, res, next) => {
      if (existsSync(indexHtml)) return res.sendFile(indexHtml);
      return next();
    });
  }

  app.use(errorHandler);
  return app;
}
