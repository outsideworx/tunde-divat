import { Router } from "express";
import { pickupOptionPayloadSchema } from "@fashion-mvp/shared";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, AppError } from "../utils/errors.js";
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
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") throw new AppError(403, "Admin jogosultság szükséges.");
    const payload = pickupOptionPayloadSchema.parse(req.body);
    res.status(201).json({ option: await pickups.create(payload, req.user!.id) });
  })
);

pickupRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") throw new AppError(403, "Admin jogosultság szükséges.");
    res.json({ option: await pickups.archive(Number(req.params.id)) });
  })
);
