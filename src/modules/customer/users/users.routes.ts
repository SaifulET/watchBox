import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { UserController } from "./users.controller.js";
import { UserService } from "./users.service.js";
import {
  confirmAvatarSchema,
  updateDarkModeSchema,
  updatePreferencesSchema,
  updateProfileSchema
} from "./users.validation.js";

export const createUsersRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const serviceDependencies: ConstructorParameters<typeof UserService>[0] = {
    events: new DomainEventPublisher(dependencies.rabbitMq)
  };
  if (dependencies.redis) {
    serviceDependencies.redis = dependencies.redis;
  }
  const service = new UserService(serviceDependencies);
  const controller = new UserController(service);
  const customerAuth = authenticate("customer");

  router.use(customerAuth);
  router.get("/me", asyncHandler(controller.me));
  router.patch("/me", validate({ body: updateProfileSchema }), asyncHandler(controller.updateMe));
  router.delete("/me", asyncHandler(controller.deleteMe));
  router.get("/me/activity", asyncHandler(controller.activity));
  router.get("/me/stats", asyncHandler(controller.stats));
  router.get("/me/preferences", asyncHandler(controller.preferences));
  router.patch(
    "/me/preferences",
    validate({ body: updatePreferencesSchema }),
    asyncHandler(controller.updatePreferences)
  );
  router.get("/me/dark-mode", asyncHandler(controller.darkMode));
  router.patch(
    "/me/dark-mode",
    validate({ body: updateDarkModeSchema }),
    asyncHandler(controller.updateDarkMode)
  );
  router.post("/me/avatar/upload-url", asyncHandler(controller.avatarUploadUrl));
  router.post(
    "/me/avatar/confirm",
    validate({ body: confirmAvatarSchema }),
    asyncHandler(controller.confirmAvatar)
  );
  router.delete("/me/avatar", asyncHandler(controller.deleteAvatar));

  return router;
};
