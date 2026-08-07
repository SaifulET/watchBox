import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { SavedController } from "./saved.controller.js";
import { SavedService } from "./saved.service.js";
import { savedProductSchema, savedSearchSchema } from "./saved.validation.js";

export const createSavedRouter = (): Router => {
  const router = Router();
  const controller = new SavedController(new SavedService());
  const customerAuth = authenticate("customer");

  router.post("/saved-products", customerAuth, validate({ body: savedProductSchema }), asyncHandler(controller.saveProduct));
  router.get("/saved-products", customerAuth, asyncHandler(controller.savedProducts));
  router.post("/saved-searches", customerAuth, validate({ body: savedSearchSchema }), asyncHandler(controller.saveSearch));
  router.get("/saved-searches", customerAuth, asyncHandler(controller.savedSearches));
  router.get("/recommended-products", customerAuth, asyncHandler(controller.recommendedProducts));

  return router;
};
