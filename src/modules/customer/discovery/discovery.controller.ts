import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { DiscoveryService } from "./discovery.service.js";

const queryString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const queryLimit = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const requireCustomerId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

const optionalCustomerId = (req: Request): string | undefined =>
  req.auth?.audience === "customer" ? req.auth.id : undefined;

export class DiscoveryController {
  public constructor(private readonly service: DiscoveryService) {}

  public searchSuggestions = async (req: Request, res: Response): Promise<void> => {
    const q = queryString(req.query.q) ?? queryString(req.query.query) ?? "";
    const limit = queryLimit(req.query.limit, 10);
    sendSuccess(res, req.requestId, await this.service.searchSuggestions(q, limit));
  };

  public popularSearches = async (req: Request, res: Response): Promise<void> => {
    const limit = queryLimit(req.query.limit, 10);
    sendSuccess(res, req.requestId, await this.service.popularSearches(limit));
  };

  public recentSearches = async (req: Request, res: Response): Promise<void> => {
    const limit = queryLimit(req.query.limit, 15);
    sendSuccess(res, req.requestId, await this.service.recentSearches(requireCustomerId(req), limit));
  };

  public recordRecentSearch = async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const query = queryString(body.query) ?? queryString(body.q) ?? "";
    const brand = queryString(body.brand);
    const model = queryString(body.model);
    sendSuccess(
      res,
      req.requestId,
      await this.service.recordRecentSearch(requireCustomerId(req), query, brand, model),
      201
    );
  };

  public clearRecentSearches = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.clearRecentSearches(requireCustomerId(req)));
  };

  public searchFacets = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.searchFacets());
  };

  public brands = async (req: Request, res: Response): Promise<void> => {
    const search = queryString(req.query.q) ?? queryString(req.query.search);
    sendSuccess(res, req.requestId, await this.service.listBrands(search));
  };

  public watchModels = async (req: Request, res: Response): Promise<void> => {
    const brand = queryString(req.query.brand);
    const search = queryString(req.query.q) ?? queryString(req.query.search);
    sendSuccess(res, req.requestId, await this.service.listWatchModels(brand, search));
  };

  public recommendationsHome = async (req: Request, res: Response): Promise<void> => {
    const limit = queryLimit(req.query.limit, 8);
    sendSuccess(
      res,
      req.requestId,
      await this.service.homeRecommendations(optionalCustomerId(req), limit)
    );
  };

  public recommendationsForYou = async (req: Request, res: Response): Promise<void> => {
    const limit = queryLimit(req.query.limit, 12);
    sendSuccess(
      res,
      req.requestId,
      await this.service.forYouRecommendations(optionalCustomerId(req), limit)
    );
  };

  public recommendationsTrending = async (req: Request, res: Response): Promise<void> => {
    const limit = queryLimit(req.query.limit, 12);
    sendSuccess(res, req.requestId, await this.service.trendingRecommendations(limit));
  };

  public marketInsights = async (req: Request, res: Response): Promise<void> => {
    const brand = queryString(req.query.brand);
    const model = queryString(req.query.model);
    const reference = queryString(req.query.reference) ?? queryString(req.query.referenceNumber);
    const filters: { brand?: string; model?: string; reference?: string } = {};
    if (brand) filters.brand = brand;
    if (model) filters.model = model;
    if (reference) filters.reference = reference;
    sendSuccess(res, req.requestId, await this.service.marketInsights(filters));
  };
}
