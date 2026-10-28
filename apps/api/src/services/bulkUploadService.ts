import type { ImageViewType } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { StorageService } from "./storageService.js";

export class BulkUploadService {
  private storage = new StorageService();

  list() {
    return prisma.bulkUploadImage.findMany({ orderBy: { createdAt: "desc" } });
  }

  async add(file: Express.Multer.File, metadata: { width?: number; height?: number }, userId: number) {
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const stored = await this.storage.save(file.buffer, ext);
    return prisma.bulkUploadImage.create({
      data: {
        storagePath: stored.storagePath,
        mimeType: file.mimetype,
        width: metadata.width,
        height: metadata.height,
        uploadedById: userId
      }
    });
  }

  async delete(id: number) {
    const image = await prisma.bulkUploadImage.findUnique({ where: { id } });
    if (!image) throw new AppError(404, "A tárolt kép nem található.");
    await prisma.bulkUploadImage.delete({ where: { id } });
    await this.storage.delete(image.storagePath);
  }

  async attachToProduct(productId: number, imageIds: number[], viewTypes: Record<number, ImageViewType>) {
    if (!imageIds.length || imageIds.length > 5 || new Set(imageIds).size !== imageIds.length) {
      throw new AppError(400, "Egy termékhez 1-5 különböző tárolt képet választhatsz ki.");
    }
    const [product, images] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId }, include: { images: true, sizes: true, generationJobs: true } }),
      prisma.bulkUploadImage.findMany({ where: { id: { in: imageIds } } })
    ]);
    if (!product) throw new AppError(404, "A termék nem található.");
    if (images.length !== imageIds.length) throw new AppError(404, "Egy vagy több kiválasztott kép már nem található.");
    const originalCount = product.images.filter((image) => image.imageType === "ORIGINAL").length;
    if (originalCount + images.length > 5) throw new AppError(400, "Egy termékhez legfeljebb 5 eredeti kép tartozhat.");
    const orderedImages = imageIds.map((id) => images.find((image) => image.id === id)!);
    await prisma.$transaction([
      ...orderedImages.map((image, index) => prisma.productImage.create({
        data: {
          productFk: productId,
          imageType: "ORIGINAL",
          storagePath: image.storagePath,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          sortOrder: originalCount + index,
          viewType: viewTypes[image.id] ?? image.viewType
        }
      })),
      prisma.bulkUploadImage.deleteMany({ where: { id: { in: imageIds } } })
    ]);
    return prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { sizes: true, images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }, generationJobs: { orderBy: { createdAt: "desc" }, take: 5 } }
    });
  }
}
