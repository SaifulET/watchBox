import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { NotificationPreferencesService } from "./notification-preferences.service.js";
import type { UpdateNotificationPreferencesInput } from "./notification-preferences.validation.js";

const actorId = (req: Request): string => {
  if (!req.auth) {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class NotificationPreferencesController {
  public constructor(private readonly service: NotificationPreferencesService) {}

  public get = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.get(actorId(req)));
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.update(actorId(req), req.body as UpdateNotificationPreferencesInput)
    );
  };
}
