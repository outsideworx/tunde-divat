import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import type { Express } from "express";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../../prisma/migrations");

// Ordered migration SQL files (Prisma names migrations with a sortable prefix).
const MIGRATIONS = [
  "20260831100000_initial_sqlite/migration.sql",
  "20260903120000_reservation_active_unique/migration.sql"
];

export type TestContext = {
  app: Express;
  prisma: import("@prisma/client").PrismaClient;
  dir: string;
  cleanup: () => Promise<void>;
};

// Boots an isolated API instance backed by a throwaway SQLite database and a
// temp upload directory. Env is set BEFORE importing modules that read it
// (config/env.ts validates env at import time), and the migration SQL is
// applied with the sqlite3 CLI to mirror the documented setup path.
export async function createTestContext(): Promise<TestContext> {
  const dir = mkdtempSync(path.join(tmpdir(), "tunde-divat-it-"));
  const dbFile = path.join(dir, "test.db");
  const uploadDir = path.join(dir, "uploads");

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = `file:${dbFile}`;
  process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters-long";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.UPLOAD_DIR = uploadDir;
  process.env.AI_PROVIDER = "mock";

  for (const migration of MIGRATIONS) {
    const sql = readFileSync(path.join(migrationsDir, migration), "utf8");
    execFileSync("sqlite3", [dbFile], { input: sql });
  }

  // Import lazily so the env above is in place first.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
  const { createApp } = await import("../../src/app.js");
  const app = createApp();

  return {
    app,
    prisma,
    dir,
    async cleanup() {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

export async function seedUser(
  ctx: TestContext,
  username: string,
  password: string,
  role: "ADMIN" | "STAFF" = "ADMIN"
) {
  return ctx.prisma.user.create({
    data: {
      username,
      role,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id })
    }
  });
}
