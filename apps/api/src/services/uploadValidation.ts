import sharp from "sharp";
import { AppError } from "../utils/errors.js";

const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function validateImageUpload(file?: Express.Multer.File) {
  if (!file) throw new AppError(400, "Image file is required");
  if (!allowedMimes.has(file.mimetype)) throw new AppError(400, "Unsupported image type");
  try {
    const image = sharp(file.buffer, { limitInputPixels: 30_000_000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Missing dimensions");
    if (metadata.width > 8000 || metadata.height > 8000) {
      throw new AppError(400, "Image dimensions are too large");
    }
    return metadata;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "Invalid image file");
  }
}
