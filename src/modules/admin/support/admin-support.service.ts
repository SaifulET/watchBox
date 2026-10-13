import { randomUUID } from "node:crypto";
import { ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import {
  deleteMessageAttachments,
  storeMessageAttachments
} from "../../../common/services/message-attachment-storage.js";
import type {
  RealtimeEventPayload,
  RealtimePublisher
} from "../../../realtime/socket-realtime.service.js";
import { CustomerAccountModel } from "../../customer/auth/auth.model.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import { GeneratedApiRepository } from "../../generated-api/generated-api.repository.js";
import type {
  AdminSupportQueryInput,
  AdminSupportReplyInput
} from "./admin-support.validation.js";

type AdminSupportDependencies = {
  realtime?: RealtimePublisher;
  repository?: GeneratedApiRepository;
};

type MessageData = Record<string, unknown> & {
  id: string;
  message?: string;
  senderId: string | null;
  senderType: "customer" | "admin";
  createdAt: string;
  attachments: unknown[];
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const storedMessages = (record: GeneratedApiRecordDocument): MessageData[] => {
  const messages = record.data.messages;
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.filter(
    (message): message is MessageData =>
      typeof message === "object" &&
      message !== null &&
      !Array.isArray(message) &&
      typeof (message as Record<string, unknown>).id === "string"
  );
};

const initialMessage = (record: GeneratedApiRecordDocument): MessageData | null => {
  if (typeof record.data.message !== "string" || !record.data.message.trim()) {
    return null;
  }
  return {
    id: `${record._id.toString()}:initial`,
    message: record.data.message,
    senderId: record.ownerId ?? null,
    senderType: "customer",
    createdAt: record.createdAt.toISOString(),
    attachments: Array.isArray(record.data.attachments) ? record.data.attachments : []
  };
};

export class AdminSupportService {
  private readonly repository: GeneratedApiRepository;

  public constructor(private readonly dependencies: AdminSupportDependencies = {}) {
    this.repository = dependencies.repository ?? new GeneratedApiRepository();
  }

  public async list(query: AdminSupportQueryInput) {
    const filter: Record<string, unknown> = {
      resource: "support",
      deletedAt: null
    };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.q) {
      const search = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [{ "data.subject": search }, { "data.message": search }];
    }

    const [records, total] = await Promise.all([
      GeneratedApiRecordModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      GeneratedApiRecordModel.countDocuments(filter)
    ]);

    return {
      items: await Promise.all(records.map((record) => this.serialize(record))),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit))
    };
  }

  public async get(ticketId: string) {
    return this.serialize(await this.requireTicket(ticketId));
  }

  public async reply(
    adminId: string,
    ticketId: string,
    input: AdminSupportReplyInput,
    files: Express.Multer.File[]
  ) {
    const ticket = await this.requireTicket(ticketId);
    if (!input.message && files.length === 0) {
      throw new ConflictError("A reply message or attachment is required.");
    }

    const attachments = await storeMessageAttachments(
      `support/tickets/${ticketId}/attachments`,
      files
    );
    const message: MessageData = {
      id: randomUUID(),
      ...(input.message ? { message: input.message } : {}),
      senderId: adminId,
      senderType: "admin",
      createdAt: new Date().toISOString(),
      attachments
    };

    let updated: GeneratedApiRecordDocument;
    try {
      updated = await this.repository.appendDataItem(
        ticket,
        "messages",
        message,
        "support.admin-replied",
        adminId,
        "admin"
      );
    } catch (error) {
      await deleteMessageAttachments(attachments);
      throw error;
    }

    const payload: RealtimeEventPayload = {
      action: "support.admin-replied",
      aggregateId: ticketId,
      params: { ticketId },
      data: { message },
      occurredAt: new Date().toISOString()
    };
    if (ticket.ownerId) {
      this.dependencies.realtime?.emitToCustomer(ticket.ownerId, "support-message:new", payload);
    }
    this.dependencies.realtime?.emitToAdmins("support-message:new", payload);

    return {
      message,
      ticket: await this.serialize(updated)
    };
  }

  private async requireTicket(ticketId: string): Promise<GeneratedApiRecordDocument> {
    const ticket = await GeneratedApiRecordModel.findOne({
      _id: ticketId,
      resource: "support",
      deletedAt: null
    });
    if (!ticket) {
      throw new ResourceNotFoundError("Support ticket not found.");
    }
    return ticket;
  }

  private async serialize(record: GeneratedApiRecordDocument) {
    const customer = record.ownerId
      ? await CustomerAccountModel.findById(record.ownerId)
          .select("displayName email avatarUrl")
          .lean()
      : null;
    const firstMessage = initialMessage(record);
    const messages = [...(firstMessage ? [firstMessage] : []), ...storedMessages(record)];

    return {
      id: record._id.toString(),
      customer: customer
        ? {
            id: customer._id.toString(),
            displayName: customer.displayName,
            email: customer.email,
            avatarUrl: customer.avatarUrl ?? null
          }
        : null,
      subject: typeof record.data.subject === "string" ? record.data.subject : "Support request",
      status: record.status,
      messages,
      lastMessage: messages.at(-1) ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }
}
