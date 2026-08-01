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
