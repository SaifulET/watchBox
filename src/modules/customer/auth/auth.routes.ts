import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import { NodemailerEmailProvider } from "../../../infrastructure/external/email/email-provider.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { CustomerAuthController } from "./auth.controller.js";
import { CustomerAuthService } from "./auth.service.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  sessionParamsSchema,
  verifyEmailConfirmSchema,
  verifyEmailRequestSchema
} from "./auth.validation.js";

export const createCustomerAuthRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const serviceDependencies: ConstructorParameters<typeof CustomerAuthService>[0] = {
    events: new DomainEventPublisher(dependencies.rabbitMq),
    email: new NodemailerEmailProvider()
  };
  if (dependencies.redis) {
    serviceDependencies.redis = dependencies.redis;
  }
  const service = new CustomerAuthService(serviceDependencies);
  const controller = new CustomerAuthController(service);
  const customerAuth = authenticate("customer");

  router.post("/register", validate({ body: registerSchema }), asyncHandler(controller.register));
  router.post("/login", validate({ body: loginSchema }), asyncHandler(controller.login));
  router.post("/refresh", validate({ body: refreshSchema }), asyncHandler(controller.refresh));
  router.post("/logout", customerAuth, asyncHandler(controller.logout));
  router.post("/logout-all", customerAuth, asyncHandler(controller.logoutAll));
  router.post(
    "/verify-email/request",
    validate({ body: verifyEmailRequestSchema }),
    asyncHandler(controller.requestEmailVerification)
  );
  router.post(
    "/verify-email/confirm",
    validate({ body: verifyEmailConfirmSchema }),
    asyncHandler(controller.confirmEmail)
  );
  router.post(
    "/forgot-password",
    validate({ body: forgotPasswordSchema }),
    asyncHandler(controller.forgotPassword)
  );
  router.post(
    "/reset-password",
    validate({ body: resetPasswordSchema }),
    asyncHandler(controller.resetPassword)
  );
  router.post(
    "/change-password",
    customerAuth,
    validate({ body: changePasswordSchema }),
    asyncHandler(controller.changePassword)
  );
  router.get("/sessions", customerAuth, asyncHandler(controller.sessions));
  router.delete(
    "/sessions/:sessionId",
    customerAuth,
    validate({ params: sessionParamsSchema }),
    asyncHandler(controller.revokeSession)
  );

  return router;
};
