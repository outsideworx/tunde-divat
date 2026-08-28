import sharp from "sharp";
import { env } from "../config/env.js";

export type ImageGenerationResult = {
  buffer: Buffer;
  provider: string;
  mimeType: string;
  width: number;
  height: number;
};

export type ModelGender = "female" | "male";

export class ImageGenerationService {
  constructor(private provider: "mock" | "openai" = "mock") {}

  async generateMarketingBase(original: Buffer, gender: ModelGender = "female"): Promise<ImageGenerationResult> {
    if (this.provider === "openai") {
      return this.generateWithOpenAI(original, gender);
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

  private async generateWithOpenAI(original: Buffer, gender: ModelGender): Promise<ImageGenerationResult> {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai.");
    }
    const source = await sharp(original)
      .rotate()
      .resize(1080, 1350, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append("model", env.OPENAI_IMAGE_MODEL);
    form.append("image[]", new Blob([source], { type: "image/png" }), "product-reference.png");
    form.append("size", "1024x1536");
    form.append("quality", "medium");
    const modelDescription = gender === "male"
      ? "Show the same garment on a natural-looking adult male model in a simple standing pose, with a friendly natural smile."
      : "Show the same garment on a natural-looking adult female model in a simple standing pose, with a friendly natural smile.";
    form.append("prompt", [
      "Create a professional vertical ecommerce fashion photo from the uploaded clothing product reference.",
      modelDescription,
      "Preserve the garment's color, cut, material feel, pattern, proportions, and visible details as faithfully as possible.",
      "Place the model in a clean, bright, neutral boutique store environment or modern fashion shop background, with soft natural lighting, subtle clothing racks or fitting-room details in the background, and no distracting objects.",
      "Do not add text, logos, watermarks, numbers, prices, size labels, badges, or decorative typography.",
      "The output should be realistic, tasteful, and ready for review before publishing."
    ].join(" "));

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form
    });
    const body = await response.json().catch(() => null) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
    if (!response.ok) {
      throw new Error(body?.error?.message ?? `OpenAI image generation failed with status ${response.status}.`);
    }
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI image generation did not return image data.");
    const raw = Buffer.from(b64, "base64");
    const normalized = sharp(raw).rotate().resize(1080, 1350, {
      fit: "cover"
    });
    const metadata = await normalized.metadata();
    const buffer = await normalized.webp({ quality: 92 }).toBuffer();
    return {
      buffer,
      provider: "openai",
      mimeType: "image/webp",
      width: metadata.width ?? 1080,
      height: metadata.height ?? 1350
    };
  }
}
