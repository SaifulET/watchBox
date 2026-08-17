import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireSingleImage } from "../../../common/middleware/image-upload.js";
import { ListingsController } from "./listings.controller.js";
import { ListingsService } from "./listings.service.js";

export const createListingsRouter = (): Router => {
  const router = Router();
  const controller = new ListingsController(new ListingsService());
  const customerAuth = authenticate("customer");
  const optionalImage = requireSingleImage(["image", "file", "photo"]);

  router.post("", customerAuth, optionalImage, asyncHandler(controller.create));
  router.post("/", customerAuth, optionalImage, asyncHandler(controller.create));
  router.patch("/:listingId", customerAuth, optionalImage, asyncHandler(controller.update));

  return router;
};
