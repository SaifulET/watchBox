import type { Request, Response } from "express";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { Chrono24Service } from "./chrono24.service.js";
import {
  chrono24AnalyticsQuerySchema,
  chrono24LocationSearchSchema,
  chrono24ProductParamsSchema,
  chrono24SearchBodySchema,
  chrono24SearchQuerySchema
} from "./chrono24.validation.js";

export class Chrono24Controller {
  public constructor(private readonly service: Chrono24Service) {}

  public search = async (req: Request, res: Response): Promise<void> => {
    const query = chrono24SearchQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.search(query));
  };

  public postSearch = async (req: Request, res: Response): Promise<void> => {
    const body = chrono24SearchBodySchema.parse(req.body);
    sendSuccess(res, req.requestId, await this.service.searchFromBody(body, req.file));
  };

  public productDetails = async (req: Request, res: Response): Promise<void> => {
    const params = chrono24ProductParamsSchema.parse(req.params);
    sendSuccess(res, req.requestId, await this.service.productDetails(params.id));
  };

  public similarProducts = async (req: Request, res: Response): Promise<void> => {
    const params = chrono24ProductParamsSchema.parse(req.params);
    sendSuccess(res, req.requestId, await this.service.similarProducts(params.id));
  };

  public recommendations = async (req: Request, res: Response): Promise<void> => {
    const params = chrono24ProductParamsSchema.parse(req.params);
    sendSuccess(res, req.requestId, await this.service.recommendations(params.id));
  };

  public analytics = async (req: Request, res: Response): Promise<void> => {
    const query = chrono24AnalyticsQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.analytics(query));
  };

  public marketInsights = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.marketInsights());
  };

  public searchByLocation = async (req: Request, res: Response): Promise<void> => {
    const body = chrono24LocationSearchSchema.parse(req.body);
    sendSuccess(res, req.requestId, await this.service.searchByLocation(body));
  };
}
