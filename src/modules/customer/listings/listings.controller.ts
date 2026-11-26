import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { buildMeta, sendSuccess } from "../../../common/utils/api-response.js";
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

const objectFromJsonField = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return bodyObject(parsed);
  } catch {
    return {};
  }
};

const listingBody = (body: unknown): Record<string, unknown> => {
  const fields = bodyObject(body);
  const embedded = {
    ...objectFromJsonField(fields.data),
    ...objectFromJsonField(fields.info),
    ...objectFromJsonField(fields.listing),
    ...objectFromJsonField(fields.payload)
  };
  const directFields = { ...fields };
  delete directFields.data;
  delete directFields.info;
  delete directFields.listing;
  delete directFields.payload;
  return {
    ...embedded,
    ...directFields
  };
};

export class ListingsController {
  public constructor(private readonly service: ListingsService) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listListings(req.query as Record<string, unknown>);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        ...buildMeta(req.requestId),
        ...result.meta
      }
    });
  };

  public listMine =
    (statusBucket?: string) =>
    async (req: Request, res: Response): Promise<void> => {
      const result = await this.service.listListings(
        req.query as Record<string, unknown>,
        actorId(req),
        statusBucket
      );
      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          ...buildMeta(req.requestId),
          ...result.meta
        }
      });
    };

  public getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getListingById(req.params.listingId ?? ""));
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.createListing(actorId(req), listingBody(req.body), req.file),
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
        listingBody(req.body),
        req.file
      )
    );
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.deleteListing(actorId(req), req.params.listingId ?? "")
    );
  };

  public transition =
    (action: string) =>
    async (req: Request, res: Response): Promise<void> => {
      sendSuccess(
        res,
        req.requestId,
        await this.service.transitionStatus(actorId(req), req.params.listingId ?? "", action)
      );
    };
}
