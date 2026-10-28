import { Router } from "express";
import multer from "multer";
import { imageViewTypes } from "@fashion-mvp/shared";
import { env } from "../config/env.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimiters.js";
import { AppError, asyncHandler } from "../utils/errors.js";
import { validateImageUpload } from "../services/uploadValidation.js";
import { BulkUploadService } from "../services/bulkUploadService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 25 }
});
const bulkUploads = new BulkUploadService();

export const bulkUploadRoutes = Router();
bulkUploadRoutes.use(requireAuth, requireAdmin);

bulkUploadRoutes.get("/", asyncHandler(async (_req, res) => {
  res.json({ images: await bulkUploads.list() });
}));

bulkUploadRoutes.post("/images", uploadLimiter, upload.array("images", 25), asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) throw new AppError(400, "Válassz ki legalább egy képet a feltöltéshez.");
  const images = await Promise.all(files.map(async (file) => {
    const metadata = await validateImageUpload(file);
    return bulkUploads.add(file, metadata, req.user!.id);
  }));
  res.status(201).json({ images });
}));

bulkUploadRoutes.post("/consume", asyncHandler(async (req, res) => {
  const imageIds = Array.isArray(req.body?.image_ids) && req.body.image_ids.every((id: unknown) => Number.isInteger(id))
    ? req.body.image_ids as number[]
    : null;
  const productId = Number(req.body?.product_id);
  const rawViewTypes = req.body?.view_types;
  if (!imageIds || !Number.isInteger(productId)) throw new AppError(400, "Érvényes képek és termék szükségesek.");
  const viewTypes: Record<number, (typeof imageViewTypes)[number]> = {};
  if (rawViewTypes && typeof rawViewTypes === "object") {
    for (const [id, viewType] of Object.entries(rawViewTypes)) {
      if (!imageViewTypes.includes(viewType as (typeof imageViewTypes)[number])) throw new AppError(400, "Érvénytelen képtípus.");
      viewTypes[Number(id)] = viewType as (typeof imageViewTypes)[number];
    }
  }
  res.json({ product: await bulkUploads.attachToProduct(productId, imageIds, viewTypes) });
}));

bulkUploadRoutes.delete("/:id", asyncHandler(async (req, res) => {
  await bulkUploads.delete(Number(req.params.id));
  res.json({ ok: true });
}));
