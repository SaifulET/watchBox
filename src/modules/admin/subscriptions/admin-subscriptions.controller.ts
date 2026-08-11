import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { AdminSubscriptionsService } from "./admin-subscriptions.service.js";
import type {
  PlanBodyInput,
  PlanFeaturesBodyInput,
  PromotionBodyInput,
  SettingsBodyInput
} from "./admin-subscriptions.validation.js";

const adminActorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "admin") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class AdminSubscriptionsController {
  public constructor(private readonly service: AdminSubscriptionsService) {}

  public plans = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.listPlans());
  };

  public createPlan = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.createPlan(adminActorId(req), req.body as PlanBodyInput),
      201
    );
  };

  public plan = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getPlan(req.params.planId ?? ""));
  };

  public updatePlan = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.updatePlan(
        adminActorId(req),
        req.params.planId ?? "",
        req.body as PlanBodyInput
      )
    );
  };

  public deletePlan = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.deletePlan(adminActorId(req), req.params.planId ?? "")
    );
  };

  public activatePlan = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.setPlanStatus(adminActorId(req), req.params.planId ?? "", "active")
    );
  };

  public deactivatePlan = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.setPlanStatus(adminActorId(req), req.params.planId ?? "", "inactive")
    );
  };

  public duplicatePlan = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.duplicatePlan(adminActorId(req), req.params.planId ?? ""),
      201
    );
  };

  public updatePlanFeatures = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.updatePlanFeatures(
        adminActorId(req),
        req.params.planId ?? "",
        req.body as PlanFeaturesBodyInput
      )
    );
  };

  public settings = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.settings());
  };

  public updateSettings = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.updateSettings(adminActorId(req), req.body as SettingsBodyInput)
    );
  };

  public promotions = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.listPromotions());
  };

  public createPromotion = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.createPromotion(adminActorId(req), req.body as PromotionBodyInput),
      201
    );
  };

  public updatePromotion = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.updatePromotion(
        adminActorId(req),
        req.params.promotionId ?? "",
        req.body as PromotionBodyInput
      )
    );
  };

  public deletePromotion = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.deletePromotion(adminActorId(req), req.params.promotionId ?? "")
    );
  };

  public activatePromotion = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.setPromotionStatus(
        adminActorId(req),
        req.params.promotionId ?? "",
        "active"
      )
    );
  };

  public deactivatePromotion = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.setPromotionStatus(
        adminActorId(req),
        req.params.promotionId ?? "",
        "inactive"
      )
    );
  };

  public recentActions = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.recentActions());
  };
}
