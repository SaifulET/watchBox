import { Router } from "express";
import { authenticate, authenticateOptional } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { SubscriptionsController } from "./subscriptions.controller.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import { changePlanSchema, checkoutSchema, portalSchema } from "./subscriptions.validation.js";

export const createSubscriptionsRouter = (): Router => {
  const router = Router();
  const controller = new SubscriptionsController(new SubscriptionsService());
  const customerAuth = authenticate("customer");
  const optionalCustomerAuth = authenticateOptional("customer");

  router.get("/subscription/plans", optionalCustomerAuth, asyncHandler(controller.plans));
  router.get("/subscriptions/plans", optionalCustomerAuth, asyncHandler(controller.plans));
  router.get("/plans", optionalCustomerAuth, asyncHandler(controller.plans));

  router.get("/subscription", customerAuth, asyncHandler(controller.status));
  router.get("/subscriptions/me", customerAuth, asyncHandler(controller.status));

  router.get("/subscription/usage", customerAuth, asyncHandler(controller.usage));
  router.get("/subscriptions/me/usage", customerAuth, asyncHandler(controller.usage));

  router.post(
    "/subscription/change-plan",
    customerAuth,
    validate({ body: changePlanSchema }),
    asyncHandler(controller.changePlan)
  );
  router.post(
    "/subscriptions/change-plan",
    customerAuth,
    validate({ body: changePlanSchema }),
    asyncHandler(controller.changePlan)
  );
  router.post(
    "/plans/change-plan",
    customerAuth,
    validate({ body: changePlanSchema }),
    asyncHandler(controller.changePlan)
  );

  router.post("/subscription/checkout", customerAuth, validate({ body: checkoutSchema }), asyncHandler(controller.checkout));
  router.post("/subscriptions/checkout", customerAuth, validate({ body: checkoutSchema }), asyncHandler(controller.checkout));
  router.post("/subscription/portal", customerAuth, validate({ body: portalSchema }), asyncHandler(controller.portal));
  router.post("/subscriptions/portal", customerAuth, validate({ body: portalSchema }), asyncHandler(controller.portal));
  router.post("/webhooks/stripe", asyncHandler(controller.stripeWebhook));
  router.post("/webhooks/revenuecat", asyncHandler(controller.revenueCatWebhook));

  return router;
};
