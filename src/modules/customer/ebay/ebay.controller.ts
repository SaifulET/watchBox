import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { EbayService } from "./ebay.service.js";
import {
  ebayConnectQuerySchema,
  ebayOAuthCallbackQuerySchema,
  ebayOAuthDeclinedQuerySchema,
  publishToEbayBodySchema,
  publishToEbayParamsSchema
} from "./ebay.validation.js";

const dealerId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class EbayController {
  public constructor(private readonly service: EbayService) {}

  public connect = (req: Request, res: Response): void => {
    const query = ebayConnectQuerySchema.parse(req.query);
    const authorizationUrl = this.service.connectUrl(dealerId(req));
    if (query.response === "json") {
      sendSuccess(res, req.requestId, { authorizationUrl });
      return;
    }
    res.redirect(authorizationUrl);
  };

  public oauthCallback = async (req: Request, res: Response): Promise<void> => {
    const query = ebayOAuthCallbackQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.handleOAuthCallback(query.code, query.state));
  };

  public oauthDeclined = (req: Request, res: Response): void => {
    const query = ebayOAuthDeclinedQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, this.service.handleOAuthDeclined(query.state));
  };

  public publishToEbay = async (req: Request, res: Response): Promise<void> => {
    const params = publishToEbayParamsSchema.parse(req.params);
    const body = publishToEbayBodySchema.parse(req.body);
    sendSuccess(
      res,
      req.requestId,
      await this.service.publishListingToEbay(dealerId(req), params.listingId, body),
      201
    );
  };
}
