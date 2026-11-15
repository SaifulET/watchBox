import { Types } from "mongoose";
import { ConflictError, ResourceNotFoundError } from "../../common/errors/app-error.js";
import {
  deleteMessageAttachments,
  storeMessageAttachments
} from "../../common/services/message-attachment-storage.js";
import type { RealtimeEventPayload, RealtimePublisher } from "../../realtime/socket-realtime.service.js";
import { AdminAccountModel, CustomerAccountModel } from "../customer/auth/auth.model.js";
import { GeneratedApiRecordModel } from "../generated-api/generated-api.model.js";
import { AdminNotificationService } from "./admin-notifications.service.js";
import { reportProofMaxBytes } from "./proof-upload.js";
import type { ReportStatus, UserReportDocument } from "./reports.model.js";
import { UserReportModel } from "./reports.model.js";
import type { ReportListQueryInput, ReportUserBodyInput } from "./moderation.validation.js";

type ReportServiceDependencies = {
  realtime?: RealtimePublisher;
  notifications?: AdminNotificationService;
};

type Profile = {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const asObjectId = (value: string): Types.ObjectId | string =>
  Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;

const reasonLabel: Record<string, string> = {
  spam: "Spam",
  scam: "Scam",
  harassment: "Harassment",
  unprofessional: "Unprofessional behavior",
  "fake-listing": "Fake listing",
  other: "Other"
};

export class ReportService {
  private readonly notifications: AdminNotificationService;

  public constructor(private readonly dependencies: ReportServiceDependencies = {}) {
    this.notifications =
      dependencies.notifications ??
      new AdminNotificationService(
        dependencies.realtime ? { realtime: dependencies.realtime } : {}
      );
  }

  public async createFromCustomer(
    reporterId: string,
    input: ReportUserBodyInput,
    files: Express.Multer.File[]
  ) {
    const listing = input.listingId ? await this.requireListing(input.listingId) : null;
    const reportedUserId = input.userId ?? listing?.ownerId;
    if (!reportedUserId) {
      throw new ConflictError("userId or listingId is required.");
    }
    if (reportedUserId === reporterId) {
      throw new ConflictError("You cannot report yourself.");
    }
    await this.requireCustomer(reportedUserId);
    this.assertProofImages(files);

    const report = await UserReportModel.create({
      reporterId,
      reportedUserId,
      ...(input.listingId ? { listingId: input.listingId } : {}),
      reason: input.reason,
      ...(input.message ? { message: input.message } : {}),
      proofImages: [],
      status: "pending"
    });

    try {
      if (files.length > 0) {
        const proofImages = await storeMessageAttachments(
          `reports/${report._id.toString()}/proof`,
          files
        );
        report.proofImages = proofImages;
        await report.save();
      }
    } catch (error) {
      await UserReportModel.deleteOne({ _id: report._id });
      throw error;
    }

    const serialized = await this.serialize(report);
    await this.notifyAdmins(serialized, "created");
    await this.notifyCustomer(
      reporterId,
      "Report submitted",
      "Your report is pending admin review.",
      report._id.toString()
    );
    this.emitReport("report:created", serialized);
    return serialized;
  }

  public async listMine(reporterId: string, query: ReportListQueryInput) {
    return this.listReports({ reporterId, deletedAt: null }, query);
  }

  public async getMine(reporterId: string, reportId: string) {
    const report = await this.requireReport(reportId);
    if (report.reporterId !== reporterId) {
      throw new ResourceNotFoundError("Report not found.");
    }
    return this.serialize(report);
  }

  public async listForAdmin(query: ReportListQueryInput) {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) {
      filter.status = query.status;
    }
    return this.listReports(filter, query);
  }

  public async summary() {
    const [pending, resolved, dismissed, total] = await Promise.all([
      UserReportModel.countDocuments({ deletedAt: null, status: "pending" }),
      UserReportModel.countDocuments({ deletedAt: null, status: "resolved" }),
      UserReportModel.countDocuments({ deletedAt: null, status: "dismissed" }),
      UserReportModel.countDocuments({ deletedAt: null })
    ]);
    return { pending, resolved, dismissed, total };
  }

  public async getForAdmin(reportId: string) {
    return this.serialize(await this.requireReport(reportId));
  }

  public async setStatus(adminId: string, reportId: string, status: ReportStatus) {
    const report = await this.requireReport(reportId);
    report.status = status;
    if (status === "pending") {
      report.set("resolvedBy", undefined);
      report.set("resolvedAt", undefined);
    } else {
      report.resolvedBy = adminId;
      report.resolvedAt = new Date();
    }
    await report.save();
    const serialized = await this.serialize(report);
    if (status === "resolved" || status === "dismissed") {
      await this.notifyAdmins(serialized, status);
      await this.notifyCustomer(
        report.reporterId,
        status === "resolved" ? "Report resolved" : "Report dismissed",
        status === "resolved"
          ? "An admin resolved your report."
          : "An admin dismissed your report.",
        report._id.toString()
      );
    }
    this.emitReport("report:updated", serialized);
    return serialized;
  }

  public async resolve(adminId: string, reportId: string) {
    return this.setStatus(adminId, reportId, "resolved");
  }

  public async dismiss(adminId: string, reportId: string) {
    return this.setStatus(adminId, reportId, "dismissed");
  }

  public async remove(adminId: string, reportId: string) {
    const report = await this.requireReport(reportId);
    report.deletedAt = new Date();
    report.resolvedBy = adminId;
    await report.save();
    if (report.proofImages.length > 0) {
      await deleteMessageAttachments(report.proofImages);
    }
    const serialized = await this.serialize(report);
    await this.notifications.create({
      type: "report.deleted",
      title: "Report deleted",
      body: `A ${reasonLabel[report.reason] ?? report.reason} report was deleted.`,
      reportId: report._id.toString()
    });
    this.emitReport("report:deleted", serialized);
    return { deleted: true, id: report._id.toString() };
  }

  private assertProofImages(files: Express.Multer.File[]): void {
    for (const file of files) {
      if (file.size > reportProofMaxBytes) {
        throw new ConflictError("Each proof image must be 10MB or smaller.");
      }
    }
  }

  private async listReports(filter: Record<string, unknown>, query: ReportListQueryInput) {
    const match = { ...filter };
    if (query.q) {
      const search = new RegExp(escapeRegex(query.q), "i");
      match.$or = [{ reason: search }, { message: search }];
    }
    const [records, total] = await Promise.all([
      UserReportModel.find(match)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      UserReportModel.countDocuments(match)
    ]);
    return {
      items: await Promise.all(records.map((record) => this.serialize(record))),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit))
    };
  }

  private async requireReport(reportId: string): Promise<UserReportDocument> {
    const report = await UserReportModel.findOne({ _id: reportId, deletedAt: null });
    if (!report) {
      throw new ResourceNotFoundError("Report not found.");
    }
    return report;
  }

  private async requireCustomer(customerId: string) {
    const customer = await CustomerAccountModel.findOne({
      _id: asObjectId(customerId),
      deletedAt: null
    })
      .select("_id")
      .lean();
    if (!customer) {
      throw new ResourceNotFoundError("User not found.");
    }
  }

  private async requireListing(listingId: string) {
    const listing = await GeneratedApiRecordModel.findOne({
      _id: listingId,
      resource: "listings",
      deletedAt: null
    });
    if (!listing) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    return listing;
  }

  private async notifyAdmins(
    report: Awaited<ReturnType<ReportService["serialize"]>>,
    action: "created" | "resolved" | "dismissed"
  ) {
    const from = report.reporter?.displayName ?? "A user";
    const to = report.reportedUser?.displayName ?? "another user";
    const reason = reasonLabel[report.reason] ?? report.reason;
    if (action === "created") {
      await this.notifications.create({
        type: "report.created",
        title: "New user report pending",
        body: `${from} reported ${to} for ${reason}.`,
        reportId: report.id
      });
      return;
    }
    await this.notifications.create({
      type: "report.resolved",
      title: action === "resolved" ? "Report resolved" : "Report dismissed",
      body: `The ${reason} report from ${from} against ${to} was ${action}.`,
      reportId: report.id
    });
  }

  private async notifyCustomer(customerId: string, title: string, message: string, reportId: string) {
    await GeneratedApiRecordModel.create({
      resource: "notifications",
      ownerId: customerId,
      scope: { reportId },
      data: { title, message, reportId, type: "report" },
      status: "unread"
    });
    const payload: RealtimeEventPayload = {
      action: "notification.created",
      aggregateId: reportId,
      params: { reportId },
      data: { title, message, reportId },
      occurredAt: new Date().toISOString()
    };
    this.dependencies.realtime?.emitToCustomer(customerId, "notification:new", payload);
    this.dependencies.realtime?.emitToCustomer(customerId, "unread-count:updated", payload);
  }

  private emitReport(
    event: "report:created" | "report:updated" | "report:deleted",
    report: Awaited<ReturnType<ReportService["serialize"]>>
  ): void {
    const payload: RealtimeEventPayload = {
      action: event.replace(":", "."),
      aggregateId: report.id,
      params: { reportId: report.id },
      data: { report },
      occurredAt: new Date().toISOString()
    };
    this.dependencies.realtime?.emitToAdmins(event, payload);
  }

  private async serialize(report: UserReportDocument) {
    const [reporter, reportedUser, resolver, listing] = await Promise.all([
      this.loadCustomer(report.reporterId),
      this.loadCustomer(report.reportedUserId),
      report.resolvedBy ? this.loadAdmin(report.resolvedBy) : Promise.resolve(null),
      report.listingId ? this.loadListing(report.listingId) : Promise.resolve(null)
    ]);
    return {
      id: report._id.toString(),
      reporter,
      reportedUser,
      listing,
      reason: report.reason,
      reasonLabel: reasonLabel[report.reason] ?? report.reason,
      message: report.message ?? null,
      proofImages: report.proofImages,
      status: report.status,
      resolvedBy: resolver,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString()
    };
  }

  private async loadCustomer(id: string): Promise<Profile | null> {
    const customer = await CustomerAccountModel.findById(asObjectId(id))
      .select("displayName email avatarUrl")
      .lean();
    if (!customer) {
      return { id, displayName: "Unknown user", email: null, avatarUrl: null };
    }
    return {
      id: customer._id.toString(),
      displayName: customer.displayName,
      email: customer.email,
      avatarUrl: customer.avatarUrl ?? null
    };
  }

  private async loadAdmin(id: string): Promise<Profile | null> {
    const admin = await AdminAccountModel.findById(asObjectId(id))
      .select("displayName email avatarUrl")
      .lean();
    if (!admin) {
      return { id, displayName: "Admin", email: null, avatarUrl: null };
    }
    return {
      id: admin._id.toString(),
      displayName: admin.displayName,
      email: admin.email,
      avatarUrl: admin.avatarUrl ?? null
    };
  }

  private async loadListing(listingId: string) {
    const listing = await GeneratedApiRecordModel.findById(listingId).select("data.title").lean();
    if (!listing) {
      return { id: listingId, title: "Listing" };
    }
    return {
      id: listing._id.toString(),
      title: typeof listing.data.title === "string" ? listing.data.title : "Listing"
    };
  }
}
