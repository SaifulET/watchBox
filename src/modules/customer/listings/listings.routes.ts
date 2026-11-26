import { Router } from "express";
import { authenticate, authenticateOptional } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireSingleImage } from "../../../common/middleware/image-upload.js";
import { ListingsController } from "./listings.controller.js";
import { ListingsService } from "./listings.service.js";

export const createListingsRouter = (): Router => {
  const router = Router();
  const controller = new ListingsController(new ListingsService());
  const customerAuth = authenticate("customer");
  const optionalCustomerAuth = authenticateOptional("customer");
  const optionalImage = requireSingleImage(["image", "file", "photo"]);

  router.get("", optionalCustomerAuth, asyncHandler(controller.list));
  router.get("/", optionalCustomerAuth, asyncHandler(controller.list));
  router.post("", customerAuth, optionalImage, asyncHandler(controller.create));
  router.post("/", customerAuth, optionalImage, asyncHandler(controller.create));
  router.get("/:listingId", optionalCustomerAuth, asyncHandler(controller.getById));
  router.patch("/:listingId", customerAuth, optionalImage, asyncHandler(controller.update));
  router.delete("/:listingId", customerAuth, asyncHandler(controller.remove));

  for (const action of [
    "submit",
    "publish",
    "pause",
    "resume",
    "archive",
    "mark-sold",
    "reserve",
    "unreserve"
  ]) {
    router.post(`/:listingId/${action}`, customerAuth, asyncHandler(controller.transition(action)));
  }

  return router;
};

export const createMyListingsRouter = (): Router => {
  const router = Router();
  const controller = new ListingsController(new ListingsService());
  const customerAuth = authenticate("customer");

  router.use(customerAuth);
  router.get("", asyncHandler(controller.listMine()));
  router.get("/", asyncHandler(controller.listMine()));
  for (const bucket of ["drafts", "pending", "active", "paused", "rejected", "sold", "archived"]) {
    router.get(`/${bucket}`, asyncHandler(controller.listMine(bucket)));
  }

  return router;
};
