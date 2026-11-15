import { Router } from "express";
import { authenticate } from "../../common/auth/authenticate.js";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import { messageAttachmentsUpload } from "../../common/middleware/message-attachment-upload.js";
import { validate } from "../../common/middleware/validate.js";
import type { RouteDependencies } from "../../routes/index.js";
import { ChatController } from "./chats.controller.js";
import { ChatService } from "./chats.service.js";
import {
  chatListQuerySchema,
  chatMessageBodySchema,
  chatParamsSchema,
  listingChatParamsSchema,
  openChatBodySchema
} from "./chats.validation.js";

export const createCustomerChatsRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const serviceDependencies: ConstructorParameters<typeof ChatService>[0] = {};
  if (dependencies.realtime) {
    serviceDependencies.realtime = dependencies.realtime;
  }
  const controller = new ChatController(new ChatService(serviceDependencies));
  const customerAuth = authenticate("customer");

  router.post(
    "/listings/:listingId/contact-seller",
    customerAuth,
    validate({ params: listingChatParamsSchema }),
    messageAttachmentsUpload,
    validate({ body: chatMessageBodySchema }),
    asyncHandler(controller.contactSeller)
  );
  router.get(
    "/chats",
    customerAuth,
    validate({ query: chatListQuerySchema }),
    asyncHandler(controller.listMine)
  );
  router.post(
    "/chats",
    customerAuth,
    messageAttachmentsUpload,
    validate({ body: openChatBodySchema }),
    asyncHandler(controller.openMine)
  );
  router.get(
    "/chats/:chatId",
    customerAuth,
    validate({ params: chatParamsSchema }),
    asyncHandler(controller.getMine)
  );
  router.post(
    "/chats/:chatId/messages",
    customerAuth,
    validate({ params: chatParamsSchema }),
    messageAttachmentsUpload,
    validate({ body: chatMessageBodySchema }),
    asyncHandler(controller.sendMine)
  );

  return router;
};
