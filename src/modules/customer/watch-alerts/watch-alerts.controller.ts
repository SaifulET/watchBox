import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { WatchAlertsService } from "./watch-alerts.service.js";
import { watchAlertListQuerySchema, type WatchAlertInput } from "./watch-alerts.validation.js";

const actorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "customer") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class WatchAlertsController {
  public constructor(private readonly service: WatchAlertsService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.create(actorId(req), req.body as WatchAlertInput), 201);
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.list(actorId(req), watchAlertListQuerySchema.parse(req.query)));
  };

  public events = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.events(actorId(req), watchAlertListQuerySchema.parse(req.query)));
  };

  public run = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.checkUserAlerts(actorId(req)));
  };

  public delete = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.delete(actorId(req), req.params.alertId ?? ""));
  };
}
