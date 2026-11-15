import { Router } from "express";
import { authenticate, requirePermissions } from "../../common/auth/authenticate.js";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import { messageAttachmentsUpload } from "../../common/middleware/message-attachment-upload.js";
import { validate } from "../../common/middleware/validate.js";
import type { RouteDependencies } from "../../routes/index.js";
import { ChatController } from "./chats.controller.js";
import { ChatService } from "./chats.service.js";
import {
  adminOpenChatBodySchema,
  chatListQuerySchema,
  chatMessageBodySchema,
  chatParamsSchema
} from "./chats.validation.js";

export const createAdminChatsRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const serviceDependencies: ConstructorParameters<typeof ChatService>[0] = {};
  if (dependencies.realtime) {
    serviceDependencies.realtime = dependencies.realtime;
  }
  const controller = new ChatController(new ChatService(serviceDependencies));

  router.use(authenticate("admin"));
  router.get(
    "/",
    requirePermissions("reports.read"),
    validate({ query: chatListQuerySchema }),
    asyncHandler(controller.listAdmin)
  );
  router.post(
    "/",
    requirePermissions("reports.resolve"),
    messageAttachmentsUpload,
    validate({ body: adminOpenChatBodySchema }),
    asyncHandler(controller.openAdmin)
  );
  router.get(
    "/:chatId",
    requirePermissions("reports.read"),
    validate({ params: chatParamsSchema }),
    asyncHandler(controller.getAdmin)
  );
  router.post(
    "/:chatId/messages",
    requirePermissions("reports.resolve"),
    validate({ params: chatParamsSchema }),
    messageAttachmentsUpload,
    validate({ body: chatMessageBodySchema }),
    asyncHandler(controller.sendAdmin)
  );

  return router;
};
