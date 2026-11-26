import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { CustomerNotificationService } from "./notifications.service.js";
import { customerNotificationListQuerySchema } from "./notifications.validation.js";

const actorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class CustomerNotificationController {
  public constructor(private readonly service: CustomerNotificationService) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = customerNotificationListQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.list(actorId(req), query));
  };

  public unreadCount = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.unreadCount(actorId(req)));
  };

  public getOne = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.getOne(actorId(req), req.params.notificationId ?? "")
    );
  };

  public markRead = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.markRead(actorId(req), req.params.notificationId ?? "")
    );
  };

  public markAllRead = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.markAllRead(actorId(req)));
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.remove(actorId(req), req.params.notificationId ?? "")
    );
  };

  public clearAll = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.clearAll(actorId(req)));
  };
}
