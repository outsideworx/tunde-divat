import { Router } from "express";
import { reservationPayloadSchema, reservationPickupPayloadSchema, reservationStatusPayloadSchema } from "@fashion-mvp/shared";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/errors.js";
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
  requireAdmin,
  asyncHandler(async (_req, res) => {
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
  "/:id/pickup",
  asyncHandler(async (req, res) => {
    const payload = reservationPickupPayloadSchema.parse(req.body);
    res.json({ reservation: await reservations.updatePickup(Number(req.params.id), req.user!.id, payload) });
  })
);

reservationRoutes.patch(
  "/:id/status",
  requireAdmin,
  asyncHandler(async (req, res) => {
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
