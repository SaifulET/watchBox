import { Router, type RequestHandler } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { AuthorizationError } from "../../../common/errors/app-error.js";
import { requireSingleImage } from "../../../common/middleware/image-upload.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { AdministratorsController } from "./administrators.controller.js";
import { AdministratorsService } from "./administrators.service.js";

export const createAdministratorsRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const service = new AdministratorsService({
    events: new DomainEventPublisher(dependencies.rabbitMq)
  });
  const controller = new AdministratorsController(service);

  router.use(authenticate("admin"));
  router.get("/roles", requireAnyPermission("admin:users", "admins.read", "admins.create"), asyncHandler(controller.roles));
  router.get("/permissions", requireAnyPermission("admin:users", "admins.read", "admins.create"), asyncHandler(controller.permissions));
  router.post(
    "/",
    requireAnyPermission("admin:users", "admins.create"),
    requireSingleImage("image"),
    asyncHandler(controller.create)
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
