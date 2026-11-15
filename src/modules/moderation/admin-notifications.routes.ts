import { Router } from "express";
import { authenticate, requirePermissions } from "../../common/auth/authenticate.js";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import { validate } from "../../common/middleware/validate.js";
import type { RouteDependencies } from "../../routes/index.js";
import { AdminNotificationService } from "./admin-notifications.service.js";
import { BlockService } from "./blocks.service.js";
import { ModerationController } from "./moderation.controller.js";
import {
  notificationListQuerySchema,
  notificationParamsSchema
} from "./moderation.validation.js";
import { ReportService } from "./reports.service.js";

export const createAdminNotificationsRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const notifications = new AdminNotificationService(
    dependencies.realtime ? { realtime: dependencies.realtime } : {}
  );
  const reports = new ReportService({
    ...(dependencies.realtime ? { realtime: dependencies.realtime } : {}),
    notifications
  });
  const controller = new ModerationController(new BlockService(), reports, notifications);

  router.use(authenticate("admin"));
  router.get(
    "/",
    requirePermissions("reports.read"),
    validate({ query: notificationListQuerySchema }),
    asyncHandler(controller.listNotifications)
  );
  router.get(
    "/unread-count",
    requirePermissions("reports.read"),
    asyncHandler(controller.unreadNotifications)
  );
  router.post(
    "/read-all",
    requirePermissions("reports.read"),
    asyncHandler(controller.readAllNotifications)
  );
  router.post(
    "/:notificationId/read",
    requirePermissions("reports.read"),
    validate({ params: notificationParamsSchema }),
    asyncHandler(controller.readNotification)
  );

  return router;
};
