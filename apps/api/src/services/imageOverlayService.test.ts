import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ImageOverlayService } from "./imageOverlayService.js";

describe("ImageOverlayService", () => {
  it("creates a clean final WebP image without text overlay", async () => {
    const base = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "#ededed" }
    })
      .png()
      .toBuffer();
    const result = await new ImageOverlayService().apply({
      image: base,
      displayNumber: "27",
      price: 5500,
      sizes: ["S-M", "L-XL"]
    });
    expect(result.mimeType).toBe("image/webp");
    expect(result.buffer.length).toBeGreaterThan(1000);
  });
});
