import { Router } from "express";
import { authenticate, authenticateOptional } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { DiscoveryController } from "./discovery.controller.js";
import { DiscoveryService } from "./discovery.service.js";

export const createDiscoveryRouter = (): Router => {
  const router = Router();
  const controller = new DiscoveryController(new DiscoveryService());
  const customerAuth = authenticate("customer");
  const optionalCustomerAuth = authenticateOptional("customer");

  // Search helpers
  router.get("/search/suggestions", optionalCustomerAuth, asyncHandler(controller.searchSuggestions));
  router.get("/search/popular", optionalCustomerAuth, asyncHandler(controller.popularSearches));
  router.get("/search/recent", customerAuth, asyncHandler(controller.recentSearches));
  router.post("/search/recent", customerAuth, asyncHandler(controller.recordRecentSearch));
  router.delete("/search/recent", customerAuth, asyncHandler(controller.clearRecentSearches));
  router.get("/search/facets", optionalCustomerAuth, asyncHandler(controller.searchFacets));

  // Discovery & catalog
  router.get("/brands", optionalCustomerAuth, asyncHandler(controller.brands));
  router.get("/watch-models", optionalCustomerAuth, asyncHandler(controller.watchModels));
  router.get("/recommendations/home", optionalCustomerAuth, asyncHandler(controller.recommendationsHome));
  router.get("/recommendations/for-you", optionalCustomerAuth, asyncHandler(controller.recommendationsForYou));
  router.get("/recommendations/trending", optionalCustomerAuth, asyncHandler(controller.recommendationsTrending));

  // Analytics
  router.get("/analytics/market-insights", optionalCustomerAuth, asyncHandler(controller.marketInsights));

  return router;
};
