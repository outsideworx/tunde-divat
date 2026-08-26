import type { ReservationPayload } from "@fashion-mvp/shared";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

const includeReservation = {
  product: { include: { images: true, sizes: true } },
  pickup: true,
  user: { select: { id: true, username: true, email: true } }
};

export class ReservationService {
  async my(userId: number) {
    return prisma.reservation.findMany({
      where: { userId, cancelledAt: null },
      include: includeReservation,
      orderBy: { reservedAt: "desc" }
    });
  }

  async all() {
    return prisma.reservation.findMany({
      where: { cancelledAt: null },
      include: includeReservation,
      orderBy: { reservedAt: "desc" }
    });
  }

  async reserve(payload: ReservationPayload, userId: number) {
    const product = await prisma.product.findUnique({
      where: { id: payload.product_id },
      include: { sizes: true, images: true }
    });
    if (!product) throw new AppError(404, "Product not found");
    if (!product.images.some((image) => image.imageType === "FINAL")) {
      throw new AppError(400, "Ez a termék még nem foglalható.");
    }
    if (product.reservableUntil && Date.now() > product.reservableUntil.getTime()) {
      throw new AppError(400, "A foglalási határidő lejárt.");
    }
    if (!product.sizes.some((size) => size.size === payload.size)) {
      throw new AppError(400, "Ez a méret nem foglalható ennél a terméknél.");
    }
    const pickup = await prisma.pickupOption.findUnique({ where: { id: payload.pickup_id } });
    if (!pickup || !pickup.isActive) throw new AppError(400, "Válassz érvényes személyes átvételi időpontot.");
    const alreadyReserved = await prisma.reservation.findFirst({
      where: { productFk: product.id, userId, cancelledAt: null }
    });
    if (alreadyReserved) throw new AppError(409, "Ezt a terméket már lefoglaltad.");
    const hadCancelledBefore = await prisma.reservation.findFirst({
      where: { productFk: product.id, userId, cancelledAt: { not: null } }
    });
    return prisma.reservation.create({
      data: {
        productFk: product.id,
        userId,
        pickupFk: pickup.id,
        size: payload.size,
        quantity: payload.quantity ?? 1,
        canCancel: !hadCancelledBefore
      },
      include: includeReservation
    });
  }

  async cancel(id: number, userId: number) {
    const reservation = await prisma.reservation.findFirst({ where: { id, userId, cancelledAt: null } });
    if (!reservation) throw new AppError(404, "A foglalás nem található.");
    if (!reservation.canCancel) throw new AppError(400, "Ez a foglalás már nem mondható le.");
    return prisma.reservation.update({
      where: { id },
      data: { cancelledAt: new Date() },
      include: includeReservation
    });
  }
}
