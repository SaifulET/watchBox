import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { fromZodError } from "../../../common/errors/error-handler.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { BulkEmailService } from "./bulk-email.service.js";
import {
  bulkEmailCampaignParamsSchema,
  bulkEmailRecipientsQuerySchema,
  createBulkEmailCampaignSchema
} from "./bulk-email.validation.js";

const adminActorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "admin") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

const filesFromRequest = (req: Request): Express.Multer.File[] => {
  if (Array.isArray(req.files)) {
    return req.files;
  }
  if (req.file) {
    return [req.file];
  }
  if (req.files && !Array.isArray(req.files)) {
    return Object.values(req.files).flat();
  }
  return [];
};

export class BulkEmailController {
  public constructor(private readonly service: BulkEmailService) {}

  public recipients = async (req: Request, res: Response): Promise<void> => {
    const parsed = bulkEmailRecipientsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }
    sendSuccess(res, req.requestId, await this.service.listRecipients(parsed.data));
  };

  public templates = async (req: Request, res: Response): Promise<void> => {
    adminActorId(req);
    sendSuccess(res, req.requestId, await this.service.listTemplates());
  };

  public createCampaign = async (req: Request, res: Response): Promise<void> => {
    const parsed = createBulkEmailCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }
    sendSuccess(
      res,
      req.requestId,
      await this.service.createCampaign(adminActorId(req), parsed.data, filesFromRequest(req)),
      201
    );
  };

  public sendCampaign = async (req: Request, res: Response): Promise<void> => {
    const parsed = bulkEmailCampaignParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }
    sendSuccess(
      res,
      req.requestId,
      await this.service.sendCampaign(adminActorId(req), parsed.data.campaignId)
    );
  };
}
