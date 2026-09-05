import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createTestContext, seedUser, type TestContext } from "./setup.js";

// A tiny valid PNG (1x1) so multer + sharp accept the upload in the mock flow.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

async function login(app: Express, username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  expect(res.status).toBe(200);
  return res.headers["set-cookie"];
}

describe("product lifecycle", () => {
  let ctx: TestContext;
  let cookie: string[];

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedUser(ctx, "admin123", "admin1234", "ADMIN");
    cookie = await login(ctx.app, "admin123", "admin1234");
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it("moves a product from DRAFT through PUBLISHED and assigns a public display number on approval", async () => {
    const app = ctx.app;

    const created = await request(app)
      .post("/api/products")
      .set("Cookie", cookie)
      .send({ product_id: "SKU-1", price: 5000, available_sizes: ["M"] });
    expect(created.status).toBe(201);
    const id = created.body.product.id;
    expect(created.body.product.status).toBe("DRAFT");
    expect(created.body.product.displayNumber).toBe("0");

    const uploaded = await request(app)
      .post(`/api/products/${id}/image`)
      .set("Cookie", cookie)
      .attach("image", PNG_1x1, { filename: "p.png", contentType: "image/png" });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.product.images.some((img: { imageType: string }) => img.imageType === "ORIGINAL")).toBe(true);

    const generated = await request(app)
      .post(`/api/products/${id}/generate`)
      .set("Cookie", cookie)
      .send({ gender: "female" });
    expect(generated.status).toBe(200);
    expect(generated.body.product.status).toBe("REVIEW");
    const types = generated.body.product.images.map((img: { imageType: string }) => img.imageType);
    expect(types).toContain("AI_GENERATED");
    expect(types).toContain("FINAL");

    const approved = await request(app).post(`/api/products/${id}/approve`).set("Cookie", cookie);
    expect(approved.status).toBe(200);
    expect(approved.body.product.status).toBe("APPROVED");
    expect(approved.body.product.displayNumber).toBe("1");

    const published = await request(app).post(`/api/products/${id}/publish`).set("Cookie", cookie);
    expect(published.status).toBe(200);
    expect(published.body.product.status).toBe("PUBLISHED");
  });

  it("allocates sequential public display numbers across products", async () => {
    const app = ctx.app;

    async function fullyApprove(sku: string) {
      const created = await request(app)
        .post("/api/products")
        .set("Cookie", cookie)
        .send({ product_id: sku, price: 1000, available_sizes: ["S"] });
      const id = created.body.product.id;
      await request(app)
        .post(`/api/products/${id}/image`)
        .set("Cookie", cookie)
        .attach("image", PNG_1x1, { filename: "p.png", contentType: "image/png" });
      await request(app).post(`/api/products/${id}/generate`).set("Cookie", cookie).send({});
      const approved = await request(app).post(`/api/products/${id}/approve`).set("Cookie", cookie);
      return approved.body.product.displayNumber as string;
    }

    const first = await fullyApprove("SEQ-A");
    const second = await fullyApprove("SEQ-B");
    expect(Number(second)).toBe(Number(first) + 1);
  });

  it("rejects a duplicate product_id with 409", async () => {
    const app = ctx.app;
    await request(app).post("/api/products").set("Cookie", cookie).send({ product_id: "DUP", price: 100, available_sizes: ["M"] });
    const dup = await request(app).post("/api/products").set("Cookie", cookie).send({ product_id: "DUP", price: 100, available_sizes: ["M"] });
    expect(dup.status).toBe(409);
  });

  it("rejects an invalid create payload with 400", async () => {
    const res = await request(ctx.app)
      .post("/api/products")
      .set("Cookie", cookie)
      .send({ product_id: "", price: -1, available_sizes: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("requires authentication", async () => {
    const res = await request(ctx.app).get("/api/products");
    expect(res.status).toBe(401);
  });
});
