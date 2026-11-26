import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { CustomerNotificationController } from "./notifications.controller.js";
import { CustomerNotificationService } from "./notifications.service.js";
import {
  customerNotificationListQuerySchema,
  customerNotificationParamsSchema
} from "./notifications.validation.js";

export const createCustomerNotificationsRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const service = new CustomerNotificationService(
    dependencies.realtime ? { realtime: dependencies.realtime } : {}
  );
  const controller = new CustomerNotificationController(service);
  const customerAuth = authenticate("customer");

  router.use(customerAuth);
  router.get(
    "/",
    validate({ query: customerNotificationListQuerySchema }),
    asyncHandler(controller.list)
  );
  router.get("/unread-count", asyncHandler(controller.unreadCount));
  router.post("/read-all", asyncHandler(controller.markAllRead));
  router.delete("/", asyncHandler(controller.clearAll));
  router.get(
    "/:notificationId",
    validate({ params: customerNotificationParamsSchema }),
    asyncHandler(controller.getOne)
  );
  router.post(
    "/:notificationId/read",
    validate({ params: customerNotificationParamsSchema }),
    asyncHandler(controller.markRead)
  );
  router.delete(
    "/:notificationId",
    validate({ params: customerNotificationParamsSchema }),
    asyncHandler(controller.remove)
  );

  return router;
};
