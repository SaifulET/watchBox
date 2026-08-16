import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { EbayController } from "./ebay.controller.js";
import { EbayService } from "./ebay.service.js";

export const createEbayRouter = (): Router => {
  const router = Router();
  const controller = new EbayController(new EbayService());

  router.get("/connect", authenticate("customer"), controller.connect);
  router.get("/status", authenticate("customer"), asyncHandler(controller.status));
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
