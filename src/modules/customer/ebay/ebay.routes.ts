import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import type { RouteDependencies } from "../../../routes/index.js";
import { MarketplaceController } from "../marketplaces/marketplaces.controller.js";
import { MarketplaceService } from "../marketplaces/marketplaces.service.js";
import { ebaySearchQuerySchema } from "../marketplaces/marketplaces.validation.js";
import { EbayController } from "./ebay.controller.js";
import { EbayService } from "./ebay.service.js";

export const createEbayRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const controller = new EbayController(new EbayService());
  const marketplaceController = new MarketplaceController(new MarketplaceService(dependencies.redis));

  router.get("/search", validate({ query: ebaySearchQuerySchema }), asyncHandler(marketplaceController.searchEbay));
  router.get("/connect", authenticate("customer"), controller.connect);
  router.get("/status", authenticate("customer"), asyncHandler(controller.status));
  router.post("/disconnect", authenticate("customer"), asyncHandler(controller.disconnect));
  router.get("/oauth/callback", asyncHandler(controller.oauthCallback));
  router.get("/oauth/declined", controller.oauthDeclined);

  return router;
};

export const createDealerEbayRouter = (): Router => {
  const router = Router();
  const controller = new EbayController(new EbayService());

  router.post(
    "/listings/:listingId/publish-to-ebay",
    authenticate("customer"),
    asyncHandler(controller.publishToEbay)
  );

  return router;
};
