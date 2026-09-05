import { Router } from "express";
import { pickupOptionPayloadSchema } from "@fashion-mvp/shared";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/errors.js";
import { PickupService } from "../services/pickupService.js";

export const pickupRoutes = Router();
const pickups = new PickupService();

pickupRoutes.use(requireAuth);

pickupRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ options: await pickups.listActive() });
  })
);

pickupRoutes.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = pickupOptionPayloadSchema.parse(req.body);
    res.status(201).json({ option: await pickups.create(payload, req.user!.id) });
  })
);

pickupRoutes.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ option: await pickups.archive(Number(req.params.id)) });
  })
);
