import type { ProductPayload } from "@fashion-mvp/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { StorageService } from "./storageService.js";
import { ImageGenerationService } from "./imageGenerationService.js";
import { ImageOverlayService } from "./imageOverlayService.js";
import { env } from "../config/env.js";
import type { ModelGender } from "./imageGenerationService.js";

const includeProduct = {
  sizes: true,
  images: true,
  generationJobs: { orderBy: { createdAt: "desc" as const }, take: 5 }
};

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof includeProduct }>;
const PUBLIC_DISPLAY_COUNTER = "PUBLIC_DISPLAY_NUMBER";

export class ProductService {
  private storage = new StorageService();
  private ai = new ImageGenerationService(env.AI_PROVIDER);
  private overlay = new ImageOverlayService();

  async dashboardCounts() {
    const groups = await prisma.product.groupBy({ by: ["status"], _count: { _all: true } });
    return Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  }

  async list(status?: string) {
    return prisma.product.findMany({
      where: status ? { status: status as never } : { status: { not: "ARCHIVED" } },
      include: includeProduct,
      orderBy: { createdAt: "desc" }
    });
  }

  async get(id: number) {
    const product = await prisma.product.findUnique({ where: { id }, include: includeProduct });
    if (!product) throw new AppError(404, "Product not found");
    return product;
  }

