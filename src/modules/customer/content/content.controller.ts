import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { ContentService } from "./content.service.js";
import type { ContentParams, ContentUpsertBody } from "./content.validation.js";
import { contentParamsSchema } from "./content.validation.js";

const adminActorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "admin") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class ContentController {
  public constructor(private readonly service: ContentService) {}

  private params(req: Request): ContentParams {
    return contentParamsSchema.parse(req.params);
  }

  public publicPage = async (req: Request, res: Response): Promise<void> => {
    const params = this.params(req);
    sendSuccess(res, req.requestId, await this.service.getPublicPage(params.slug));
  };

  public listPages = async (req: Request, res: Response): Promise<void> => {
    adminActorId(req);
    sendSuccess(res, req.requestId, await this.service.listPages());
  };

  public getPage = async (req: Request, res: Response): Promise<void> => {
    adminActorId(req);
    const params = this.params(req);
    sendSuccess(res, req.requestId, await this.service.getAdminPage(params.slug));
  };

  public uploadImage = async (req: Request, res: Response): Promise<void> => {
    adminActorId(req);
    sendSuccess(res, req.requestId, await this.service.uploadInlineImage(req.file), 201);
  };

  public createPage = async (req: Request, res: Response): Promise<void> => {
    const params = this.params(req);
    const body = req.body as ContentUpsertBody;
    sendSuccess(
      res,
      req.requestId,
      await this.service.createPage(adminActorId(req), params.slug, body, req.file),
      201
    );
  };

  public updatePage = async (req: Request, res: Response): Promise<void> => {
    const params = this.params(req);
    const body = req.body as ContentUpsertBody;
    sendSuccess(
      res,
      req.requestId,
      await this.service.updatePage(adminActorId(req), params.slug, body, req.file)
    );
  };
}
