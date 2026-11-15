import { ResourceNotFoundError } from "../../common/errors/app-error.js";
import type { RealtimeEventPayload, RealtimePublisher } from "../../realtime/socket-realtime.service.js";
import {
  AdminNotificationModel,
  type AdminNotification,
  type AdminNotificationDocument
} from "./admin-notifications.model.js";
import type { NotificationListQueryInput } from "./moderation.validation.js";

type NotificationDependencies = {
  realtime?: RealtimePublisher;
};

export class AdminNotificationService {
  public constructor(private readonly dependencies: NotificationDependencies = {}) {}

  public async create(input: Pick<AdminNotification, "type" | "title" | "body" | "reportId">) {
    const notification = await AdminNotificationModel.create(input);
    const serialized = this.serialize(notification);
    const payload: RealtimeEventPayload = {
      action: input.type,
      aggregateId: notification._id.toString(),
      params: {
        notificationId: notification._id.toString(),
        ...(input.reportId ? { reportId: input.reportId } : {})
      },
      data: { notification: serialized },
      occurredAt: notification.createdAt.toISOString()
    };
    this.dependencies.realtime?.emitToAdmins("notification:new", payload);
    this.dependencies.realtime?.emitToAdmins("unread-count:updated", payload);
    return serialized;
  }

  public async list(query: NotificationListQueryInput) {
    const filter = { deletedAt: null };
    const [records, total, unreadCount] = await Promise.all([
      AdminNotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      AdminNotificationModel.countDocuments(filter),
      AdminNotificationModel.countDocuments({ deletedAt: null, readAt: null })
    ]);
    return {
      items: records.map((record) => this.serialize(record)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
      unreadCount
    };
  }

  public async unreadCount() {
    return {
      unreadCount: await AdminNotificationModel.countDocuments({ deletedAt: null, readAt: null })
    };
  }

  public async markRead(notificationId: string) {
    const notification = await AdminNotificationModel.findOneAndUpdate(
      { _id: notificationId, deletedAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      throw new ResourceNotFoundError("Notification not found.");
    }
    this.emitUnread();
    return this.serialize(notification);
  }

  public async markAllRead() {
    await AdminNotificationModel.updateMany(
      { deletedAt: null, readAt: null },
      { $set: { readAt: new Date() } }
    );
    this.emitUnread();
    return { read: true };
  }

  private emitUnread(): void {
    const payload: RealtimeEventPayload = {
      action: "notifications.read",
      aggregateId: "admin-notifications",
      params: {},
      data: {},
      occurredAt: new Date().toISOString()
    };
    this.dependencies.realtime?.emitToAdmins("unread-count:updated", payload);
  }

  private serialize(notification: AdminNotificationDocument) {
    return {
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      reportId: notification.reportId ?? null,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString()
    };
  }
}
