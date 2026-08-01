import { Router } from "express";
import { authenticate, requirePermissions } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireSingleImage } from "../../../common/middleware/image-upload.js";
import { validate } from "../../../common/middleware/validate.js";
import { ContentController } from "./content.controller.js";
import { ContentService } from "./content.service.js";
import { contentParamsSchema, contentUpsertBodySchema } from "./content.validation.js";

export const createPublicContentRouter = (): Router => {
  const router = Router();
  const controller = new ContentController(new ContentService());

  router.get("/:slug", validate({ params: contentParamsSchema }), asyncHandler(controller.publicPage));

  return router;
};

export const createAdminContentRouter = (): Router => {
  const router = Router();
  const controller = new ContentController(new ContentService());
  const adminAuth = [authenticate("admin"), requirePermissions("admin:settings")];
  const imageUpload = requireSingleImage(["image", "file", "photo"]);

  router.get("", ...adminAuth, asyncHandler(controller.listPages));
  router.get("/", ...adminAuth, asyncHandler(controller.listPages));
  router.get("/:slug", ...adminAuth, validate({ params: contentParamsSchema }), asyncHandler(controller.getPage));
  router.post(
    "/:slug",
    ...adminAuth,
    imageUpload,
    validate({ params: contentParamsSchema, body: contentUpsertBodySchema }),
    asyncHandler(controller.createPage)
  );
  router.patch(
    "/:slug",
    ...adminAuth,
    imageUpload,
    validate({ params: contentParamsSchema, body: contentUpsertBodySchema }),
    asyncHandler(controller.updatePage)
  );

  return router;
};
