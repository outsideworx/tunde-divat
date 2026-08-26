import sharp from "sharp";

export type ImageGenerationResult = {
  buffer: Buffer;
  provider: string;
  mimeType: string;
  width: number;
  height: number;
};

export class ImageGenerationService {
  constructor(private provider: "mock" | "openai" = "mock") {}

  async generateMarketingBase(original: Buffer): Promise<ImageGenerationResult> {
    if (this.provider === "openai") {
      throw new Error("OpenAI image generation adapter is intentionally not enabled in this MVP build.");
    }
    const composed = sharp(original).rotate().resize(1080, 1350, {
      fit: "contain",
      background: { r: 244, g: 246, b: 248, alpha: 1 }
    });
    const metadata = await composed.metadata();
    const buffer = await composed.webp({ quality: 92 }).toBuffer();
    return {
      buffer,
      provider: "mock",
      mimeType: "image/webp",
      width: metadata.width ?? 1080,
      height: metadata.height ?? 1350
    };
  }
}
