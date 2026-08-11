import { Router, type RequestHandler } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { AuthorizationError } from "../../../common/errors/app-error.js";
import { validate } from "../../../common/middleware/validate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { AdminSubscriptionsController } from "./admin-subscriptions.controller.js";
import { AdminSubscriptionsService } from "./admin-subscriptions.service.js";
import {
  planBodySchema,
  planFeaturesBodySchema,
  planParamsSchema,
  promotionBodySchema,
  promotionParamsSchema,
  settingsBodySchema
} from "./admin-subscriptions.validation.js";

export const createAdminSubscriptionsRouter = (): Router => {
  const router = Router();
  const controller = new AdminSubscriptionsController(new AdminSubscriptionsService());
  const readPermissions = [
    "admin:subscriptions",
    "subscriptions.read",
    "dashboard.read",
    "admin:dashboard"
  ];
  const writePermissions = [
    "admin:subscriptions",
    "subscriptions.create",
    "subscriptions.update",
    "admin:dashboard"
  ];

  router.use(authenticate("admin"));

  router.get("/plans", requireAnyPermission(...readPermissions), asyncHandler(controller.plans));
  router.post(
    "/plans",
    requireAnyPermission(...writePermissions),
    validate({ body: planBodySchema }),
    asyncHandler(controller.createPlan)
  );
  router.get(
    "/plans/:planId",
    requireAnyPermission(...readPermissions),
    validate({ params: planParamsSchema }),
    asyncHandler(controller.plan)
  );
  router.patch(
    "/plans/:planId",
    requireAnyPermission(...writePermissions),
    validate({ params: planParamsSchema, body: planBodySchema }),
    asyncHandler(controller.updatePlan)
  );
  router.delete(
    "/plans/:planId",
    requireAnyPermission("admin:subscriptions", "subscriptions.delete", "admin:dashboard"),
    validate({ params: planParamsSchema }),
    asyncHandler(controller.deletePlan)
  );
  router.post(
    "/plans/:planId/activate",
    requireAnyPermission(...writePermissions),
    validate({ params: planParamsSchema }),
    asyncHandler(controller.activatePlan)
  );
  router.post(
    "/plans/:planId/deactivate",
    requireAnyPermission(...writePermissions),
    validate({ params: planParamsSchema }),
    asyncHandler(controller.deactivatePlan)
  );
  router.post(
    "/plans/:planId/duplicate",
    requireAnyPermission(...writePermissions),
    validate({ params: planParamsSchema }),
    asyncHandler(controller.duplicatePlan)
  );
  router.patch(
    "/plans/:planId/features",
    requireAnyPermission(...writePermissions),
    validate({ params: planParamsSchema, body: planFeaturesBodySchema }),
    asyncHandler(controller.updatePlanFeatures)
  );

  router.get(
    "/settings",
    requireAnyPermission(...readPermissions),
    asyncHandler(controller.settings)
  );
  router.patch(
    "/settings",
    requireAnyPermission(...writePermissions),
    validate({ body: settingsBodySchema }),
    asyncHandler(controller.updateSettings)
  );

  router.get(
    "/promotions",
    requireAnyPermission(...readPermissions),
    asyncHandler(controller.promotions)
  );
  router.post(
    "/promotions",
    requireAnyPermission(...writePermissions),
    validate({ body: promotionBodySchema }),
    asyncHandler(controller.createPromotion)
  );
  router.patch(
    "/promotions/:promotionId",
    requireAnyPermission(...writePermissions),
    validate({ params: promotionParamsSchema, body: promotionBodySchema }),
    asyncHandler(controller.updatePromotion)
  );
  router.delete(
    "/promotions/:promotionId",
    requireAnyPermission(...writePermissions),
    validate({ params: promotionParamsSchema }),
    asyncHandler(controller.deletePromotion)
  );
  router.post(
    "/promotions/:promotionId/activate",
    requireAnyPermission(...writePermissions),
    validate({ params: promotionParamsSchema }),
    asyncHandler(controller.activatePromotion)
  );
  router.post(
    "/promotions/:promotionId/deactivate",
    requireAnyPermission(...writePermissions),
    validate({ params: promotionParamsSchema }),
    asyncHandler(controller.deactivatePromotion)
  );

  router.get(
    "/actions",
    requireAnyPermission(...readPermissions),
    asyncHandler(controller.recentActions)
  );

  return router;
};

const requireAnyPermission =
  (...permissions: string[]): RequestHandler =>
  (req, _res, next) => {
    const hasPermission = permissions.some((permission) =>
      req.auth?.permissions.includes(permission)
    );
    if (!hasPermission) {
      next(new AuthorizationError());
      return;
    }
    next();
  };
