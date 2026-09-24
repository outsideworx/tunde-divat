import type { ConversationCreatePayload, ConversationMessagePayload } from "@fashion-mvp/shared";
import type { AuthUser } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

const conversationInclude = {
  product: { include: { images: true, sizes: true } },
  user: { select: { id: true, username: true, role: true } },
  messages: {
    include: { sender: { select: { id: true, username: true, role: true } } },
    orderBy: { createdAt: "asc" as const }
  }
};

export class ConversationService {
  private async markIncomingAsRead(user: AuthUser, conversationId?: number) {
    const where = user.role === "ADMIN"
      ? { readAt: null, sender: { role: "STAFF" as const }, ...(conversationId ? { conversationFk: conversationId } : {}) }
      : { readAt: null, sender: { role: "ADMIN" as const }, conversation: { userId: user.id }, ...(conversationId ? { conversationFk: conversationId } : {}) };
    await prisma.conversationMessage.updateMany({ where, data: { readAt: new Date() } });
  }

  private decorate<T extends { messages: Array<{ senderId: number; readAt: Date | null }> }>(conversations: T[], viewerId: number) {
    return conversations.map((conversation) => ({
      ...conversation,
      unreadCount: conversation.messages.filter((message) => message.senderId !== viewerId && !message.readAt).length
    }));
  }

  async list(user: AuthUser) {
    const conversations = await prisma.conversation.findMany({
      where: user.role === "ADMIN" ? {} : { userId: user.id },
      include: conversationInclude,
      orderBy: { updatedAt: "desc" }
    });
    return this.decorate(conversations, user.id);
  }

  async open(payload: ConversationCreatePayload, user: AuthUser) {
    if (user.role === "ADMIN") throw new AppError(403, "Beszélgetést a vásárlói nézetből lehet indítani.");
    const product = await prisma.product.findFirst({ where: { id: payload.product_id, status: "APPROVED" } });
    if (!product) throw new AppError(404, "Ez a termék jelenleg nem érhető el beszélgetés indításához.");
    const conversation = await prisma.conversation.upsert({
      where: { productFk_userId: { productFk: product.id, userId: user.id } },
      update: {},
      create: { productFk: product.id, userId: user.id },
      include: conversationInclude
    });
    return { ...conversation, unreadCount: 0 };
  }

  async send(conversationId: number, payload: ConversationMessagePayload, user: AuthUser) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }
    });
    if (!conversation) throw new AppError(404, "A beszélgetés nem található.");
    await prisma.conversationMessage.create({
      data: { conversationFk: conversation.id, senderId: user.id, body: payload.body }
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return this.get(conversation.id, user);
  }

  async get(conversationId: number, user: AuthUser) {
    const permitted = await prisma.conversation.findFirst({
      where: { id: conversationId, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }
    });
    if (!permitted) throw new AppError(404, "A beszélgetés nem található.");
    await this.markIncomingAsRead(user, conversationId);
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: conversationInclude });
    return { ...conversation, unreadCount: 0 };
  }

  async unreadCount(user: AuthUser) {
    const where = user.role === "ADMIN"
      ? { readAt: null, sender: { role: "STAFF" as const } }
      : { readAt: null, sender: { role: "ADMIN" as const }, conversation: { userId: user.id } };
    return prisma.conversationMessage.count({ where });
  }
}