  async create(payload: ProductPayload, userId: number) {
    try {
      return await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            productId: payload.product_id,
            productName: payload.product_name,
            displayNumber: payload.display_number ?? "0",
            price: payload.price,
            category: payload.category ?? this.inferCategory(payload),
            color: payload.color,
            brand: payload.brand,
            description: payload.description,
            notes: payload.notes,
            targetGroup: payload.target_group,
            reservableUntil: payload.reservable_until,
            reservableDurationHours: payload.reservable_duration_hours,
            createdBy: userId,
            sizes: { create: payload.available_sizes.map((size) => ({ size })) }
          },
          include: includeProduct
        });
        return product;
      });
    } catch (error: unknown) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        throw new AppError(409, "product_id already exists in the current single-supplier MVP");
      }
      throw error;
    }
  }

  async update(id: number, payload: Partial<ProductPayload>) {
    const existing = await this.get(id);
    const nextSizes = payload.available_sizes;
    const hadAiImage = existing.images.some((image) => image.imageType === "AI_GENERATED");
    const product = await prisma.$transaction(async (tx) => {
      if (nextSizes) {
        await tx.productSize.deleteMany({ where: { productFk: id } });
      }
      return tx.product.update({
        where: { id },
        data: {
          productId: payload.product_id ?? existing.productId,
          productName: payload.product_name === undefined ? existing.productName : payload.product_name,
          displayNumber: payload.display_number ?? existing.displayNumber,
          price: payload.price ?? existing.price,
          category: payload.category === undefined ? existing.category : payload.category ?? this.inferCategory({ ...existing, ...payload } as ProductPayload),
          color: payload.color,
          brand: payload.brand,
          description: payload.description,
          notes: payload.notes,
          targetGroup: payload.target_group,
          reservableUntil: payload.reservable_until === undefined ? existing.reservableUntil : payload.reservable_until,
          reservableDurationHours: payload.reservable_duration_hours === undefined ? existing.reservableDurationHours : payload.reservable_duration_hours,
          sizes: nextSizes ? { create: nextSizes.map((size) => ({ size })) } : undefined
        },
        include: includeProduct
      });
    });
    if (hadAiImage && (payload.display_number || payload.price || payload.available_sizes)) {
      return this.regenerateOverlay(id);
    }
    return product;
  }

  async addOriginalImage(id: number, file: Express.Multer.File, metadata: { width?: number; height?: number }) {
    await this.get(id);
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const stored = await this.storage.save(file.buffer, ext);
    await prisma.productImage.create({
      data: {
        productFk: id,
        imageType: "ORIGINAL",
        storagePath: stored.storagePath,
        mimeType: file.mimetype,
        width: metadata.width,
        height: metadata.height
      }
    });
    return this.get(id);
  }

  async generate(id: number, gender: ModelGender = "female") {
    const product = await this.ensurePublicDisplayNumber(id);
    const original = product.images.find((image) => image.imageType === "ORIGINAL");
    if (!original) throw new AppError(400, "Original image is required before generation");
    const job = await prisma.generationJob.create({
      data: { productFk: id, status: "PROCESSING", provider: env.AI_PROVIDER }
    });
    await prisma.product.update({ where: { id }, data: { status: "PROCESSING" } });
    try {
      const originalBuffer = await this.storage.read(original.storagePath);
      const generated = await this.ai.generateMarketingBase(originalBuffer, gender);
      const aiStored = await this.storage.save(generated.buffer, "webp");
      await prisma.productImage.create({
        data: {
          productFk: id,
          imageType: "AI_GENERATED",
          storagePath: aiStored.storagePath,
          mimeType: generated.mimeType,
          width: generated.width,
          height: generated.height
        }
      });
      await this.createFinalOverlay(id, generated.buffer);
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", completedAt: new Date() }
      });
      await prisma.product.update({ where: { id }, data: { status: "REVIEW" } });
      return this.get(id);
    } catch (error) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Generation failed", completedAt: new Date() }
      });
      await prisma.product.update({ where: { id }, data: { status: "DRAFT" } });
      throw new AppError(502, "AI generation failed. The product data was kept and generation can be retried.");
    }
  }

  async regenerateOverlay(id: number) {
    const product = await this.get(id);
    const aiImage = product.images.find((image) => image.imageType === "AI_GENERATED");
    if (!aiImage) throw new AppError(400, "AI generated image is required before overlay regeneration");
    const buffer = await this.storage.read(aiImage.storagePath);
    await this.createFinalOverlay(id, buffer);
    return this.get(id);
  }

  async approve(id: number) {
    const beforeNumber = await this.get(id);
    const assignedDisplayNumber = !/^[1-9][0-9]*$/.test(beforeNumber.displayNumber);
    const product = assignedDisplayNumber ? await this.ensurePublicDisplayNumber(id) : beforeNumber;
    const updated = await prisma.$transaction(async (tx) => {
      const reservableUntil = product.reservableDurationHours
        ? new Date(Date.now() + product.reservableDurationHours * 60 * 60 * 1000)
        : product.reservableUntil;
      return tx.product.update({
        where: { id },
        data: {
          status: "APPROVED",
          reservableUntil,
          category: product.category ?? this.inferCategory({
            product_id: product.productId,
            product_name: product.productName,
            brand: product.brand,
            description: product.description,
            color: product.color
          })
        },
        include: includeProduct
      });
    });
    if (assignedDisplayNumber && updated.images.some((image) => image.imageType === "AI_GENERATED")) {
      return this.regenerateOverlay(id);
    }
    return updated;
  }

  async publish(id: number) {
    await this.get(id);
    return prisma.product.update({ where: { id }, data: { status: "PUBLISHED" }, include: includeProduct });
  }

  async archive(id: number) {
    await this.get(id);
    return prisma.product.update({ where: { id }, data: { status: "ARCHIVED" }, include: includeProduct });
  }

  async delete(id: number) {
    await this.archive(id);
    return { ok: true };
  }

  async restore(id: number) {
    const product = await this.get(id);
    const hasPublicNumber = /^[1-9][0-9]*$/.test(product.displayNumber);
    const restoredStatus = hasPublicNumber
      ? "APPROVED"
      : product.images.some((image) => image.imageType === "FINAL")
        ? "REVIEW"
        : "DRAFT";
    return prisma.product.update({ where: { id }, data: { status: restoredStatus }, include: includeProduct });
  }

  private async ensurePublicDisplayNumber(id: number) {
    const product = await this.get(id);
    if (/^[1-9][0-9]*$/.test(product.displayNumber)) return product;
    return prisma.$transaction(async (tx) => {
      const counter = await tx.appCounter.findUnique({ where: { name: PUBLIC_DISPLAY_COUNTER } });
      let displayNumber = "1";
      if (!counter) {
        await tx.appCounter.create({ data: { name: PUBLIC_DISPLAY_COUNTER, nextValue: 2 } });
      } else {
        displayNumber = String(counter.nextValue);
        await tx.appCounter.update({
          where: { name: PUBLIC_DISPLAY_COUNTER },
          data: { nextValue: { increment: 1 } }
        });
      }
      return tx.product.update({
        where: { id },
        data: { displayNumber },
        include: includeProduct
      });
    });
  }

  private async createFinalOverlay(id: number, sourceBuffer: Buffer) {
    const product = await this.get(id);
    const final = await this.overlay.apply({
      image: sourceBuffer,
      displayNumber: product.displayNumber,
      price: product.price,
      sizes: product.sizes.map((size) => size.size)
    });
    const stored = await this.storage.save(final.buffer, "webp");
    await prisma.productImage.create({
      data: {
        productFk: id,
        imageType: "FINAL",
        storagePath: stored.storagePath,
        mimeType: final.mimeType,
        width: final.width,
        height: final.height
      }
    });
  }

  private inferCategory(payload: Pick<ProductPayload, "product_id" | "product_name" | "description" | "brand" | "color">) {
    const text = [
      "product_id" in payload ? payload.product_id : "",
      payload.product_name,
      payload.description,
      payload.brand,
      payload.color
    ].filter(Boolean).join(" ").toLowerCase();
    if (/(cipő|cipo|shoe|csizma|szandál|szandal|sneaker)/i.test(text)) return "Cipő";
    if (/(nadrág|nadrag|farmer|jeans|leggings|szoknya)/i.test(text)) return "Alsó";
    if (/(kabát|kabat|dzseki|blézer|blezer|mellény|melleny)/i.test(text)) return "Kabát";
    if (/(ruha|dress|overál|overal)/i.test(text)) return "Ruha";
    if (/(felső|felso|póló|polo|blúz|bluz|pulóver|pulover|top|ing)/i.test(text)) return "Felső";
    if (/(táska|taska|öv|ov|sál|sal|sapka|kiegészítő|kiegeszito)/i.test(text)) return "Kiegészítő";
    return "Ruházat";
  }
}
