import { describe, expect, it } from "vitest";
import sharp from "sharp";
import type { OverlayOptions, Sharp } from "sharp";
import { ImageOverlayService } from "./imageOverlayService.js";

describe("ImageOverlayService", () => {
  it("creates a final WebP image with overlay", async () => {
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

  it("keeps the display number in the top-left safe area", async () => {
    const base = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "#ededed" }
    })
      .png()
      .toBuffer();
    const composites: OverlayOptions[] = [];
    const originalComposite = sharp.prototype.composite;
    sharp.prototype.composite = function patchedComposite(this: Sharp, overlays: OverlayOptions[]) {
      composites.push(...overlays);
      return originalComposite.call(this, overlays);
    };

    try {
      await new ImageOverlayService().apply({
        image: base,
        displayNumber: "128",
        price: 5500,
        sizes: ["S-M"]
      });
    } finally {
      sharp.prototype.composite = originalComposite;
    }

    const svg = composites[0]?.input?.toString() ?? "";
    expect(svg).toContain('x="56" y="56"');
    expect(svg).toContain('x="88" y="128"');
    expect(svg).toContain("#128");
  });
});
