import { Router } from "express";
import { sendSuccess } from "../common/utils/api-response.js";
import { createCustomerAuthRouter } from "../modules/customer/auth/auth.routes.js";
import { createNotificationPreferencesRouter } from "../modules/customer/notification-preferences/notification-preferences.routes.js";
import { createUsersRouter } from "../modules/customer/users/users.routes.js";
import { createGeneratedApiRouter } from "../modules/generated-api/generated-api.routes.js";
import type { RouteDependencies } from "./index.js";

export const createCustomerRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    sendSuccess(res, req.requestId, {
      name: "WatchBox Customer API",
      version: "0.1.0"
    });
  });

  router.use("/auth", createCustomerAuthRouter(dependencies));
  router.use("/users", createUsersRouter(dependencies));
  router.use("/notification-preferences", createNotificationPreferencesRouter(dependencies));
  router.use(createGeneratedApiRouter(dependencies));

  return router;
};
