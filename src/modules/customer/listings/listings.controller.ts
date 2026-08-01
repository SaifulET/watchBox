import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { ListingsService } from "./listings.service.js";

const actorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

const bodyObject = (body: unknown): Record<string, unknown> =>
  typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

export class ListingsController {
  public constructor(private readonly service: ListingsService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.createListing(actorId(req), bodyObject(req.body), req.file),
      201
    );
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.updateListing(
        actorId(req),
        req.params.listingId ?? "",
        bodyObject(req.body),
        req.file
      )
    );
  };
}
