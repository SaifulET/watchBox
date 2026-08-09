import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { MarketplaceController } from "./marketplaces.controller.js";
import { MarketplaceService } from "./marketplaces.service.js";
import {
  ebayAnalyticsQuerySchema,
  ebayLocationSearchSchema,
  ebayMarketInsightsQuerySchema,
  ebaySearchQuerySchema,
  ebayShareListingBodySchema,
  ebayShareListingParamsSchema
} from "./marketplaces.validation.js";

export const createMarketplacesRouter = (): Router => {
  const router = Router();
  const controller = new MarketplaceController(new MarketplaceService());
  const customerAuth = authenticate("customer");

  router.get("/ebay/search", validate({ query: ebaySearchQuerySchema }), asyncHandler(controller.searchEbay));
  router.post(
    "/ebay/search-by-location",
    validate({ body: ebayLocationSearchSchema }),
    asyncHandler(controller.searchEbayByLocation)
  );
  router.get(
    "/ebay/analytics",
    validate({ query: ebayAnalyticsQuerySchema }),
    asyncHandler(controller.ebayAnalytics)
  );
  router.get(
    "/ebay/market-insights",
    validate({ query: ebayMarketInsightsQuerySchema }),
    asyncHandler(controller.ebayMarketInsights)
  );
  router.post(
    "/ebay/listings/:listingId/share",
    customerAuth,
    validate({ params: ebayShareListingParamsSchema, body: ebayShareListingBodySchema }),
    asyncHandler(controller.shareListingToEbay)
  );
  router.get("/ebay/connection", asyncHandler(controller.testEbayConnection));

  return router;
};
