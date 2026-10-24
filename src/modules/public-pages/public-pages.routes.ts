import { Router } from "express";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import { validate } from "../../common/middleware/validate.js";
import { DomainEventPublisher } from "../../common/services/domain-event-publisher.js";
import { NodemailerEmailProvider } from "../../infrastructure/external/email/email-provider.js";
import type { RouteDependencies } from "../../routes/index.js";
import { PublicPagesController } from "./public-pages.controller.js";
import { PublicPagesService } from "./public-pages.service.js";
import { publicAccountDeletionSchema, publicContactSchema } from "./public-pages.validation.js";

export const createPublicPagesRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const serviceDependencies: ConstructorParameters<typeof PublicPagesService>[0] = {
    events: new DomainEventPublisher(dependencies.rabbitMq),
    email: new NodemailerEmailProvider()
  };
  if (dependencies.redis) {
    serviceDependencies.redis = dependencies.redis;
  }
  const controller = new PublicPagesController(new PublicPagesService(serviceDependencies));

  router.post("/contact", validate({ body: publicContactSchema }), asyncHandler(controller.submitContact));
  router.post(
    "/account-deletion",
    validate({ body: publicAccountDeletionSchema }),
    asyncHandler(controller.deleteAccount)
  );

  return router;
};
