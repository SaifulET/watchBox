import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { SubscriptionsService } from "./subscriptions.service.js";
import type { CheckoutInput, PortalInput } from "./subscriptions.validation.js";

const actorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class SubscriptionsController {
  public constructor(private readonly service: SubscriptionsService) {}

  public plans = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, this.service.plans());
  };

  public status = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.status(actorId(req)));
  };

  public checkout = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.checkout(actorId(req), req.body as CheckoutInput), 201);
  };

  public portal = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.portal(actorId(req), req.body as PortalInput));
  };

  public stripeWebhook = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.handleStripeWebhook(req.rawBody, req.header("stripe-signature"), req.body)
    );
  };
}
