import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { MarketplaceService } from "./marketplaces.service.js";
import {
  ebayAnalyticsQuerySchema,
  ebayLocationSearchSchema,
  ebayMarketInsightsQuerySchema,
  ebaySellerVerificationQuerySchema,
  ebaySearchQuerySchema,
  ebayShareListingBodySchema,
  ebayShareListingParamsSchema
} from "./marketplaces.validation.js";

const actorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class MarketplaceController {
  public constructor(private readonly service: MarketplaceService) {}

  public searchEbay = async (req: Request, res: Response): Promise<void> => {
    const query = ebaySearchQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.searchEbay(query));
  };

  public searchEbayByLocation = async (req: Request, res: Response): Promise<void> => {
    const body = ebayLocationSearchSchema.parse(req.body);
    sendSuccess(res, req.requestId, await this.service.searchEbayByLocation(body));
  };

  public ebayAnalytics = async (req: Request, res: Response): Promise<void> => {
    const query = ebayAnalyticsQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.ebayAnalytics(query));
  };

  public verifyEbaySeller = async (req: Request, res: Response): Promise<void> => {
    const query = ebaySellerVerificationQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.verifyEbaySeller(query));
  };

  public ebayMarketInsights = async (req: Request, res: Response): Promise<void> => {
    const query = ebayMarketInsightsQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.ebayMarketInsights(query));
  };

  public testEbayConnection = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.testEbayConnection());
  };

  public shareListingToEbay = async (req: Request, res: Response): Promise<void> => {
    const params = ebayShareListingParamsSchema.parse(req.params);
    const body = ebayShareListingBodySchema.parse(req.body);
    sendSuccess(
      res,
      req.requestId,
      await this.service.shareListingToEbay(actorId(req), params.listingId, body),
      201
    );
  };
}
