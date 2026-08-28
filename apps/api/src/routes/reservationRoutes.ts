import { Router } from "express";
import { reservationPayloadSchema, reservationStatusPayloadSchema } from "@fashion-mvp/shared";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, AppError } from "../utils/errors.js";
import { ReservationService } from "../services/reservationService.js";

export const reservationRoutes = Router();
const reservations = new ReservationService();

reservationRoutes.use(requireAuth);

reservationRoutes.get(
  "/my",
  asyncHandler(async (req, res) => {
    res.json({ reservations: await reservations.my(req.user!.id) });
  })
);

reservationRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") throw new AppError(403, "Admin jogosultság szükséges.");
    res.json({ reservations: await reservations.all() });
  })
);

reservationRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = reservationPayloadSchema.parse(req.body);
    res.status(201).json({ reservation: await reservations.reserve(payload, req.user!.id) });
  })
);

reservationRoutes.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") throw new AppError(403, "Admin jogosultság szükséges.");
    const payload = reservationStatusPayloadSchema.parse(req.body);
    res.json({ reservation: await reservations.updateStatus(Number(req.params.id), payload) });
  })
);

reservationRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ reservation: await reservations.cancel(Number(req.params.id), req.user!.id) });
  })
);
