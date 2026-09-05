import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env, isProduction } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { securityLog } from "../utils/securityLog.js";

export type AuthUser = { id: number; username: string; email?: string | null; role: "ADMIN" | "STAFF" };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signSession(user: AuthUser) {
  return jwt.sign(user, env.SESSION_SECRET, { algorithm: "HS256", expiresIn: "12h", subject: String(user.id) });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 12 * 60 * 60 * 1000,
    path: "/"
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie("session", { path: "/" });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token) {
    securityLog("unauthorized_access", { path: req.path, reason: "missing_session" });
    return next(new AppError(401, "Authentication required"));
  }
  try {
    req.user = jwt.verify(token, env.SESSION_SECRET, { algorithms: ["HS256"] }) as AuthUser;
    return next();
  } catch {
    securityLog("unauthorized_access", { path: req.path, reason: "invalid_session" });
    return next(new AppError(401, "Authentication required"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user!.role !== "ADMIN") {
    return next(new AppError(403, "Admin jogosultság szükséges."));
  }
  return next();
}
