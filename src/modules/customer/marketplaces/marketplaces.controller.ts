import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { MarketplaceService } from "./marketplaces.service.js";
import {
  chrono24MarketInsightsQuerySchema,
  chrono24SearchQuerySchema,
  ebayAnalyticsQuerySchema,
  ebayLocationSearchSchema,
  ebayMarketInsightsQuerySchema,
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

  public searchChrono24 = async (req: Request, res: Response): Promise<void> => {
    const query = chrono24SearchQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.searchChrono24(query));
  };

  public chrono24MarketInsights = async (req: Request, res: Response): Promise<void> => {
    const query = chrono24MarketInsightsQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.chrono24MarketInsights(query));
  };

  public testChrono24Connection = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.testChrono24Connection());
  };

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
