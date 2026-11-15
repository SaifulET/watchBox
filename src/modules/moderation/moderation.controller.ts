import type { Request, Response } from "express";
import { AuthenticationError } from "../../common/errors/app-error.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import type { AdminNotificationService } from "./admin-notifications.service.js";
import type { BlockService } from "./blocks.service.js";
import {
  notificationListQuerySchema,
  reportListQuerySchema,
  reportUserBodySchema,
  type BlockUserBodyInput,
  type ReportStatusBodyInput,
  type ReportUserBodyInput
} from "./moderation.validation.js";
import { reportProofFiles } from "./proof-upload.js";
import type { ReportService } from "./reports.service.js";

const actorId = (req: Request, audience: "customer" | "admin"): string => {
  if (!req.auth || req.auth.audience !== audience) {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class ModerationController {
  public constructor(
    private readonly blocks: BlockService,
    private readonly reports: ReportService,
    private readonly notifications: AdminNotificationService
  ) {}

  public block = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.blocks.block(actorId(req, "customer"), (req.body as BlockUserBodyInput).userId),
      201
    );
  };

  public unblock = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.blocks.unblock(actorId(req, "customer"), req.params.userId ?? "")
    );
  };

  public listBlocks = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.blocks.list(actorId(req, "customer")));
  };

  public blockStatus = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.blocks.status(actorId(req, "customer"), req.params.userId ?? "")
    );
  };

  public reportUser = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.reports.createFromCustomer(
        actorId(req, "customer"),
        req.body as ReportUserBodyInput,
        reportProofFiles(req)
      ),
      201
    );
  };

  public reportListing = async (req: Request, res: Response): Promise<void> => {
    const body = reportUserBodySchema.parse({
      ...(req.body as ReportUserBodyInput),
      listingId: req.params.listingId
    });
    sendSuccess(
      res,
      req.requestId,
      await this.reports.createFromCustomer(actorId(req, "customer"), body, reportProofFiles(req)),
      201
    );
  };

  public listMyReports = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.reports.listMine(actorId(req, "customer"), reportListQuerySchema.parse(req.query))
    );
  };

  public getMyReport = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.reports.getMine(actorId(req, "customer"), req.params.reportId ?? "")
    );
  };

  public listAdminReports = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.reports.listForAdmin(reportListQuerySchema.parse(req.query))
    );
  };

  public reportSummary = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.reports.summary());
  };

  public getAdminReport = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.reports.getForAdmin(req.params.reportId ?? ""));
  };

  public setReportStatus = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.reports.setStatus(
        actorId(req, "admin"),
        req.params.reportId ?? "",
        (req.body as ReportStatusBodyInput).status
      )
    );
  };

  public resolveReport = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.reports.resolve(actorId(req, "admin"), req.params.reportId ?? "")
    );
  };

  public dismissReport = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.reports.dismiss(actorId(req, "admin"), req.params.reportId ?? "")
    );
  };

  public deleteReport = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.reports.remove(actorId(req, "admin"), req.params.reportId ?? "")
    );
  };

  public listNotifications = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.notifications.list(notificationListQuerySchema.parse(req.query))
    );
  };

  public unreadNotifications = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.notifications.unreadCount());
  };

  public readNotification = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.notifications.markRead(req.params.notificationId ?? "")
    );
  };

  public readAllNotifications = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.notifications.markAllRead());
  };
}
