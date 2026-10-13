import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createTestContext, type TestContext } from "./setup.js";

describe("metrics endpoint", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it("serves the health line as Prometheus text format on /metrics", async () => {
    const res = await request(ctx.app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/plain; version=0\.0\.4/);
    expect(res.text).toBe("up 1\n");
  });
});
