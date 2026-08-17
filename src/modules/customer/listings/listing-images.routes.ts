import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireSingleImage } from "../../../common/middleware/image-upload.js";
import { ListingImagesController } from "./listing-images.controller.js";
import { ListingImagesService } from "./listing-images.service.js";

export const createListingImagesRouter = (): Router => {
  const router = Router();
  const controller = new ListingImagesController(new ListingImagesService());
  const customerAuth = authenticate("customer");
  const acceptedImageFields = ["image", "file", "photo"];

  router.get("/:listingId/images", customerAuth, asyncHandler(controller.list));
  router.post("/:listingId/images", customerAuth, requireSingleImage(acceptedImageFields), asyncHandler(controller.upload));
  router.post(
    "/:listingId/images/upload",
    customerAuth,
    requireSingleImage(acceptedImageFields),
    asyncHandler(controller.upload)
  );

  return router;
};
