import type { BulkReservationDeadlinePayload, ProductPayload } from "@fashion-mvp/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { StorageService } from "./storageService.js";
import { ImageGenerationService } from "./imageGenerationService.js";
import { ImageOverlayService } from "./imageOverlayService.js";
import { env } from "../config/env.js";
import type { GarmentView, ModelGender } from "./imageGenerationService.js";

const includeProduct = {
  sizes: true,
  images: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] },
  generationJobs: { orderBy: { createdAt: "desc" as const }, take: 5 }
};

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof includeProduct }>;
const PUBLIC_DISPLAY_COUNTER = "PUBLIC_DISPLAY_NUMBER";
const PRODUCT_ID_COUNTER = "PRODUCT_ID_NUMBER";

function sizeCreateData(payload: Pick<ProductPayload, "available_sizes" | "size_quantities" | "color_variants">) {
  if (payload.color_variants?.length) {
    return payload.color_variants.flatMap((variant) => variant.sizes.map(({ size, quantity }) => ({
      color: variant.color,
      size,
      quantity
    })));
  }
  return payload.available_sizes.map((size) => ({
    color: null,
    size,
    quantity: payload.size_quantities?.[size] ?? null
  }));
}

function shareImageIds(images: ProductWithRelations["images"]) {
  const latestFinalBySource = new Map<string, number>();
  for (const image of images) {
    if (image.imageType !== "FINAL") continue;
    const key = image.sourceImageId == null ? "legacy" : String(image.sourceImageId);
    const currentId = latestFinalBySource.get(key);
    if (currentId == null || image.id > currentId) latestFinalBySource.set(key, image.id);
  }
  const finalIds = new Set(latestFinalBySource.values());
  const finalSourceIds = new Set(images.filter((image) => finalIds.has(image.id) && image.sourceImageId != null).map((image) => image.sourceImageId));
  return images
    .filter((image) => {
      if (image.imageType === "ORIGINAL") return true;
      if (image.imageType === "FINAL") return finalIds.has(image.id);
      if (image.imageType !== "AI_GENERATED") return false;
      return image.sourceImageId == null ? finalIds.size === 0 : !finalSourceIds.has(image.sourceImageId);
    })
    .map((image) => image.id);
}

export class ProductService {
  private storage: StorageService;
  private ai: ImageGenerationService;
  private overlay: ImageOverlayService;

