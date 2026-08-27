import sharp from "sharp";

export type OverlayInput = {
  image: Buffer;
  displayNumber: string;
  price: number;
  sizes: string[];
};

export class ImageOverlayService {
  async apply(input: OverlayInput): Promise<{ buffer: Buffer; width: number; height: number; mimeType: string }> {
    const base = sharp(input.image).rotate().resize(1080, 1350, { fit: "cover" });
    const metadata = await base.metadata();
    const width = metadata.width ?? 1080;
    const height = metadata.height ?? 1350;
    const buffer = await base.webp({ quality: 90 }).toBuffer();
    return { buffer, width, height, mimeType: "image/webp" };
  }
}
