import type { Request, Response } from "express";
import { sendSuccess } from "../../common/utils/api-response.js";
import type { PublicPagesService } from "./public-pages.service.js";
import type { PublicAccountDeletionInput, PublicContactInput } from "./public-pages.validation.js";

const fingerprintFromRequest = (req: Request) => {
  const result: { ipAddress?: string } = {};
  if (req.ip) {
    result.ipAddress = req.ip;
  }
  return result;
};

export class PublicPagesController {
  public constructor(private readonly service: PublicPagesService) {}

  public submitContact = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.submitContact(req.body as PublicContactInput, fingerprintFromRequest(req)),
      201
    );
  };

  public deleteAccount = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.deleteAccount(req.body as PublicAccountDeletionInput, fingerprintFromRequest(req))
    );
  };
}
