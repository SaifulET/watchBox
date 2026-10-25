import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import { ChatService } from "./chat.service.js";

const createSchema = z.object({ recipientId: z.string().min(1), listingId: z.string().optional(), subject: z.string().max(240).optional(), message: z.string().max(4000).optional() }).strict();
const messageSchema = z.object({ content: z.string().trim().min(1).max(4000), messageType: z.enum(["text", "image", "file"]).optional(), fileUrl: z.string().url().optional() }).strict();
const paramsSchema = z.object({ chatId: z.string().min(1) });

export const createChatRouter = (): Router => {
  const router = Router();
  const service = new ChatService();
  const auth = authenticate("customer");
  const actor = (req: { auth?: { id: string } }) => req.auth!.id;
  router.get("/chats", auth, asyncHandler(async (req, res) => sendSuccess(res, req.requestId, await service.list(actor(req)))));
  router.post("/chats", auth, validate({ body: createSchema }), asyncHandler(async (req, res) => sendSuccess(res, req.requestId, await service.create(actor(req), req.body), 201)));
  router.get("/chats/:chatId/messages", auth, validate({ params: paramsSchema }), asyncHandler(async (req, res) => sendSuccess(res, req.requestId, await service.messages(actor(req), req.params.chatId!))));
  router.post("/chats/:chatId/messages", auth, validate({ params: paramsSchema, body: messageSchema }), asyncHandler(async (req, res) => {
    const result = await service.send(actor(req), req.params.chatId!, req.body);
    sendSuccess(res, req.requestId, result.message, 201);
  }));
  return router;
};
