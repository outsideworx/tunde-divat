import { Router } from "express";
import multer from "multer";
import { bulkReservationDeadlinePayloadSchema, generationPayloadSchema, imageViewTypes, productPayloadSchema, productUpdatePayloadSchema } from "@fashion-mvp/shared";
import { env } from "../config/env.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { generationLimiter, uploadLimiter } from "../middleware/rateLimiters.js";
import { AppError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/securityLog.js";
import { ProductService } from "../services/productService.js";
import { validateImageUpload } from "../services/uploadValidation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 }
});

export const productRoutes = Router();
const products = new ProductService();

productRoutes.use(requireAuth);

productRoutes.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    res.json({ counts: await products.dashboardCounts() });
  })
);

productRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ products: await products.list(req.query.status?.toString()) });
  })
);

productRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = productPayloadSchema.parse(req.body);
    res.status(201).json({ product: await products.create(payload, req.user!.id) });
  })
);

productRoutes.put(
  "/:id/images/order",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const imageIds = Array.isArray(req.body?.image_ids) && req.body.image_ids.every((value: unknown) => Number.isInteger(value))
      ? req.body.image_ids as number[]
      : null;
    if (!imageIds?.length) throw new AppError(400, "Adj meg legalább egy képet a sorrendhez.");
    res.json({ product: await products.reorderImages(Number(req.params.id), imageIds) });
  })
);

productRoutes.put(
  "/:id/display-image",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const imageId = req.body?.image_id === null ? null : Number(req.body?.image_id);
    if (imageId !== null && (!Number.isInteger(imageId) || imageId < 1)) throw new AppError(400, "Érvénytelen képkiválasztás.");
    res.json({ product: await products.setDisplayImage(Number(req.params.id), imageId) });
  })
);

productRoutes.post(
  "/:id/send-to-ai",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ product: await products.sendToAi(Number(req.params.id)) });
  })
);

productRoutes.patch(
  "/bulk/reservation-deadline",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = bulkReservationDeadlinePayloadSchema.parse(req.body);
    res.json(await products.updateApprovedReservationDeadline(payload));
  })
);

productRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await products.get(Number(req.params.id));
    if (req.user!.role !== "ADMIN") {
      logger.info("product_view", { productId: product.id, userId: req.user!.id, ip: req.ip });
    }
    res.json({ product });
  })
);

productRoutes.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = productUpdatePayloadSchema.parse(req.body);
    res.json({ product: await products.update(Number(req.params.id), payload) });
  })
);

productRoutes.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await products.delete(Number(req.params.id)));
  })
);

productRoutes.post(
  "/:id/image",
  requireAdmin,
  uploadLimiter,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const metadata = await validateImageUpload(req.file);
    const requestedView = req.body?.view_type;
    if (requestedView !== undefined && (typeof requestedView !== "string" || !imageViewTypes.includes(requestedView as (typeof imageViewTypes)[number]))) {
      throw new AppError(400, "Érvénytelen képtípus.");
    }
    res.json({ product: await products.addOriginalImage(Number(req.params.id), req.file!, metadata, requestedView ?? "AUTO") });
  })
);

productRoutes.post(
  "/:id/generate",
  requireAdmin,
  generationLimiter,
  asyncHandler(async (req, res) => {
    const payload = generationPayloadSchema.parse(req.body ?? {});
    res.json({ product: await products.generate(Number(req.params.id), payload.gender, payload.image_id) });
  })
);

productRoutes.put(
  "/:id/images/:imageId/visibility",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (typeof req.body?.is_hidden !== "boolean") throw new AppError(400, "A kép láthatósága kötelező.");
    res.json({ image: await products.setImageVisibility(Number(req.params.id), Number(req.params.imageId), req.body.is_hidden) });
  })
);

productRoutes.put(
  "/:id/images/:imageId/ai-archive",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (typeof req.body?.ai_archived !== "boolean") throw new AppError(400, "Az AI-archív állapot megadása kötelező.");
    res.json({ image: await products.setImageAiArchive(Number(req.params.id), Number(req.params.imageId), req.body.ai_archived) });
  })
);

productRoutes.delete(
  "/:id/images/:imageId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ product: await products.deleteImage(Number(req.params.id), Number(req.params.imageId)) });
  })
);

productRoutes.post(
  "/:id/overlay",
  asyncHandler(async (req, res) => {
    res.json({ product: await products.regenerateOverlay(Number(req.params.id)) });
  })
);

productRoutes.post(
  "/:id/approve",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ product: await products.approve(Number(req.params.id)) });
  })
);

productRoutes.post(
  "/:id/publish",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ product: await products.publish(Number(req.params.id)) });
  })
);

productRoutes.post(
  "/:id/archive",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ product: await products.archive(Number(req.params.id)) });
  })
);

productRoutes.post(
  "/:id/restore",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ product: await products.restore(Number(req.params.id)) });
  })
);
