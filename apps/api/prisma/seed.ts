import argon2 from "argon2";
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(process.cwd(), "../../.env") });
config();

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const inviteCode = process.env.SEED_INVITE_CODE;

  if (!adminUsername) throw new Error("SEED_ADMIN_USERNAME is required");
  if (!adminPassword) throw new Error("SEED_ADMIN_PASSWORD is required");
  if (!inviteCode) throw new Error("SEED_INVITE_CODE is required");

  const users = [
    {
      username: adminUsername,
      password: adminPassword,
      role: "ADMIN" as const
    }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        passwordHash: await argon2.hash(user.password, { type: argon2.argon2id }),
        role: user.role,
        isActive: true,
        privacyAcceptedAt: new Date()
      },
      create: {
        username: user.username,
        passwordHash: await argon2.hash(user.password, { type: argon2.argon2id }),
        privacyAcceptedAt: new Date(),
        isActive: true,
        role: user.role
      }
    });
    console.log(`Seed user ready: ${user.username} (${user.role})`);
  }

  await prisma.appSetting.upsert({
    where: { key: "REGISTRATION_INVITE_CODE" },
    update: { value: inviteCode },
    create: { key: "REGISTRATION_INVITE_CODE", value: inviteCode }
  });
  console.log("Registration invite code ready.");
}

main().finally(async () => {
  await prisma.$disconnect();
});
