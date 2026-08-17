import { Router } from "express";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireSingleImage } from "../../../common/middleware/image-upload.js";
import { validate } from "../../../common/middleware/validate.js";
import type { RedisClient } from "../../../infrastructure/redis/client.js";
import { Chrono24Controller } from "./chrono24.controller.js";
import { Chrono24Service } from "./chrono24.service.js";
import {
  chrono24AnalyticsQuerySchema,
  chrono24LocationSearchSchema,
  chrono24ProductParamsSchema,
  chrono24SearchBodySchema,
  chrono24SearchQuerySchema
} from "./chrono24.validation.js";

export type Chrono24RouteDependencies = {
  redis?: RedisClient | undefined;
};

export const createChrono24Router = (dependencies: Chrono24RouteDependencies = {}): Router => {
  const router = Router();
  const controller = new Chrono24Controller(new Chrono24Service(dependencies.redis));

  router.get("/search", validate({ query: chrono24SearchQuerySchema }), asyncHandler(controller.search));
  router.post(
    "/search",
    requireSingleImage(["image", "file", "photo"]),
    validate({ body: chrono24SearchBodySchema }),
    asyncHandler(controller.postSearch)
  );
  router.post(
    "/search-by-location",
    validate({ body: chrono24LocationSearchSchema }),
    asyncHandler(controller.searchByLocation)
  );
  router.get("/analytics", validate({ query: chrono24AnalyticsQuerySchema }), asyncHandler(controller.analytics));
  router.get("/market-insights", asyncHandler(controller.marketInsights));
  router.get(
    "/products/:id/similar",
    validate({ params: chrono24ProductParamsSchema }),
    asyncHandler(controller.similarProducts)
  );
  router.get(
    "/products/:id/recommendations",
    validate({ params: chrono24ProductParamsSchema }),
    asyncHandler(controller.recommendations)
  );
  router.get(
    "/products/:id",
    validate({ params: chrono24ProductParamsSchema }),
    asyncHandler(controller.productDetails)
  );

  return router;
};
