import { Router } from "express";
import { authenticate } from "../../common/auth/authenticate.js";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import { validate } from "../../common/middleware/validate.js";
import type { RouteDependencies } from "../../routes/index.js";
import { AdminNotificationService } from "./admin-notifications.service.js";
import { BlockService } from "./blocks.service.js";
import { ModerationController } from "./moderation.controller.js";
import {
  blockUserBodySchema,
  blockedUserParamsSchema,
  listingReportParamsSchema,
  reportListQuerySchema,
  reportParamsSchema,
  reportUserBodySchema
} from "./moderation.validation.js";
import { reportProofUpload } from "./proof-upload.js";
import { ReportService } from "./reports.service.js";

export const createCustomerModerationRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const notifications = new AdminNotificationService(
    dependencies.realtime ? { realtime: dependencies.realtime } : {}
  );
  const reports = new ReportService({
    ...(dependencies.realtime ? { realtime: dependencies.realtime } : {}),
    notifications
  });
  const controller = new ModerationController(new BlockService(), reports, notifications);
  const customerAuth = authenticate("customer");

  router.post(
    "/blocks",
    customerAuth,
    validate({ body: blockUserBodySchema }),
    asyncHandler(controller.block)
  );
  router.get("/blocks", customerAuth, asyncHandler(controller.listBlocks));
  router.get(
    "/blocks/:userId",
    customerAuth,
    validate({ params: blockedUserParamsSchema }),
    asyncHandler(controller.blockStatus)
  );
  router.delete(
    "/blocks/:userId",
    customerAuth,
    validate({ params: blockedUserParamsSchema }),
    asyncHandler(controller.unblock)
  );

  router.post(
    "/reports/user",
    customerAuth,
    reportProofUpload,
    validate({ body: reportUserBodySchema }),
    asyncHandler(controller.reportUser)
  );
  router.post(
    "/reports/listing",
    customerAuth,
    reportProofUpload,
    validate({ body: reportUserBodySchema }),
    asyncHandler(controller.reportUser)
  );
  router.post(
    "/listings/:listingId/report",
    customerAuth,
    validate({ params: listingReportParamsSchema }),
    reportProofUpload,
    validate({ body: reportUserBodySchema }),
    asyncHandler(controller.reportListing)
  );
  router.get(
    "/me/reports",
    customerAuth,
    validate({ query: reportListQuerySchema }),
    asyncHandler(controller.listMyReports)
  );
  router.get(
    "/me/reports/:reportId",
    customerAuth,
    validate({ params: reportParamsSchema }),
    asyncHandler(controller.getMyReport)
  );

  return router;
};
