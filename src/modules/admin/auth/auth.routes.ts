import { Router, type RequestHandler } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { AuthorizationError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import { NodemailerEmailProvider } from "../../../infrastructure/external/email/email-provider.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { AdminAccountModel } from "../../customer/auth/auth.model.js";
import { AdminAuthController } from "../../customer/auth/auth.controller.js";
import { AdminAuthService } from "../../customer/auth/auth.service.js";
import {
  adminRegisterSchema,
  adminMfaChallengeSchema,
  adminMfaVerifySchema,
  adminVerifyResetCodeSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  sessionParamsSchema
} from "../../customer/auth/auth.validation.js";

export const createAdminAuthRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const serviceDependencies: ConstructorParameters<typeof AdminAuthService>[0] = {
    events: new DomainEventPublisher(dependencies.rabbitMq),
    email: new NodemailerEmailProvider()
  };
  if (dependencies.redis) {
    serviceDependencies.redis = dependencies.redis;
  }
  const service = new AdminAuthService(serviceDependencies);
  const controller = new AdminAuthController(service);
  const adminAuth = authenticate("admin");
  const adminUsersAuth = requireAdminPermissions(adminAuth, "admin:users");

  router.post(
    "/register",
    validate({ body: adminRegisterSchema }),
    bootstrapOrRequireAdminUsers(adminUsersAuth),
    asyncHandler(controller.register)
  );
  router.post("/login", validate({ body: loginSchema }), asyncHandler(controller.login));
  router.post("/refresh", validate({ body: refreshSchema }), asyncHandler(controller.refresh));
  router.post("/logout", adminAuth, asyncHandler(controller.logout));
  router.post("/logout-all", adminAuth, asyncHandler(controller.logoutAll));
  router.post(
    "/forgot-password",
    validate({ body: forgotPasswordSchema }),
    asyncHandler(controller.forgotPassword)
  );
  router.post(
    "/verify-reset-code",
    validate({ body: adminVerifyResetCodeSchema }),
    asyncHandler(controller.verifyResetCode)
  );
  router.post(
    "/reset-password",
    validate({ body: resetPasswordSchema }),
    asyncHandler(controller.resetPassword)
  );
  router.post(
    "/change-password",
    adminAuth,
    validate({ body: changePasswordSchema }),
    asyncHandler(controller.changePassword)
  );
  router.get("/sessions", adminAuth, asyncHandler(controller.sessions));
  router.delete(
    "/sessions/:sessionId",
    adminAuth,
    validate({ params: sessionParamsSchema }),
    asyncHandler(controller.revokeSession)
  );
  router.post("/mfa/setup", adminAuth, asyncHandler(controller.setupMfa));
  router.post(
    "/mfa/verify",
    adminAuth,
    validate({ body: adminMfaVerifySchema }),
    asyncHandler(controller.verifyMfa)
  );
  router.post(
    "/mfa/challenge",
    validate({ body: adminMfaChallengeSchema }),
    asyncHandler(controller.challengeMfa)
  );
  router.delete("/mfa", adminAuth, asyncHandler(controller.disableMfa));
  router.get("/me/permissions", adminAuth, asyncHandler(controller.permissions));

  return router;
};

const requireAdminPermissions =
  (adminAuth: RequestHandler, ...permissions: string[]): RequestHandler =>
  (req, res, next) => {
    adminAuth(req, res, (authError) => {
      if (authError) {
        next(authError);
        return;
      }
      const hasPermissions = permissions.every((permission) => req.auth?.permissions.includes(permission));
      if (!hasPermissions) {
        next(new AuthorizationError());
        return;
      }
      next();
    });
  };

const bootstrapOrRequireAdminUsers =
  (adminUsersAuth: RequestHandler): RequestHandler =>
  (req, res, next) => {
    void (async () => {
      const existingAdmin = await AdminAccountModel.exists({ deletedAt: null });
      if (!existingAdmin) {
        next();
        return;
      }
      adminUsersAuth(req, res, next);
    })().catch(next);
  };
