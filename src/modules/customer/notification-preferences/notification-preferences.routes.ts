import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { NotificationPreferencesController } from "./notification-preferences.controller.js";
import { NotificationPreferencesService } from "./notification-preferences.service.js";
import { updateNotificationPreferencesSchema } from "./notification-preferences.validation.js";

export const createNotificationPreferencesRouter = (
  dependencies: RouteDependencies = {}
): Router => {
  const router = Router();
  const service = new NotificationPreferencesService({
    events: new DomainEventPublisher(dependencies.rabbitMq)
  });
  const controller = new NotificationPreferencesController(service);

  router.use(authenticate("customer"));
  router.get("/", asyncHandler(controller.get));
  router.patch(
    "/",
    validate({ body: updateNotificationPreferencesSchema }),
    asyncHandler(controller.update)
  );

  return router;
};
