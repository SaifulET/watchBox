import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { PurchasesService } from "./purchases.service.js";
import type {
  ConfirmPaymentInput,
  CreateOrderInput,
  CreateProductPaymentIntentInput
} from "./purchases.validation.js";

const actorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

const routeParam = (req: Request, key: string): string => {
  const value = req.params[key];
  if (!value) {
    throw new AuthenticationError("Route parameter is required.");
  }
  return value;
};

export class PurchasesController {
  public constructor(private readonly service: PurchasesService) {}

  public paymentConfig = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, this.service.paymentConfig());
  };

  public createOrder = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.createOrder(actorId(req), req.body as CreateOrderInput), 201);
  };

  public createProductPaymentIntent = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.createProductPaymentIntent(
        actorId(req),
        routeParam(req, "productId"),
        req.body as CreateProductPaymentIntentInput
      ),
      201
    );
  };

  public createPaymentIntent = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.createPaymentIntent(actorId(req), routeParam(req, "orderId")));
  };

  public confirmPayment = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.confirmPayment(actorId(req), routeParam(req, "orderId"), req.body as ConfirmPaymentInput)
    );
  };
}
