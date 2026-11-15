import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { ConflictError, ResourceNotFoundError, AuthorizationError } from "../../common/errors/app-error.js";
import {
  deleteMessageAttachments,
  storeMessageAttachments
} from "../../common/services/message-attachment-storage.js";
import type { RealtimeEventPayload, RealtimePublisher } from "../../realtime/socket-realtime.service.js";
import { AdminAccountModel, CustomerAccountModel } from "../customer/auth/auth.model.js";
import { GeneratedApiRecordModel } from "../generated-api/generated-api.model.js";
import { isBlockedEitherWay } from "../moderation/blocks.service.js";
import { customerRoleInChat, isCustomerInChat, messagePreview, unreadCountFor } from "./chats.helpers.js";
import {
  ChatConversationModel,
  type ChatConversationDocument,
  type ChatMessage,
  type ChatParticipant,
  type ChatParticipantRole
} from "./chats.model.js";
import type { AdminOpenChatBodyInput, ChatListQueryInput, OpenChatBodyInput } from "./chats.validation.js";

type ChatServiceDependencies = {
  realtime?: RealtimePublisher;
};

type Profile = {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: ChatParticipantRole;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const asObjectId = (value: string): Types.ObjectId | string =>
  Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;

export class ChatService {
  public constructor(private readonly dependencies: ChatServiceDependencies = {}) {}

  public async listForCustomer(userId: string, query: ChatListQueryInput) {
    return this.listChats(
      {
        deletedAt: null,
        $or: [{ buyerId: userId }, { sellerId: userId }]
      },
      query,
      userId
    );
  }

  public async getForCustomer(userId: string, chatId: string) {
    const chat = await this.requireChat(chatId);
    if (!isCustomerInChat(chat, userId)) {
      throw new AuthorizationError("You are not a participant in this chat.");
    }
    await this.markRead(chat, userId);
    return this.serialize(await this.requireChat(chatId), userId);
  }

  public async openForCustomer(
    userId: string,
    input: OpenChatBodyInput,
    files: Express.Multer.File[]
  ) {
    if (input.withAdmin) {
      return this.openSupportChat(userId, input.message, files);
    }
    if (!input.listingId) {
      throw new ConflictError("listingId is required to contact a seller.");
    }
    return this.openListingChat(userId, input.listingId, input.buyerId, input.message, files);
  }

  public async contactSeller(
    userId: string,
    listingId: string,
    message: string | undefined,
    files: Express.Multer.File[]
  ) {
    return this.openListingChat(userId, listingId, undefined, message, files);
  }

  public async sendCustomerMessage(
    userId: string,
    chatId: string,
    message: string | undefined,
    files: Express.Multer.File[]
  ) {
    const chat = await this.requireOpenChat(chatId);
    const role = customerRoleInChat(chat, userId);
    if (!role) {
      throw new AuthorizationError("You are not a participant in this chat.");
    }
    if (chat.buyerId && chat.sellerId) {
      await this.assertNotBlocked(chat.buyerId, chat.sellerId);
    }
    return this.appendMessage(chat, userId, role, message, files, userId);
  }

  public async listForAdmin(query: ChatListQueryInput) {
    return this.listChats({ deletedAt: null }, query);
  }

  public async getForAdmin(chatId: string) {
    return this.serialize(await this.requireChat(chatId));
  }

  public async sendAdminMessage(
    adminId: string,
    chatId: string,
    message: string | undefined,
    files: Express.Multer.File[]
  ) {
    const chat = await this.requireOpenChat(chatId);
    await this.ensureAdminParticipant(chat, adminId);
    return this.appendMessage(await this.requireOpenChat(chatId), adminId, "admin", message, files);
  }

  public async openForAdmin(
    adminId: string,
    input: AdminOpenChatBodyInput,
    files: Express.Multer.File[]
  ) {
    if (input.chatId) {
      return this.sendAdminMessage(adminId, input.chatId, input.message, files);
    }
    if (input.listingId) {
      const listing = await this.requireListing(input.listingId);
      const sellerId = listing.ownerId;
      if (!sellerId) {
        throw new ConflictError("This listing does not have a seller.");
      }
      const buyerId = input.buyerId ?? input.customerId;
      if (!buyerId) {
        throw new ConflictError("buyerId is required when an admin contacts a listing chat.");
      }
      await this.requireCustomer(buyerId);
      const chat = await this.findOrCreateListingChat(
        buyerId,
        sellerId,
        input.listingId,
        this.listingTitle(listing.data)
      );
      await this.ensureAdminParticipant(chat, adminId);
      return this.appendMessage(await this.requireOpenChat(chat._id.toString()), adminId, "admin", input.message, files);
    }

    const customerId = input.customerId ?? input.buyerId ?? input.sellerId;
    if (!customerId) {
      throw new ConflictError("Provide a customer to contact.");
    }
    await this.requireCustomer(customerId);
    const chat = await this.findOrCreateSupportChat(customerId);
    await this.ensureAdminParticipant(chat, adminId);
    return this.appendMessage(await this.requireOpenChat(chat._id.toString()), adminId, "admin", input.message, files);
  }

  private async openListingChat(
    actorId: string,
    listingId: string,
    requestedBuyerId: string | undefined,
    message: string | undefined,
    files: Express.Multer.File[]
  ) {
    const listing = await this.requireListing(listingId);
    const sellerId = listing.ownerId;
    if (!sellerId) {
      throw new ConflictError("This listing does not have a seller.");
    }

    let buyerId = requestedBuyerId;
    let senderRole: Exclude<ChatParticipantRole, "admin">;
    if (actorId === sellerId) {
      if (!buyerId) {
        throw new ConflictError("buyerId is required when the seller starts a listing chat.");
      }
      if (buyerId === sellerId) {
        throw new ConflictError("A seller cannot chat with themselves.");
      }
      await this.requireCustomer(buyerId);
      senderRole = "seller";
    } else {
      if (buyerId && buyerId !== actorId) {
        throw new AuthorizationError("Buyers can only open chats as themselves.");
      }
      buyerId = actorId;
      if (buyerId === sellerId) {
        throw new ConflictError("You cannot contact yourself on your own listing.");
      }
      senderRole = "buyer";
    }
    if (!buyerId) {
      throw new ConflictError("buyerId is required when starting a listing chat.");
    }
    await this.assertNotBlocked(buyerId, sellerId);

    const chat = await this.findOrCreateListingChat(
      buyerId,
      sellerId,
      listingId,
      this.listingTitle(listing.data)
    );
    return this.appendMessage(chat, actorId, senderRole, message, files, actorId);
  }

  private async openSupportChat(
    customerId: string,
    message: string | undefined,
    files: Express.Multer.File[]
  ) {
    const chat = await this.findOrCreateSupportChat(customerId);
    return this.appendMessage(chat, customerId, "buyer", message, files, customerId);
  }

  private async findOrCreateListingChat(
    buyerId: string,
    sellerId: string,
    listingId: string,
    listingTitle: string
  ): Promise<ChatConversationDocument> {
    const existing = await ChatConversationModel.findOne({
      type: "listing",
      listingId,
      buyerId,
      sellerId,
      deletedAt: null
    });
    if (existing) {
      return existing;
    }

    try {
      return await ChatConversationModel.create({
        type: "listing",
        listingId,
        listingTitle,
        buyerId,
        sellerId,
        participants: [
          { id: buyerId, role: "buyer" },
          { id: sellerId, role: "seller" }
        ],
        messages: [],
        lastMessageAt: new Date(),
        status: "open"
      });
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        const raced = await ChatConversationModel.findOne({
          type: "listing",
          listingId,
          buyerId,
          sellerId,
          deletedAt: null
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  private async findOrCreateSupportChat(customerId: string): Promise<ChatConversationDocument> {
    const existing = await ChatConversationModel.findOne({
      type: "support",
      buyerId: customerId,
      deletedAt: null
    });
    if (existing) {
      return existing;
    }

    try {
      return await ChatConversationModel.create({
        type: "support",
        buyerId: customerId,
        participants: [{ id: customerId, role: "buyer" }],
        messages: [],
        lastMessageAt: new Date(),
        status: "open"
      });
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        const raced = await ChatConversationModel.findOne({
          type: "support",
          buyerId: customerId,
          deletedAt: null
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  private async appendMessage(
    chat: ChatConversationDocument,
    senderId: string,
    senderRole: ChatParticipantRole,
    message: string | undefined,
    files: Express.Multer.File[],
    readerId?: string
  ) {
    if (!message?.trim() && files.length === 0 && chat.messages.length > 0) {
      if (readerId) {
        await this.markRead(chat, readerId);
      }
      return this.serialize(await this.requireChat(chat._id.toString()), readerId);
    }
    if (!message?.trim() && files.length === 0) {
      throw new ConflictError("A message or attachment is required.");
    }

    const attachments = await storeMessageAttachments(
      `chats/${chat._id.toString()}/attachments`,
      files
    );
    const createdAt = new Date();
    const stored: ChatMessage = {
      id: randomUUID(),
      senderId,
      senderRole,
      ...(message?.trim() ? { message: message.trim() } : {}),
      attachments,
      createdAt
    };

    try {
      const updated = await ChatConversationModel.findByIdAndUpdate(
        chat._id,
        {
          $push: { messages: stored },
          $set: {
            lastMessageAt: createdAt,
            lastMessagePreview: messagePreview(stored.message, attachments.length),
            status: "open"
          }
        },
        { new: true }
      );
      if (!updated) {
        throw new ResourceNotFoundError("Chat not found.");
      }
      if (readerId) {
        await this.markRead(updated, readerId);
      }
      const fresh = await this.requireChat(updated._id.toString());
      const serialized = await this.serialize(fresh, readerId);
      this.emitMessage(fresh, stored, serialized);
      return serialized;
    } catch (error) {
      await deleteMessageAttachments(attachments);
      throw error;
    }
  }

  private async ensureAdminParticipant(chat: ChatConversationDocument, adminId: string): Promise<void> {
    if (chat.participants.some((participant) => participant.id === adminId && participant.role === "admin")) {
      return;
    }
    const participant: ChatParticipant = { id: adminId, role: "admin" };
    await ChatConversationModel.updateOne(
      { _id: chat._id, "participants.id": { $ne: adminId } },
      { $push: { participants: participant } }
    );
  }

  private async markRead(chat: ChatConversationDocument, participantId: string): Promise<void> {
    const now = new Date();
    const result = await ChatConversationModel.updateOne(
      { _id: chat._id, "participants.id": participantId },
      { $set: { "participants.$.lastReadAt": now } }
    );
    if (result.matchedCount === 0) {
      const role = customerRoleInChat(chat, participantId);
      if (!role) {
        return;
      }
      await ChatConversationModel.updateOne(
        { _id: chat._id },
        { $push: { participants: { id: participantId, role, lastReadAt: now } } }
      );
    }
  }

  private async listChats(
    filter: Record<string, unknown>,
    query: ChatListQueryInput,
    viewerId?: string
  ) {
    const match = { ...filter };
    if (query.q) {
      const search = new RegExp(escapeRegex(query.q), "i");
      match.$and = [
        ...(Array.isArray(match.$and) ? match.$and : []),
        {
          $or: [
            { listingTitle: search },
            { lastMessagePreview: search },
            { "messages.message": search }
          ]
        }
      ];
    }

    const [records, total] = await Promise.all([
      ChatConversationModel.find(match)
        .sort({ lastMessageAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      ChatConversationModel.countDocuments(match)
    ]);

    return {
      items: await Promise.all(records.map((record) => this.serialize(record, viewerId, true))),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit))
    };
  }

  private async requireChat(chatId: string): Promise<ChatConversationDocument> {
    const chat = await ChatConversationModel.findOne({ _id: chatId, deletedAt: null });
    if (!chat) {
      throw new ResourceNotFoundError("Chat not found.");
    }
    return chat;
  }

  private async requireOpenChat(chatId: string): Promise<ChatConversationDocument> {
    const chat = await this.requireChat(chatId);
    if (chat.status === "closed") {
      throw new ConflictError("This chat is closed.");
    }
    return chat;
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

  private async requireCustomer(customerId: string) {
    const customer = await CustomerAccountModel.findOne({
      _id: asObjectId(customerId),
      deletedAt: null
    })
      .select("_id")
      .lean();
    if (!customer) {
      throw new ResourceNotFoundError("Customer not found.");
    }
  }

  private async assertNotBlocked(userId: string, otherUserId: string): Promise<void> {
    if (await isBlockedEitherWay(userId, otherUserId)) {
      throw new AuthorizationError("Messaging is unavailable because one of you blocked the other.");
    }
  }

  private listingTitle(data: Record<string, unknown>): string {
    return typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Listing";
  }

  private isDuplicateKey(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }

  private emitMessage(
    chat: ChatConversationDocument,
    message: ChatMessage,
    serialized: Awaited<ReturnType<ChatService["serialize"]>>
  ): void {
    const payload: RealtimeEventPayload = {
      action: chat.messages.length <= 1 ? "chat.created" : "chat.message-created",
      aggregateId: chat._id.toString(),
      params: {
        chatId: chat._id.toString(),
        ...(chat.listingId ? { listingId: chat.listingId } : {})
      },
      data: {
        chat: serialized,
        message: serialized.messages.find((item) => item.id === message.id) ?? null
      },
      occurredAt: message.createdAt.toISOString()
    };
    const event = chat.messages.length <= 1 ? "chat:created" as const : "chat-message:new" as const;
    if (chat.buyerId) {
      this.dependencies.realtime?.emitToCustomer(chat.buyerId, event, payload);
    }
    if (chat.sellerId && chat.sellerId !== chat.buyerId) {
      this.dependencies.realtime?.emitToCustomer(chat.sellerId, event, payload);
    }
    this.dependencies.realtime?.emitToAdmins(event, payload);
    if (chat.type === "listing" && event === "chat:created") {
      this.dependencies.realtime?.emitToAdmins("seller-contact:created", payload);
      if (chat.sellerId) {
        this.dependencies.realtime?.emitToCustomer(chat.sellerId, "seller-contact:created", payload);
      }
    }
  }

  private async serialize(
    chat: ChatConversationDocument,
    viewerId?: string,
    summary = false
  ) {
    const profiles = await this.loadProfiles(chat);
    const toMessage = (item: ChatMessage) => ({
      id: item.id,
      senderId: item.senderId,
      senderRole: item.senderRole,
      sender: profiles.get(`${item.senderRole}:${item.senderId}`) ?? {
        id: item.senderId,
        displayName: item.senderRole,
        email: null,
        avatarUrl: null,
        role: item.senderRole
      },
      message: item.message ?? null,
      attachments: item.attachments,
      createdAt: item.createdAt.toISOString()
    });
    const lastStored = chat.messages.at(-1);
    const messages = summary ? [] : chat.messages.map(toMessage);

    return {
      id: chat._id.toString(),
      type: chat.type,
      listing:
        chat.listingId
          ? {
              id: chat.listingId,
              title: chat.listingTitle ?? "Listing"
            }
          : null,
      buyer: chat.buyerId ? profiles.get(`buyer:${chat.buyerId}`) ?? profiles.get(`seller:${chat.buyerId}`) ?? null : null,
      seller: chat.sellerId ? profiles.get(`seller:${chat.sellerId}`) ?? null : null,
      participants: chat.participants.map(
        (participant) =>
          profiles.get(`${participant.role}:${participant.id}`) ?? {
            id: participant.id,
            displayName: participant.role,
            email: null,
            avatarUrl: null,
            role: participant.role
          }
      ),
      messages,
      lastMessage: lastStored ? toMessage(lastStored) : null,
      unreadCount: viewerId ? unreadCountFor(chat, viewerId) : 0,
      status: chat.status,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      lastMessageAt: chat.lastMessageAt.toISOString()
    };
  }

  private async loadProfiles(chat: ChatConversationDocument): Promise<Map<string, Profile>> {
    const customerIds = new Set<string>();
    const adminIds = new Set<string>();
    if (chat.buyerId) {
      customerIds.add(chat.buyerId);
    }
    if (chat.sellerId) {
      customerIds.add(chat.sellerId);
    }
    for (const participant of chat.participants) {
      if (participant.role === "admin") {
        adminIds.add(participant.id);
      } else {
        customerIds.add(participant.id);
      }
    }

    const [customers, admins] = await Promise.all([
      CustomerAccountModel.find({ _id: mongoose.trusted({ $in: [...customerIds].map(asObjectId) }) })
        .select("displayName email avatarUrl")
        .lean(),
      adminIds.size
        ? AdminAccountModel.find({ _id: mongoose.trusted({ $in: [...adminIds].map(asObjectId) }) })
            .select("displayName email avatarUrl")
            .lean()
        : Promise.resolve([])
    ]);

    const profiles = new Map<string, Profile>();
    for (const customer of customers) {
      const id = customer._id.toString();
      const profile = {
        id,
        displayName: customer.displayName,
        email: customer.email,
        avatarUrl: customer.avatarUrl ?? null
      };
      if (chat.buyerId === id) {
        profiles.set(`buyer:${id}`, { ...profile, role: "buyer" });
      }
      if (chat.sellerId === id) {
        profiles.set(`seller:${id}`, { ...profile, role: "seller" });
      }
      if (!profiles.has(`buyer:${id}`) && !profiles.has(`seller:${id}`)) {
        profiles.set(`buyer:${id}`, { ...profile, role: "buyer" });
      }
    }
    for (const admin of admins) {
      const id = admin._id.toString();
      profiles.set(`admin:${id}`, {
        id,
        displayName: admin.displayName,
        email: admin.email,
        avatarUrl: admin.avatarUrl ?? null,
        role: "admin"
      });
    }
    return profiles;
  }
}
