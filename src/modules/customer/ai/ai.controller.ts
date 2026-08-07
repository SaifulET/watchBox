import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { AiService } from "./ai.service.js";
import type { AiSearchBody, ImageAnalysisBody } from "./ai.validation.js";
import type { AiImageInput } from "./ai.types.js";

type ControllerImageInput = AiImageInput & {
  file?: Express.Multer.File;
};

type ControllerSearchInput = ControllerImageInput & {
  q?: string;
  keyword?: string;
  query?: string;
  search?: string;
  brand?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  listingStatus?: "active" | "historical_sold";
  condition?: "new" | "unworn" | "very_good" | "vintage";
  region?: string;
  limit: number;
  marketplaceId?: string;
};

const actor = (req: Request) => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return {
    id: req.auth.id,
    audience: req.auth.audience
  };
};

const imageInput = (body: ImageAnalysisBody, file: Express.Multer.File | undefined): ControllerImageInput => {
  const input: ControllerImageInput = {};
  if (body.imageUrl) {
    input.imageUrl = body.imageUrl;
  }
  if (body.modelVersion) {
    input.modelVersion = body.modelVersion;
  }
  if (file) {
    input.file = file;
  }
  return input;
};

const searchInput = (body: AiSearchBody, file: Express.Multer.File | undefined): ControllerSearchInput => {
  const input: ControllerSearchInput = {
    limit: body.limit
  };
  if (body.q) {
    input.q = body.q;
  }
  if (body.keyword) {
    input.keyword = body.keyword;
  }
  if (body.query) {
    input.query = body.query;
  }
  if (body.search) {
    input.search = body.search;
  }
  if (body.brand) {
    input.brand = body.brand;
  }
  if (body.model) {
    input.model = body.model;
  }
  const minPrice = body.minPrice ?? body.priceMin;
  const maxPrice = body.maxPrice ?? body.priceMax;
  if (typeof minPrice === "number") {
    input.minPrice = minPrice;
  }
  if (typeof maxPrice === "number") {
    input.maxPrice = maxPrice;
  }
  if (body.listingStatus) {
    input.listingStatus = body.listingStatus === "active" ? "active" : "historical_sold";
  }
  if (body.condition) {
    const condition = body.condition.replace(" ", "_");
    if (condition === "new" || condition === "unworn" || condition === "very_good" || condition === "vintage") {
      input.condition = condition;
    }
  }
  if (body.region) {
    input.region = body.region;
  }
  if (body.imageUrl) {
    input.imageUrl = body.imageUrl;
  }
  if (body.modelVersion) {
    input.modelVersion = body.modelVersion;
  }
  if (body.marketplaceId) {
    input.marketplaceId = body.marketplaceId;
  }
  if (file) {
    input.file = file;
  }
  return input;
};

export class AiController {
  public constructor(private readonly service: AiService) {}

  public analyzeImage = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ImageAnalysisBody;
    sendSuccess(
      res,
      req.requestId,
      await this.service.analyzeImage(imageInput(body, req.file))
    );
  };

  public createSearch = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as AiSearchBody;
    sendSuccess(
      res,
      req.requestId,
      await this.service.createSearch(actor(req), searchInput(body, req.file)),
      201
    );
  };

  public createProductSearch = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as AiSearchBody;
    const result = await this.service.createSearch(actor(req), searchInput(body, req.file));
    sendSuccess(res, req.requestId, result.results.items, 201);
  };

  public getProductDetails = async (req: Request, res: Response): Promise<void> => {
    const source = req.params.source === "ebay" ? "ebay" : "local";
    const marketplaceId = typeof req.query.marketplaceId === "string" ? req.query.marketplaceId : undefined;
    sendSuccess(
      res,
      req.requestId,
      await this.service.getProductDetailsById({
        source,
        productId: req.params.productId ?? "",
        ...(marketplaceId ? { marketplaceId } : {})
      })
    );
  };

  public autoDetectListing = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ImageAnalysisBody;
    sendSuccess(
      res,
      req.requestId,
      await this.service.autoDetectListing(actor(req), req.params.listingId ?? "", imageInput(body, req.file))
    );
  };

  public getImageSearch = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getImageSearch(actor(req), req.params.searchId ?? ""));
  };

  public recentImageSearches = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.recentImageSearches(actor(req)));
  };
}
