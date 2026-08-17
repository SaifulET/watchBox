import { Router } from "express";
import { sendSuccess } from "../common/utils/api-response.js";
import { createAiRouter } from "../modules/customer/ai/ai.routes.js";
import { createCustomerAuthRouter } from "../modules/customer/auth/auth.routes.js";
import { createAdminContentRouter, createPublicContentRouter } from "../modules/customer/content/content.routes.js";
import { createDealerEbayRouter, createEbayRouter } from "../modules/customer/ebay/ebay.routes.js";
import { createListingImagesRouter } from "../modules/customer/listings/listing-images.routes.js";
import { createEbayWebhookRouter } from "../modules/customer/marketplaces/ebay-webhook.routes.js";
import { createListingsRouter } from "../modules/customer/listings/listings.routes.js";
import { createMarketplacesRouter } from "../modules/customer/marketplaces/marketplaces.routes.js";
import { createNotificationPreferencesRouter } from "../modules/customer/notification-preferences/notification-preferences.routes.js";
import { createSavedRouter } from "../modules/customer/saved/saved.routes.js";
import { createSubscriptionsRouter } from "../modules/customer/subscriptions/subscriptions.routes.js";
import { createUsersRouter } from "../modules/customer/users/users.routes.js";
import { createWatchAlertsRouter } from "../modules/customer/watch-alerts/watch-alerts.routes.js";
import { createGeneratedApiRouter } from "../modules/generated-api/generated-api.routes.js";
import type { RouteDependencies } from "./index.js";

export const createCustomerRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    sendSuccess(res, req.requestId, {
      name: "WatchBox Customer API",
      version: "0.1.0"
    });
  });

  router.use("/auth", createCustomerAuthRouter(dependencies));
  router.use("/ebay", createEbayRouter());
  router.use("/dealer", createDealerEbayRouter());
  router.use("/users", createUsersRouter(dependencies));
  router.use(createAiRouter());
  router.use("/content", createPublicContentRouter());
  router.use("/admin/settings/content", createAdminContentRouter());
  router.use("/listings", createListingsRouter());
  router.use("/listings", createListingImagesRouter());
  router.use("/marketplaces", createMarketplacesRouter(dependencies));
  router.use(createSavedRouter());
  router.use(createSubscriptionsRouter());
  router.use(createWatchAlertsRouter());
  router.use("/notification-preferences", createNotificationPreferencesRouter(dependencies));
  router.use(createEbayWebhookRouter());
  router.use(createGeneratedApiRouter(dependencies));

  return router;
};
