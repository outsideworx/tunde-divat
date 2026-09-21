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
export type GarmentView = "FRONT" | "BACK" | "DETAIL" | "AUTO" | "OTHER";

export class ImageGenerationService {
  constructor(private provider: "mock" | "openai" = "mock") {}

  async generateMarketingBase(original: Buffer, gender: ModelGender = "female", viewType: GarmentView = "AUTO"): Promise<ImageGenerationResult> {
    if (this.provider === "openai") {
      return this.generateWithOpenAI(original, gender, viewType);
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

  private async generateWithOpenAI(original: Buffer, gender: ModelGender, viewType: GarmentView): Promise<ImageGenerationResult> {
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
      ? "Show the same garment on a natural-looking adult male model with a friendly, natural smile and relaxed, confident posture. Use a natural fashion pose, such as a subtle step or a relaxed standing pose."
      : "Show the same garment on a natural-looking adult female model with a friendly, natural smile and relaxed, elegant posture. Use a natural fashion pose, such as a subtle step or a relaxed standing pose.";
    const viewDescription: Record<GarmentView, string> = {
      FRONT: "The uploaded photo shows the front of the garment. The model must clearly show the garment from the front.",
      BACK: "The uploaded photo shows the back of the garment. The model must be posed so the garment's back is clearly visible.",
      DETAIL: "The uploaded photo is a garment detail. Preserve that detail exactly and compose the model image so the detail remains clearly visible.",
      AUTO: "Determine from the uploaded photo whether it shows the garment front, back, or a detail, then preserve that same viewpoint in the result.",
      OTHER: "This view type is not eligible for generation."
    };
    form.append("prompt", [
      "Create a refined vertical ecommerce fashion photo from the uploaded clothing product reference.",
      modelDescription,
      viewDescription[viewType],
      "Frame the model from at least knee level to full length where possible, with the garment clearly visible and naturally styled with simple, unobtrusive complementary clothing.",
      "Treat the uploaded garment as the exact product. Preserve its exact color palette, print placement and scale, cut, neckline, bow or tie details, sleeve shape, hemline, fabric drape, proportions, seams, and all visible construction details. Do not redesign, simplify, replace, or invent garment details.",
      "Place the model in a clean, bright, neutral boutique interior or modern fashion shop. Use soft warm natural light, a tasteful premium atmosphere, a gently blurred background, and only subtle clothing racks or fitting-room details. Keep the setting uncluttered and never use an outdoor scene.",
      "Do not add text, logos, watermarks, numbers, prices, size labels, badges, or decorative typography.",
      "The output should be photorealistic, polished, welcoming, tasteful, and ready for review before publishing."
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
