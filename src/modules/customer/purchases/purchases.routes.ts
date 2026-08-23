import { Router } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { PurchasesController } from "./purchases.controller.js";
import { PurchasesService } from "./purchases.service.js";
import {
  confirmPaymentSchema,
  createOrderSchema,
  createProductPaymentIntentSchema,
  paymentIntentSchema
} from "./purchases.validation.js";

export const createPurchasesRouter = (): Router => {
  const router = Router();
  const controller = new PurchasesController(new PurchasesService());
  const customerAuth = authenticate("customer");

  router.get("/payments/config", asyncHandler(controller.paymentConfig));
  router.post(
    "/payments/products/:productId/payment-intent",
    customerAuth,
    validate({ body: createProductPaymentIntentSchema }),
    asyncHandler(controller.createProductPaymentIntent)
  );
  router.post("/orders", customerAuth, validate({ body: createOrderSchema }), asyncHandler(controller.createOrder));
  router.post(
    "/orders/:orderId/payment-intent",
    customerAuth,
    validate({ body: paymentIntentSchema }),
    asyncHandler(controller.createPaymentIntent)
  );
  router.post(
    "/orders/:orderId/confirm-payment",
    customerAuth,
    validate({ body: confirmPaymentSchema }),
    asyncHandler(controller.confirmPayment)
  );

  return router;
};
