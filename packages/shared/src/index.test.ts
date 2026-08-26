import { describe, expect, it } from "vitest";
import { formatHuf, productPayloadSchema } from "./index";

describe("shared validation", () => {
  it("accepts valid product payloads", () => {
    const parsed = productPayloadSchema.parse({
      product_id: "TR-58281",
      display_number: "27",
      price: "5500",
      available_sizes: ["S-M", "L-XL"]
    });
    expect(parsed.price).toBe(5500);
  });

  it("rejects invalid display numbers", () => {
    expect(() =>
      productPayloadSchema.parse({
        product_id: "A1452",
        display_number: "<script>",
        price: 5500,
        available_sizes: ["M"]
      })
    ).toThrow();
  });

  it("formats Hungarian forint prices", () => {
    expect(formatHuf(5500)).toContain("Ft");
  });

  it("validates username based login payloads", async () => {
    const { loginSchema } = await import("./index");
    expect(loginSchema.parse({ username: "admin123", password: "admin1234" }).username).toBe("admin123");
  });
});
