import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { ListingImagesService } from "./listing-images.service.js";

const actorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class ListingImagesController {
  public constructor(private readonly service: ListingImagesService) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.listImages(actorId(req), req.params.listingId ?? "")
    );
  };

  public upload = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.uploadImage(actorId(req), req.params.listingId ?? "", req.file),
      201
    );
  };
}
