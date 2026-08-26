import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, AppError } from "../utils/errors.js";
import { StorageService } from "../services/storageService.js";

export const imageRoutes = Router();
const storage = new StorageService();

imageRoutes.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const image = await prisma.productImage.findUnique({ where: { id: Number(req.params.id) } });
    if (!image) throw new AppError(404, "Image not found");
    res.type(image.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(storage.resolve(image.storagePath));
  })
);
