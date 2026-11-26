import mongoose from "mongoose";
import { ResourceNotFoundError } from "../../../common/errors/app-error.js";
import type { RealtimePublisher } from "../../../realtime/socket-realtime.service.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import type { CustomerNotificationListQueryInput } from "./notifications.validation.js";

type CustomerNotificationServiceDependencies = {
  realtime?: RealtimePublisher;
};

const isReadRecord = (record: GeneratedApiRecordDocument): boolean =>
  record.status === "read" || Boolean(record.data.read);

const serializeNotification = (record: GeneratedApiRecordDocument) => {
  const read = isReadRecord(record);
  const title =
    typeof record.data.title === "string" && record.data.title.trim()
      ? record.data.title.trim()
      : "Notification";
  const message =
    typeof record.data.message === "string"
      ? record.data.message
      : typeof record.data.body === "string"
        ? record.data.body
        : "";
  const type = typeof record.data.type === "string" ? record.data.type : "general";

  return {
    id: record._id.toString(),
    resource: record.resource,
    ownerId: record.ownerId ?? null,
    type,
    title,
    message,
    body: message,
    read,
    isRead: read,
    readAt: typeof record.data.readAt === "string" ? record.data.readAt : null,
    data: record.data,
    status: read ? "read" : "unread",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
};

const unreadFilter = (userId: string) => ({
  resource: "notifications",
  ownerId: userId,
  deletedAt: null,
  status: mongoose.trusted({ $ne: "read" }),
  "data.read": mongoose.trusted({ $ne: true })
});

export class CustomerNotificationService {
  public constructor(private readonly dependencies: CustomerNotificationServiceDependencies = {}) {}

  public async list(userId: string, query: CustomerNotificationListQueryInput) {
    const filter: Record<string, unknown> = query.unreadOnly
      ? unreadFilter(userId)
      : {
          resource: "notifications",
          ownerId: userId,
          deletedAt: null
        };

    const skip = (query.page - 1) * query.limit;
    const [records, total, unreadCount] = await Promise.all([
      GeneratedApiRecordModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      GeneratedApiRecordModel.countDocuments(filter),
      GeneratedApiRecordModel.countDocuments(unreadFilter(userId))
    ]);

    return {
      items: records.map(serializeNotification),
      unreadCount,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit))
    };
  }

  public async unreadCount(userId: string) {
    const unreadCount = await GeneratedApiRecordModel.countDocuments(unreadFilter(userId));
    return { unreadCount, count: unreadCount };
  }

  public async getOne(userId: string, notificationId: string) {
    const record = await GeneratedApiRecordModel.findOne({
      _id: notificationId,
      resource: "notifications",
      ownerId: userId,
      deletedAt: null
    });
    if (!record) {
      throw new ResourceNotFoundError("Notification not found.");
    }
    return serializeNotification(record);
  }

  public async markRead(userId: string, notificationId: string) {
    const now = new Date();
    const record = await GeneratedApiRecordModel.findOneAndUpdate(
      {
        _id: notificationId,
        resource: "notifications",
        ownerId: userId,
        deletedAt: null
      },
      {
        $set: {
          status: "read",
          "data.read": true,
          "data.readAt": now.toISOString()
        },
        $push: {
          history: {
            action: "notifications.read",
            actorId: userId,
            actorType: "customer",
            at: now,
            metadata: { notificationId }
          }
        }
      },
      { new: true }
    );
    if (!record) {
      throw new ResourceNotFoundError("Notification not found.");
    }

    const { unreadCount } = await this.unreadCount(userId);
    const payload = {
      action: "notifications.read",
      aggregateId: notificationId,
      params: { notificationId },
      data: { notificationId, unreadCount },
      occurredAt: now.toISOString()
    };
    this.dependencies.realtime?.emitToCustomer(userId, "notification:read", payload);
    this.dependencies.realtime?.emitToCustomer(userId, "unread-count:updated", payload);

    return {
      ...serializeNotification(record),
      unreadCount
    };
  }

  public async markAllRead(userId: string) {
    const now = new Date();
    const result = await GeneratedApiRecordModel.updateMany(unreadFilter(userId), {
      $set: {
        status: "read",
        "data.read": true,
        "data.readAt": now.toISOString()
      },
      $push: {
        history: {
          action: "notifications.read-all",
          actorId: userId,
          actorType: "customer",
          at: now,
          metadata: {}
        }
      }
    });

    const payload = {
      action: "notifications.read-all",
      aggregateId: userId,
      params: {},
      data: { updated: result.modifiedCount, unreadCount: 0 },
      occurredAt: now.toISOString()
    };
    this.dependencies.realtime?.emitToCustomer(userId, "notifications:read-all", payload);
    this.dependencies.realtime?.emitToCustomer(userId, "unread-count:updated", payload);

    return {
      updated: result.modifiedCount,
      unreadCount: 0
    };
  }

  public async remove(userId: string, notificationId: string) {
    const now = new Date();
    const record = await GeneratedApiRecordModel.findOneAndUpdate(
      {
        _id: notificationId,
        resource: "notifications",
        ownerId: userId,
        deletedAt: null
      },
      {
        $set: {
          deletedAt: now,
          status: "deleted"
        },
        $push: {
          history: {
            action: "notifications.deleted",
            actorId: userId,
            actorType: "customer",
            at: now,
            metadata: { notificationId }
          }
        }
      },
      { new: true }
    );
    if (!record) {
      throw new ResourceNotFoundError("Notification not found.");
    }

    const { unreadCount } = await this.unreadCount(userId);
    const payload = {
      action: "notifications.deleted",
      aggregateId: notificationId,
      params: { notificationId },
      data: { notificationId, unreadCount },
      occurredAt: now.toISOString()
    };
    this.dependencies.realtime?.emitToCustomer(userId, "notification:deleted", payload);
    this.dependencies.realtime?.emitToCustomer(userId, "unread-count:updated", payload);

    return { deleted: true, id: notificationId, unreadCount };
  }

  public async clearAll(userId: string) {
    const now = new Date();
    const result = await GeneratedApiRecordModel.updateMany(
      {
        resource: "notifications",
        ownerId: userId,
        deletedAt: null
      },
      {
        $set: {
          deletedAt: now,
          status: "deleted"
        }
      }
    );

    const payload = {
      action: "notifications.cleared",
      aggregateId: userId,
      params: {},
      data: { deleted: result.modifiedCount, unreadCount: 0 },
      occurredAt: now.toISOString()
    };
    this.dependencies.realtime?.emitToCustomer(userId, "notifications:cleared", payload);
    this.dependencies.realtime?.emitToCustomer(userId, "unread-count:updated", payload);

    return { deleted: true, count: result.modifiedCount, unreadCount: 0 };
  }
}
