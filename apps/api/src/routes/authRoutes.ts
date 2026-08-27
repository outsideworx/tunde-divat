import argon2 from "argon2";
import { Router } from "express";
import { inviteCodePayloadSchema, loginSchema, registerSchema } from "@fashion-mvp/shared";
import { prisma } from "../db/prisma.js";
import { asyncHandler, AppError } from "../utils/errors.js";
import { clearSessionCookie, requireAuth, setSessionCookie, signSession } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimiters.js";
import { securityLog } from "../utils/securityLog.js";

export const authRoutes = Router();
const INVITE_CODE_KEY = "REGISTRATION_INVITE_CODE";

function authUserFrom(user: { id: number; username: string; email: string | null; role: "ADMIN" | "STAFF" }) {
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}

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
    const authUser = authUserFrom(user);
    setSessionCookie(res, signSession(authUser));
    res.json({ user: authUser });
  })
);

authRoutes.post(
  "/register",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const setting = await prisma.appSetting.findUnique({ where: { key: INVITE_CODE_KEY } });
    if (!setting || setting.value !== payload.invite_code) {
      securityLog("registration_failure", { username: payload.username, ip: req.ip, reason: "invalid_invite_code" });
      throw new AppError(403, "Érvénytelen meghívókód.");
    }
    const existing = await prisma.user.findUnique({ where: { username: payload.username } });
    if (existing) throw new AppError(409, "Ez a felhasználónév már foglalt.");
    const user = await prisma.user.create({
      data: {
        username: payload.username,
        passwordHash: await argon2.hash(payload.password, { type: argon2.argon2id }),
        firstName: payload.first_name,
        lastName: payload.last_name,
        phone: payload.phone,
        role: "STAFF"
      }
    });
    const authUser = authUserFrom(user);
    setSessionCookie(res, signSession(authUser));
    res.status(201).json({ user: authUser });
  })
);

authRoutes.get(
  "/invite-code",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") throw new AppError(403, "Admin jogosultság szükséges.");
    const setting = await prisma.appSetting.findUnique({ where: { key: INVITE_CODE_KEY } });
    res.json({ invite_code: setting?.value ?? "" });
  })
);

authRoutes.put(
  "/invite-code",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") throw new AppError(403, "Admin jogosultság szükséges.");
    const payload = inviteCodePayloadSchema.parse(req.body);
    const setting = await prisma.appSetting.upsert({
      where: { key: INVITE_CODE_KEY },
      update: { value: payload.invite_code },
      create: { key: INVITE_CODE_KEY, value: payload.invite_code }
    });
    res.json({ invite_code: setting.value });
  })
);

authRoutes.post("/logout", requireAuth, (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
