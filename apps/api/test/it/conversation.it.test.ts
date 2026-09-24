import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import sharp from "sharp";
import { createTestContext, seedUser, type TestContext } from "./setup.js";

const PNG = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#d8c1c4" } }).png().toBuffer();

async function login(app: Express, username: string, password: string) {
  const response = await request(app).post("/api/auth/login").send({ username, password });
  expect(response.status).toBe(200);
  return response.headers["set-cookie"] as string[];
}

describe("product conversations", () => {
  let ctx: TestContext;
  let adminCookie: string[];
  let staffCookie: string[];
  let productId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedUser(ctx, "admin123", "admin1234", "ADMIN");
    await seedUser(ctx, "user123", "user1234", "STAFF");
    adminCookie = await login(ctx.app, "admin123", "admin1234");
    staffCookie = await login(ctx.app, "user123", "user1234");
    const product = await request(ctx.app).post("/api/products").set("Cookie", adminCookie)
      .send({ product_id: "CHAT-1", product_name: "Bordó kabát", price: 9900, available_sizes: ["M"] });
    productId = product.body.product.id;
    await request(ctx.app).post(`/api/products/${productId}/image`).set("Cookie", adminCookie)
      .attach("image", PNG, { filename: "coat.png", contentType: "image/png" });
    await request(ctx.app).post(`/api/products/${productId}/generate`).set("Cookie", adminCookie).send({});
    await request(ctx.app).post(`/api/products/${productId}/approve`).set("Cookie", adminCookie);
  });

  afterAll(async () => ctx.cleanup());

  it("keeps a single continuous product conversation and tracks read status", async () => {
    const opened = await request(ctx.app).post("/api/conversations").set("Cookie", staffCookie).send({ product_id: productId });
    expect(opened.status).toBe(201);
    const conversationId = opened.body.conversation.id;

    const openedAgain = await request(ctx.app).post("/api/conversations").set("Cookie", staffCookie).send({ product_id: productId });
    expect(openedAgain.status).toBe(201);
    expect(openedAgain.body.conversation.id).toBe(conversationId);

    const sent = await request(ctx.app).post(`/api/conversations/${conversationId}/messages`).set("Cookie", staffCookie)
      .send({ body: "Mennyire rugalmas az M-es méret?" });
    expect(sent.status).toBe(201);

    const unread = await request(ctx.app).get("/api/conversations/unread-count").set("Cookie", adminCookie);
    expect(unread.body.count).toBe(1);

    const adminList = await request(ctx.app).get("/api/conversations").set("Cookie", adminCookie);
    expect(adminList.status).toBe(200);
    expect(adminList.body.conversations[0].product.productName).toBe("Bordó kabát");
    expect(adminList.body.conversations[0].messages[0].readAt).toBeNull();

    const openedByAdmin = await request(ctx.app).get(`/api/conversations/${conversationId}`).set("Cookie", adminCookie);
    expect(openedByAdmin.status).toBe(200);
    expect(openedByAdmin.body.conversation.messages[0].readAt).toBeTruthy();

    const reply = await request(ctx.app).post(`/api/conversations/${conversationId}/messages`).set("Cookie", adminCookie)
      .send({ body: "Igen, az anyaga rugalmas, az M-es méret kényelmes választás." });
    expect(reply.status).toBe(201);

    const customerUnread = await request(ctx.app).get("/api/conversations/unread-count").set("Cookie", staffCookie);
    expect(customerUnread.status).toBe(200);
    expect(customerUnread.body.count).toBe(1);

    const customerList = await request(ctx.app).get("/api/conversations/mine").set("Cookie", staffCookie);
    expect(customerList.status).toBe(200);
    expect(customerList.body.conversations[0].unreadCount).toBe(1);
    expect(customerList.body.conversations[0].messages.at(-1).readAt).toBeNull();

    const openedByCustomer = await request(ctx.app).get(`/api/conversations/${conversationId}`).set("Cookie", staffCookie);
    expect(openedByCustomer.status).toBe(200);
    expect(openedByCustomer.body.conversation.messages.at(-1).readAt).toBeTruthy();
  });
});
