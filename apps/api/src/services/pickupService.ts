import type { PickupOptionPayload } from "@fashion-mvp/shared";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

export class PickupService {
  async listActive() {
    return prisma.pickupOption.findMany({
      where: { isActive: true },
      orderBy: { startAt: "asc" }
    });
  }

  async create(payload: PickupOptionPayload, userId: number) {
    return prisma.pickupOption.create({
      data: {
        address: payload.address,
        startAt: payload.start_at,
        endAt: payload.end_at,
        createdBy: userId
      }
    });
  }

  async archive(id: number) {
    const pickup = await prisma.pickupOption.findUnique({ where: { id } });
    if (!pickup) throw new AppError(404, "Pickup option not found");
    return prisma.pickupOption.update({ where: { id }, data: { isActive: false } });
  }
}
