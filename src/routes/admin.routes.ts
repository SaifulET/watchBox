import { Router } from "express";
import { sendSuccess } from "../common/utils/api-response.js";
import { createAdministratorsRouter } from "../modules/admin/administrators/administrators.routes.js";
import { createAdminAuthRouter } from "../modules/admin/auth/auth.routes.js";
import { createBulkEmailRouter } from "../modules/admin/bulk-email/bulk-email.routes.js";
import { createAdminEarningsRouter } from "../modules/admin/earnings/earnings.routes.js";
import { createAdminSubscriptionsRouter } from "../modules/admin/subscriptions/admin-subscriptions.routes.js";
import { createAdminUsersRouter } from "../modules/admin/users/admin-users.routes.js";
import type { RouteDependencies } from "./index.js";

export const createAdminRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    sendSuccess(res, req.requestId, {
      name: "WatchBox Admin API",
      version: "0.1.0"
    });
  });

  router.use("/auth", createAdminAuthRouter(dependencies));
  router.use("/administrators", createAdministratorsRouter(dependencies));
  router.use("/bulk-email", createBulkEmailRouter(dependencies));
  router.use("/earnings", createAdminEarningsRouter());
  router.use("/subscriptions", createAdminSubscriptionsRouter());
  router.use("/users", createAdminUsersRouter(dependencies));

  return router;
};