  constructor(
    storage = new StorageService(),
    ai = new ImageGenerationService(env.AI_PROVIDER),
    overlay = new ImageOverlayService()
  ) {
    this.storage = storage;
    this.ai = ai;
    this.overlay = overlay;
  }

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
        const productId = payload.product_id?.trim() || (await this.nextAvailableProductId(tx));
        const product = await tx.product.create({
          data: {
            productId,
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
            sizes: { create: sizeCreateData(payload) }
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
    const hasSizeUpdate = payload.available_sizes !== undefined || payload.color_variants !== undefined;
    const hadAiImage = existing.images.some((image) => image.imageType === "AI_GENERATED");
    const product = await prisma.$transaction(async (tx) => {
      if (hasSizeUpdate) {
        await tx.productSize.deleteMany({ where: { productFk: id } });
      }
      return tx.product.update({
        where: { id },
        data: {
          productId: payload.product_id?.trim() || existing.productId,
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
          sizes: hasSizeUpdate ? {
            create: sizeCreateData({
              available_sizes: payload.available_sizes ?? [],
              size_quantities: payload.size_quantities,
              color_variants: payload.color_variants
            })
          } : undefined
        },
        include: includeProduct
      });
    });
    if (hadAiImage && (payload.display_number || payload.price || payload.available_sizes || payload.color_variants)) {
      return this.regenerateOverlay(id);
    }
    return product;
  }

  async updateApprovedReservationDeadline(payload: BulkReservationDeadlinePayload) {
    const result = await prisma.product.updateMany({
      where: { status: "APPROVED" },
      data: {
        reservableUntil: payload.reservable_until,
        reservableDurationHours: null
      }
    });
    const products = await this.list("APPROVED");
    return { count: result.count, products };
  }

  async addOriginalImage(id: number, file: Express.Multer.File, metadata: { width?: number; height?: number }, viewType: GarmentView = "AUTO") {
    const product = await this.get(id);
    if (product.images.filter((image) => image.imageType === "ORIGINAL").length >= 5) {
      throw new AppError(400, "Egy termékhez legfeljebb 5 eredeti képet tölthetsz fel.");
    }
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const stored = await this.storage.save(file.buffer, ext);
    const lastImage = await prisma.productImage.findFirst({
      where: { productFk: id },
      orderBy: [{ sortOrder: "desc" }, { id: "desc" }]
    });
    await prisma.productImage.create({
      data: {
        productFk: id,
        imageType: "ORIGINAL",
        storagePath: stored.storagePath,
        mimeType: file.mimetype,
        width: metadata.width,
        height: metadata.height,
        sortOrder: (lastImage?.sortOrder ?? -1) + 1,
        viewType
      }
    });
    return this.get(id);
  }

  async reorderImages(id: number, imageIds: number[]) {
    const product = await this.get(id);
    const knownIds = shareImageIds(product.images).sort((a, b) => a - b);
    const requestedIds = [...imageIds].sort((a, b) => a - b);
    if (knownIds.length !== requestedIds.length || knownIds.some((value, index) => value !== requestedIds[index])) {
      throw new AppError(400, "A képsorrend nem ehhez a termékhez tartozik.");
    }
    await prisma.$transaction([
      ...imageIds.map((imageId, index) => prisma.productImage.update({
        where: { id: imageId },
        data: { sortOrder: index }
      })),
      prisma.product.update({ where: { id }, data: { displayImageId: imageIds[0] } })
    ]);
    return this.get(id);
  }

  async setDisplayImage(id: number, imageId: number | null) {
    const product = await this.get(id);
    if (imageId !== null && !product.images.some((image) => image.id === imageId)) {
      throw new AppError(400, "A kiválasztott kép nem ehhez a termékhez tartozik.");
    }
    return prisma.product.update({ where: { id }, data: { displayImageId: imageId }, include: includeProduct });
  }

  async sendToAi(id: number) {
    const product = await this.get(id);
    if (!product.images.some((image) => image.imageType === "ORIGINAL")) {
      throw new AppError(400, "AI-generáláshoz legalább egy eredeti kép szükséges.");
    }
    return prisma.product.update({ where: { id }, data: { status: "DRAFT" }, include: includeProduct });
  }

  async setImageVisibility(id: number, imageId: number, isHidden: boolean) {
    const product = await this.get(id);
    if (!product.images.some((image) => image.id === imageId)) {
      throw new AppError(400, "A kiválasztott kép nem ehhez a termékhez tartozik.");
    }
    return prisma.productImage.update({ where: { id: imageId }, data: { isHidden } });
  }

  async setImageAiArchive(id: number, imageId: number, aiArchived: boolean) {
    const product = await this.get(id);
    const image = product.images.find((candidate) => candidate.id === imageId && candidate.imageType === "ORIGINAL");
    if (!image) throw new AppError(400, "Csak eredeti termékkép helyezhető az AI-archívumba.");
    return prisma.productImage.update({ where: { id: imageId }, data: { aiArchived } });
  }

  async deleteImage(id: number, imageId: number) {
    const product = await this.get(id);
    const image = product.images.find((candidate) => candidate.id === imageId);
    if (!image) throw new AppError(404, "A kép nem ehhez a termékhez tartozik.");
    const related = product.images.filter((candidate) => candidate.id === imageId || candidate.sourceImageId === imageId);
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { id: { in: related.map((candidate) => candidate.id) } } }),
      prisma.product.update({
        where: { id },
        data: { displayImageId: product.displayImageId && related.some((candidate) => candidate.id === product.displayImageId) ? null : product.displayImageId }
      })
    ]);
    await Promise.all(related.map((candidate) => this.storage.delete(candidate.storagePath)));
    return this.get(id);
  }

  async generate(id: number, gender: ModelGender = "female", originalImageId?: number) {
    const product = await this.ensurePublicDisplayNumber(id);
    const statusBeforeGeneration = product.status;
    const original = originalImageId
      ? product.images.find((image) => image.id === originalImageId && image.imageType === "ORIGINAL")
      : product.images.find((image) => image.imageType === "ORIGINAL");
    if (!original) throw new AppError(400, "Original image is required before generation");
    if (original.viewType === "OTHER") throw new AppError(400, "Az Egyéb képtípus csak a galériában jelenik meg, AI-generálásra nem küldhető.");
    const job = await prisma.generationJob.create({
      data: { productFk: id, status: "PROCESSING", provider: env.AI_PROVIDER }
    });
    if (statusBeforeGeneration !== "APPROVED" && statusBeforeGeneration !== "PUBLISHED") {
      await prisma.product.update({ where: { id }, data: { status: "PROCESSING" } });
    }
    try {
      const originalBuffer = await this.storage.read(original.storagePath);
      const generated = await this.ai.generateMarketingBase(originalBuffer, gender, original.viewType);
      const aiStored = await this.storage.save(generated.buffer, "webp");
      await prisma.productImage.create({
        data: {
          productFk: id,
          imageType: "AI_GENERATED",
          storagePath: aiStored.storagePath,
          mimeType: generated.mimeType,
          width: generated.width,
          height: generated.height,
          sourceImageId: original.id,
          viewType: original.viewType
        }
      });
      await this.createFinalOverlay(id, generated.buffer, original.id, original.viewType);
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", completedAt: new Date() }
      });
      if (statusBeforeGeneration !== "APPROVED" && statusBeforeGeneration !== "PUBLISHED") {
        await prisma.product.update({ where: { id }, data: { status: "REVIEW" } });
      }
      return this.get(id);
    } catch (error) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Generation failed", completedAt: new Date() }
      });
      await prisma.product.update({ where: { id }, data: { status: statusBeforeGeneration === "PROCESSING" ? "DRAFT" : statusBeforeGeneration } });
      throw new AppError(502, "AI generation failed. The product data was kept and generation can be retried.");
    }
  }

  async regenerateOverlay(id: number) {
    const product = await this.get(id);
    const aiImage = product.images.find((image) => image.imageType === "AI_GENERATED");
    if (!aiImage) throw new AppError(400, "AI generated image is required before overlay regeneration");
    const buffer = await this.storage.read(aiImage.storagePath);
    await this.createFinalOverlay(id, buffer, aiImage.sourceImageId ?? undefined, aiImage.viewType);
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

  private async nextCounterValue(tx: Prisma.TransactionClient, name: string) {
    const counter = await tx.appCounter.findUnique({ where: { name } });
    if (!counter) {
      await tx.appCounter.create({ data: { name, nextValue: 2 } });
      return "1";
    }
    await tx.appCounter.update({
      where: { name },
      data: { nextValue: { increment: 1 } }
    });
    return String(counter.nextValue);
  }

  private async nextAvailableProductId(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const productId = await this.nextCounterValue(tx, PRODUCT_ID_COUNTER);
      const existing = await tx.product.findUnique({ where: { productId } });
      if (!existing) return productId;
    }
    throw new AppError(500, "Nem sikerült automatikus Product ID-t kiosztani.");
  }

  private async createFinalOverlay(id: number, sourceBuffer: Buffer, sourceImageId?: number, viewType: GarmentView = "AUTO") {
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
        height: final.height,
        sourceImageId,
        viewType
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
    if (/(harisnya|zokni|pantyhose|tights)/i.test(text)) return "Harisnya";
    if (/(táska|taska|bag)/i.test(text)) return "Táska";
    if (/(sapka|kalap|cap|hat)/i.test(text)) return "Sapka";
    if (/(nadrág|nadrag|farmer|jeans|leggings|szoknya)/i.test(text)) return "Nadrág";
    if (/(kabát|kabat|dzseki|blézer|blezer|mellény|melleny)/i.test(text)) return "Kabát";
    if (/(ruha|dress|overál|overal)/i.test(text)) return "Ruha";
    if (/(póló|polo|t-shirt|tshirt)/i.test(text)) return "Póló";
    if (/(felső|felso|blúz|bluz|pulóver|pulover|top|ing)/i.test(text)) return "Felső";
    return "Egyéb";
  }
}
