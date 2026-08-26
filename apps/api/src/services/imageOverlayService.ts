import sharp from "sharp";

export type OverlayInput = {
  image: Buffer;
  displayNumber: string;
  price: number;
  sizes: string[];
};

function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]!));
}

export class ImageOverlayService {
  async apply(input: OverlayInput): Promise<{ buffer: Buffer; width: number; height: number; mimeType: string }> {
    const base = sharp(input.image).rotate().resize(1080, 1350, { fit: "cover" });
    const metadata = await base.metadata();
    const width = metadata.width ?? 1080;
    const height = metadata.height ?? 1350;
    const displayNumber = input.displayNumber.startsWith("#") ? input.displayNumber : `#${input.displayNumber}`;
    const badgeWidth = Math.max(180, displayNumber.length * 48 + 64);
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .badge { fill: rgba(16, 24, 40, .90); stroke: rgba(255, 255, 255, .76); stroke-width: 3; }
          .number { font: 900 62px Arial, sans-serif; fill: #fff; }
        </style>
        <rect class="badge" x="56" y="56" rx="22" ry="22" width="${badgeWidth}" height="108"/>
        <text class="number" x="88" y="128">${escapeXml(displayNumber)}</text>
      </svg>`;
    const buffer = await base
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .webp({ quality: 90 })
      .toBuffer();
    return { buffer, width, height, mimeType: "image/webp" };
  }
}
