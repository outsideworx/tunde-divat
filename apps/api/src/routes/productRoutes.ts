import { Router } from "express";
import multer from "multer";
import { productPayloadSchema } from "@fashion-mvp/shared";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { generationLimiter, uploadLimiter } from "../middleware/rateLimiters.js";
import { asyncHandler } from "../utils/errors.js";
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

productRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ product: await products.get(Number(req.params.id)) });
  })
);

productRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = productPayloadSchema.partial().parse(req.body);
    res.json({ product: await products.update(Number(req.params.id), payload) });
  })
);

productRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await products.delete(Number(req.params.id)));
  })
);

productRoutes.post(
  "/:id/image",
  uploadLimiter,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const metadata = await validateImageUpload(req.file);
    res.json({ product: await products.addOriginalImage(Number(req.params.id), req.file!, metadata) });
  })
);

productRoutes.post(
  "/:id/generate",
  generationLimiter,
  asyncHandler(async (req, res) => {
    res.json({ product: await products.generate(Number(req.params.id)) });
  })
);

productRoutes.post(
  "/:id/regenerate",
  generationLimiter,
  asyncHandler(async (req, res) => {
    res.json({ product: await products.generate(Number(req.params.id)) });
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
  asyncHandler(async (req, res) => {
    res.json({ product: await products.approve(Number(req.params.id)) });
  })
);

productRoutes.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    res.json({ product: await products.publish(Number(req.params.id)) });
  })
);

productRoutes.post(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    res.json({ product: await products.archive(Number(req.params.id)) });
  })
);

productRoutes.post(
  "/:id/restore",
  asyncHandler(async (req, res) => {
    res.json({ product: await products.restore(Number(req.params.id)) });
  })
);
