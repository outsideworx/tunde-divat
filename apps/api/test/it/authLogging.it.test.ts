import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createTestContext, seedUser, type TestContext } from "./setup.js";

type LogRecord = { level: string; event: string; outcome?: string; [key: string]: unknown };

function parseRecords(spy: ReturnType<typeof vi.spyOn>): LogRecord[] {
  return spy.mock.calls
    .map((call) => call[0])
    .filter((arg): arg is string => typeof arg === "string")
    .map((line) => JSON.parse(line) as LogRecord);
}

describe("auth logging", () => {
  let ctx: TestContext;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedUser(ctx, "logadmin", "logadmin1234", "ADMIN");
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("emits a login/success info record on valid credentials", async () => {
    const res = await request(ctx.app).post("/api/auth/login").send({ username: "logadmin", password: "logadmin1234" });
    expect(res.status).toBe(200);
    const record = parseRecords(infoSpy).find((r) => r.event === "login");
    expect(record).toMatchObject({ level: "info", event: "login", outcome: "success", username: "logadmin" });
  });

  it("emits a login/failure warn record on invalid credentials and never leaks the password", async () => {
    const res = await request(ctx.app).post("/api/auth/login").send({ username: "logadmin", password: "wrong-password" });
    expect(res.status).toBe(401);
    const record = parseRecords(warnSpy).find((r) => r.event === "login");
    expect(record).toMatchObject({ level: "warn", event: "login", outcome: "failure", username: "logadmin" });
    expect(JSON.stringify(record)).not.toContain("wrong-password");
    expect(record).not.toHaveProperty("password");
  });

  it("emits a logout/success info record", async () => {
    const login = await request(ctx.app).post("/api/auth/login").send({ username: "logadmin", password: "logadmin1234" });
    const cookie = login.headers["set-cookie"] as unknown as string[];
    infoSpy.mockClear();
    const res = await request(ctx.app).post("/api/auth/logout").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const record = parseRecords(infoSpy).find((r) => r.event === "logout");
    expect(record).toMatchObject({ level: "info", event: "logout", outcome: "success", username: "logadmin" });
  });
});
