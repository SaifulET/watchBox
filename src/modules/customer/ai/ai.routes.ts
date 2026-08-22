import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireSingleImage } from "../../../common/middleware/image-upload.js";
import { validate } from "../../../common/middleware/validate.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { aiSearchBodySchema, imageAnalysisBodySchema } from "./ai.validation.js";

export const createAiRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const controller = new AiController(new AiService(dependencies.redis ? { redis: dependencies.redis } : {}));
  const customerAuth = authenticate("customer");
  const acceptedImageFields = ["image", "file", "photo"];
  const imageInput = [customerAuth, requireSingleImage(acceptedImageFields), validate({ body: imageAnalysisBodySchema })];
  const searchInput = [customerAuth, requireSingleImage(acceptedImageFields), validate({ body: aiSearchBodySchema })];

  router.post("/ai/analyze-image", ...imageInput, asyncHandler(controller.analyzeImage));
  router.post("/ai/search", ...searchInput, asyncHandler(controller.createSearch));
  router.post("/image-search", ...searchInput, asyncHandler(controller.createProductSearch));
  router.post("/image-search/ebay-direct", ...searchInput, asyncHandler(controller.createEbayDirectSearch));
  router.post("/image-search/visual", ...searchInput, asyncHandler(controller.createVisualImageSearch));
  router.get("/products/:source/:productId/details", customerAuth, asyncHandler(controller.getProductDetails));
  router.get("/image-search/recent", customerAuth, asyncHandler(controller.recentImageSearches));
  router.get("/image-search/:searchId", customerAuth, asyncHandler(controller.getImageSearch));
  router.get("/image-search/:searchId/results", customerAuth, asyncHandler(controller.getImageSearch));
  router.post(
    "/listings/:listingId/auto-detect",
    ...imageInput,
    asyncHandler(controller.autoDetectListing)
  );

  return router;
};
