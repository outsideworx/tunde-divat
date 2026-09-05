import argon2 from "argon2";
import { Router } from "express";
import { adminUserUpdateSchema, inviteCodePayloadSchema, loginSchema, registerSchema } from "@fashion-mvp/shared";
import { prisma } from "../db/prisma.js";
import { asyncHandler, AppError } from "../utils/errors.js";
import { clearSessionCookie, requireAdmin, requireAuth, setSessionCookie, signSession } from "../middleware/auth.js";
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
    if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, payload.password))) {
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
        privacyAcceptedAt: new Date(),
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
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: INVITE_CODE_KEY } });
    res.json({ invite_code: setting?.value ?? "" });
  })
);

authRoutes.get(
  "/users",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        lastName: true,
        firstName: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        privacyAcceptedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ users });
  })
);

authRoutes.put(
  "/users/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const payload = adminUserUpdateSchema.parse(req.body);
    if (id === req.user!.id && (!payload.is_active || payload.role !== "ADMIN")) {
      throw new AppError(400, "A saját admin jogosultságodat vagy aktív állapotodat nem módosíthatod így.");
    }
    const duplicate = await prisma.user.findFirst({
      where: {
        username: payload.username,
        NOT: { id }
      }
    });
    if (duplicate) throw new AppError(409, "Ez a felhasználónév már foglalt.");
    const email = payload.email?.trim() || null;
    if (email) {
      const emailDuplicate = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id }
        }
      });
      if (emailDuplicate) throw new AppError(409, "Ez az e-mail cím már másik felhasználóhoz tartozik.");
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        username: payload.username,
        email,
        lastName: payload.last_name?.trim() || null,
        firstName: payload.first_name?.trim() || null,
        phone: payload.phone?.trim() || null,
        role: payload.role,
        isActive: payload.is_active
      },
      select: {
        id: true,
        username: true,
        lastName: true,
        firstName: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        privacyAcceptedAt: true,
        createdAt: true
      }
    });
    res.json({ user });
  })
);

authRoutes.post(
  "/users/:id/anonymize",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) throw new AppError(400, "A saját felhasználódat nem anonimizálhatod.");
    const user = await prisma.user.update({
      where: { id },
      data: {
        username: `torolt-felhasznalo-${id}`,
        email: null,
        lastName: null,
        firstName: null,
        phone: null,
        isActive: false
      },
      select: {
        id: true,
        username: true,
        lastName: true,
        firstName: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        privacyAcceptedAt: true,
        createdAt: true
      }
    });
    res.json({ user });
  })
);

authRoutes.put(
  "/invite-code",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
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
