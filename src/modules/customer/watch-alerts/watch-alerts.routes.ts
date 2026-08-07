import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { WatchAlertsController } from "./watch-alerts.controller.js";
import { WatchAlertsService } from "./watch-alerts.service.js";
import { watchAlertSchema } from "./watch-alerts.validation.js";

export const createWatchAlertsRouter = (): Router => {
  const router = Router();
  const controller = new WatchAlertsController(new WatchAlertsService());
  const customerAuth = authenticate("customer");

  router.post("/watch-alerts", customerAuth, validate({ body: watchAlertSchema }), asyncHandler(controller.create));
  router.get("/watch-alerts", customerAuth, asyncHandler(controller.list));
  router.delete("/watch-alerts/:alertId", customerAuth, asyncHandler(controller.delete));
  router.post("/watch-alerts/run", customerAuth, asyncHandler(controller.run));
  router.get("/watch-alert-events", customerAuth, asyncHandler(controller.events));

  return router;
};
