import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { SavedService } from "./saved.service.js";
import {
  recommendationsQuerySchema,
  savedListQuerySchema,
  type SavedProductInput,
  type SavedSearchInput
} from "./saved.validation.js";

const actorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class SavedController {
  public constructor(private readonly service: SavedService) {}

  public saveProduct = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.saveProduct(actorId(req), req.body as SavedProductInput), 201);
  };

  public savedProducts = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.savedProducts(actorId(req), savedListQuerySchema.parse(req.query)));
  };

  public saveSearch = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.saveSearch(actorId(req), req.body as SavedSearchInput), 201);
  };

  public savedSearches = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.savedSearches(actorId(req), savedListQuerySchema.parse(req.query)));
  };

  public recommendedProducts = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.recommendedProducts(actorId(req), recommendationsQuerySchema.parse(req.query))
    );
  };
}
