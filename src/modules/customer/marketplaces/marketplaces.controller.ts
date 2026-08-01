import type { Request, Response } from "express";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { MarketplaceService } from "./marketplaces.service.js";
import { ebayAnalyticsQuerySchema, ebaySearchQuerySchema } from "./marketplaces.validation.js";

export class MarketplaceController {
  public constructor(private readonly service: MarketplaceService) {}

  public searchEbay = async (req: Request, res: Response): Promise<void> => {
    const query = ebaySearchQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.searchEbay(query));
  };

  public ebayAnalytics = async (req: Request, res: Response): Promise<void> => {
    const query = ebayAnalyticsQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.ebayAnalytics(query));
  };

  public testEbayConnection = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.testEbayConnection());
  };
}
