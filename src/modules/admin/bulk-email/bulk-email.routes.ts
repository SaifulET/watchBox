import { Router, type RequestHandler } from "express";
import multer from "multer";
import { authenticate } from "../../../common/auth/authenticate.js";
import { AuthorizationError, ValidationError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import { NodemailerEmailProvider } from "../../../infrastructure/external/email/email-provider.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { BulkEmailController } from "./bulk-email.controller.js";
import { BulkEmailService } from "./bulk-email.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
    fieldSize: 25 * 1024 * 1024
  }
});

export const createBulkEmailRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const service = new BulkEmailService({
    events: new DomainEventPublisher(dependencies.rabbitMq),
    email: new NodemailerEmailProvider()
  });
  const controller = new BulkEmailController(service);

  router.use(authenticate("admin"));
  router.get("/recipients", requireAnyPermission("admin:bulk-email", "email.send", "admin:users"), asyncHandler(controller.recipients));
  router.get("/templates", requireAnyPermission("admin:bulk-email", "email.send", "admin:users"), asyncHandler(controller.templates));
  router.post(
    "/campaigns",
    requireAnyPermission("admin:bulk-email", "email.send", "admin:users"),
    attachmentsUpload,
    asyncHandler(controller.createCampaign)
  );
  router.post(
    "/campaigns/:campaignId/send",
    requireAnyPermission("admin:bulk-email", "email.send", "admin:users"),
    asyncHandler(controller.sendCampaign)
  );

  return router;
};

const attachmentsUpload: RequestHandler = (req, res, next) => {
  upload.array("attachments", 5)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new ValidationError([
          {
            path: "attachments",
            message: error.code === "LIMIT_FILE_SIZE" ? "Each attachment must be 10MB or smaller." : error.message
          }
        ])
      );
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
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
