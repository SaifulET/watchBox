import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { SubscriptionsController } from "./subscriptions.controller.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import { checkoutSchema, portalSchema } from "./subscriptions.validation.js";

export const createSubscriptionsRouter = (): Router => {
  const router = Router();
  const controller = new SubscriptionsController(new SubscriptionsService());
  const customerAuth = authenticate("customer");

  router.get("/subscription/plans", customerAuth, asyncHandler(controller.plans));
  router.get("/subscription", customerAuth, asyncHandler(controller.status));
  router.post("/subscription/checkout", customerAuth, validate({ body: checkoutSchema }), asyncHandler(controller.checkout));
  router.post("/subscription/portal", customerAuth, validate({ body: portalSchema }), asyncHandler(controller.portal));
  router.post("/webhooks/stripe", asyncHandler(controller.stripeWebhook));

  return router;
};
