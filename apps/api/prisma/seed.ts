import argon2 from "argon2";
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(process.cwd(), "../../.env") });
config();

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      username: process.env.SEED_ADMIN_USERNAME ?? "admin123",
      password: process.env.SEED_ADMIN_PASSWORD ?? "admin1234",
      role: "ADMIN" as const
    },
    {
      username: process.env.SEED_DUMMY_USERNAME ?? "user123",
      password: process.env.SEED_DUMMY_PASSWORD ?? "user1234",
      role: "STAFF" as const
    }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        passwordHash: await argon2.hash(user.password, { type: argon2.argon2id }),
        role: user.role
      },
      create: {
        username: user.username,
        passwordHash: await argon2.hash(user.password, { type: argon2.argon2id }),
        role: user.role
      }
    });
    console.log(`Seed user ready: ${user.username} (${user.role})`);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
