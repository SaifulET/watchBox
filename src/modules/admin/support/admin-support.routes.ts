import { Router } from "express";
import { authenticate, requirePermissions } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { messageAttachmentsUpload } from "../../../common/middleware/message-attachment-upload.js";
import { validate } from "../../../common/middleware/validate.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { AdminSupportController } from "./admin-support.controller.js";
import { AdminSupportService } from "./admin-support.service.js";
import {
  adminSupportParamsSchema,
  adminSupportQuerySchema,
  adminSupportReplySchema
} from "./admin-support.validation.js";

export const createAdminSupportRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const serviceDependencies: ConstructorParameters<typeof AdminSupportService>[0] = {};
  if (dependencies.realtime) {
    serviceDependencies.realtime = dependencies.realtime;
  }
  const controller = new AdminSupportController(new AdminSupportService(serviceDependencies));

  router.use(authenticate("admin"));
  router.get(
    "/tickets",
    requirePermissions("reports.read"),
    validate({ query: adminSupportQuerySchema }),
    asyncHandler(controller.list)
  );
  router.get(
    "/tickets/:ticketId",
    requirePermissions("reports.read"),
    validate({ params: adminSupportParamsSchema }),
    asyncHandler(controller.get)
  );
  router.post(
    "/tickets/:ticketId/messages",
    requirePermissions("reports.resolve"),
    validate({ params: adminSupportParamsSchema }),
    messageAttachmentsUpload,
    validate({ body: adminSupportReplySchema }),
    asyncHandler(controller.reply)
  );

  return router;
};
