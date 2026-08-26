import argon2 from "argon2";
import { Router } from "express";
import { loginSchema } from "@fashion-mvp/shared";
import { prisma } from "../db/prisma.js";
import { asyncHandler, AppError } from "../utils/errors.js";
import { clearSessionCookie, requireAuth, setSessionCookie, signSession } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimiters.js";
import { securityLog } from "../utils/securityLog.js";

export const authRoutes = Router();

authRoutes.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: payload.username } });
    if (!user || !(await argon2.verify(user.passwordHash, payload.password))) {
      securityLog("login_failure", { username: payload.username, ip: req.ip });
      throw new AppError(401, "Invalid username or password");
    }
    const authUser = { id: user.id, username: user.username, email: user.email, role: user.role };
    setSessionCookie(res, signSession(authUser));
    res.json({ user: authUser });
  })
);

authRoutes.post("/logout", requireAuth, (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
