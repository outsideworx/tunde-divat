import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createTestContext, seedUser, type TestContext } from "./setup.js";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

async function login(app: Express, username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  expect(res.status).toBe(200);
  return res.headers["set-cookie"] as string[];
}

describe("reservation gating", () => {
  let ctx: TestContext;
  let adminCookie: string[];
  let staffCookie: string[];
  let approvedProductId: number;
  let pickupId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedUser(ctx, "admin123", "admin1234", "ADMIN");
    await seedUser(ctx, "user123", "user1234", "STAFF");
    adminCookie = await login(ctx.app, "admin123", "admin1234");
    staffCookie = await login(ctx.app, "user123", "user1234");

    // A fully-approved product (has a FINAL image) is reservable.
    const created = await request(ctx.app)
      .post("/api/products")
      .set("Cookie", adminCookie)
      .send({ product_id: "RES-1", price: 3000, available_sizes: ["M"] });
    approvedProductId = created.body.product.id;
    await request(ctx.app)
      .post(`/api/products/${approvedProductId}/image`)
      .set("Cookie", adminCookie)
      .attach("image", PNG_1x1, { filename: "p.png", contentType: "image/png" });
    await request(ctx.app).post(`/api/products/${approvedProductId}/generate`).set("Cookie", adminCookie).send({});
    await request(ctx.app).post(`/api/products/${approvedProductId}/approve`).set("Cookie", adminCookie);

    const pickup = await request(ctx.app)
      .post("/api/pickups")
      .set("Cookie", adminCookie)
      .send({ address: "Bolt utca 1", start_at: "2999-01-01", end_at: "2999-01-02" });
    pickupId = pickup.body.option.id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it("blocks reservation of a product without a FINAL image", async () => {
    const draft = await request(ctx.app)
      .post("/api/products")
      .set("Cookie", adminCookie)
      .send({ product_id: "DRAFT-RES", price: 2000, available_sizes: ["M"] });
    const res = await request(ctx.app)
      .post("/api/reservations")
      .set("Cookie", staffCookie)
      .send({ product_id: draft.body.product.id, size: "M", pickup_id: pickupId });
    expect(res.status).toBe(400);
  });

  it("allows a valid reservation and then blocks a second active one (per product+user)", async () => {
    const first = await request(ctx.app)
      .post("/api/reservations")
      .set("Cookie", staffCookie)
      .send({ product_id: approvedProductId, size: "M", pickup_id: pickupId });
    expect(first.status).toBe(201);
    expect(first.body.reservation.canCancel).toBe(true);

    const second = await request(ctx.app)
      .post("/api/reservations")
      .set("Cookie", staffCookie)
      .send({ product_id: approvedProductId, size: "M", pickup_id: pickupId });
    expect(second.status).toBe(409);
  });

  it("marks canCancel=false when re-reserving after a cancel", async () => {
    // Cancel the existing active reservation.
    const mine = await request(ctx.app).get("/api/reservations/my").set("Cookie", staffCookie);
    const reservationId = mine.body.reservations[0].id;
    const cancelled = await request(ctx.app).delete(`/api/reservations/${reservationId}`).set("Cookie", staffCookie);
    expect(cancelled.status).toBe(200);

    // Re-reserve the same product: allowed, but no longer cancellable.
    const again = await request(ctx.app)
      .post("/api/reservations")
      .set("Cookie", staffCookie)
      .send({ product_id: approvedProductId, size: "M", pickup_id: pickupId });
    expect(again.status).toBe(201);
    expect(again.body.reservation.canCancel).toBe(false);
  });

  it("forbids a STAFF user from listing all reservations (ADMIN only)", async () => {
    const res = await request(ctx.app).get("/api/reservations").set("Cookie", staffCookie);
    expect(res.status).toBe(403);
  });
});
