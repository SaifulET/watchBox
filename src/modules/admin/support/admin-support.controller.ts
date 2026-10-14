import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { messageAttachmentFiles } from "../../../common/middleware/message-attachment-upload.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { AdminSupportService } from "./admin-support.service.js";
import type { AdminSupportReplyInput } from "./admin-support.validation.js";
import { adminSupportQuerySchema } from "./admin-support.validation.js";

const adminId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "admin") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

const ticketId = (req: Request): string => req.params.ticketId ?? "";

export class AdminSupportController {
  public constructor(private readonly service: AdminSupportService) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.list(adminSupportQuerySchema.parse(req.query))
    );
  };

  public get = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.get(ticketId(req)));
  };

  public reply = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.reply(
        adminId(req),
        ticketId(req),
        req.body as AdminSupportReplyInput,
        messageAttachmentFiles(req)
      )
    );
  };
}
