import { Router } from "express";
import { conversationCreatePayloadSchema, conversationMessagePayloadSchema } from "@fashion-mvp/shared";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/errors.js";
import { ConversationService } from "../services/conversationService.js";

export const conversationRoutes = Router();
const conversations = new ConversationService();

conversationRoutes.use(requireAuth);

conversationRoutes.get("/unread-count", asyncHandler(async (req, res) => {
  res.json({ count: await conversations.unreadCount(req.user!) });
}));

conversationRoutes.get("/mine", asyncHandler(async (req, res) => {
  res.json({ conversations: await conversations.list(req.user!) });
}));

conversationRoutes.get("/", asyncHandler(async (req, res) => {
  res.json({ conversations: await conversations.list(req.user!) });
}));

conversationRoutes.post("/", asyncHandler(async (req, res) => {
  const payload = conversationCreatePayloadSchema.parse(req.body);
  res.status(201).json({ conversation: await conversations.open(payload, req.user!) });
}));

conversationRoutes.get("/:id", asyncHandler(async (req, res) => {
  res.json({ conversation: await conversations.get(Number(req.params.id), req.user!) });
}));

conversationRoutes.post("/:id/messages", asyncHandler(async (req, res) => {
  const payload = conversationMessagePayloadSchema.parse(req.body);
  res.status(201).json({ conversation: await conversations.send(Number(req.params.id), payload, req.user!) });
}));
