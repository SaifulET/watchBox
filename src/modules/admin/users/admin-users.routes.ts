import { Router, type RequestHandler } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { AuthorizationError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { AdminUsersController } from "./admin-users.controller.js";
import { AdminUsersService } from "./admin-users.service.js";
import {
  adminUserParamsSchema,
  adminUserStatusSchema,
  adminUsersQuerySchema
} from "./admin-users.validation.js";

export const createAdminUsersRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const service = new AdminUsersService({
    events: new DomainEventPublisher(dependencies.rabbitMq)
  });
  const controller = new AdminUsersController(service);

  router.use(authenticate("admin"));
  router.get(
    "/",
    requireAnyPermission("admin:users", "users.read"),
    validate({ query: adminUsersQuerySchema }),
    asyncHandler(controller.list)
  );
  router.get(
    "/summary",
    requireAnyPermission("admin:users", "users.read"),
    asyncHandler(controller.summary)
  );
  router.get(
    "/:userId",
    requireAnyPermission("admin:users", "users.read"),
    validate({ params: adminUserParamsSchema }),
    asyncHandler(controller.get)
  );
  router.patch(
    "/:userId/status",
    requireAnyPermission("admin:users", "users.suspend", "users.update"),
    validate({ params: adminUserParamsSchema, body: adminUserStatusSchema }),
    asyncHandler(controller.status)
  );
  router.post(
    "/:userId/suspend",
    requireAnyPermission("admin:users", "users.suspend"),
    validate({ params: adminUserParamsSchema }),
    asyncHandler(controller.suspend)
  );
  router.post(
    "/:userId/unsuspend",
    requireAnyPermission("admin:users", "users.suspend"),
    validate({ params: adminUserParamsSchema }),
    asyncHandler(controller.unsuspend)
  );

  return router;
};

const requireAnyPermission =
  (...permissions: string[]): RequestHandler =>
  (req, _res, next) => {
    const hasPermission = permissions.some((permission) => req.auth?.permissions.includes(permission));
    if (!hasPermission) {
      next(new AuthorizationError());
      return;
    }
    next();
  };
