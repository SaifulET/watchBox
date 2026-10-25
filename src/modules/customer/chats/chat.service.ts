import { Types } from "mongoose";
import { AuthorizationError, ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { CustomerAccountModel } from "../auth/auth.model.js";
import { MarketplaceChatModel, type MarketplaceChatDocument, type ChatMessage } from "./chat.model.js";

export type SendChatMessageInput = { content: string; messageType?: "text" | "image" | "file"; fileUrl?: string };

const messageJson = (chatId: string, message: ChatMessage) => ({
  id: message._id.toString(), chatId, senderId: message.senderId, content: message.content,
  messageType: message.messageType, fileUrl: message.fileUrl ?? null,
  isSeen: message.seenBy.length > 1, seenBy: message.seenBy,
  createdAt: message.createdAt.toISOString()
});

export class ChatService {
  public async list(userId: string) {
    const chats = await MarketplaceChatModel.find({ participants: userId }).sort({ updatedAt: -1 });
    const otherIds = [...new Set(chats.flatMap((chat) => chat.participants.filter((id) => id !== userId)))];
    const users = await CustomerAccountModel.find({ _id: { $in: otherIds.filter(Types.ObjectId.isValid) } })
      .select("displayName avatarUrl").lean();
    const names = new Map(users.map((user) => [user._id.toString(), user]));
    return chats.map((chat) => {
      const otherId = chat.participants.find((id) => id !== userId) ?? "";
      const other = names.get(otherId);
      const last = chat.messages.at(-1);
      return { id: chat.id, name: other?.displayName ?? "WatchBox member", avatarUrl: other?.avatarUrl ?? null,
        recipientId: otherId, listingId: chat.listingId ?? null, watchTitle: chat.subject,
        lastMessage: last?.content ?? "", lastMessageTime: (last?.createdAt ?? chat.updatedAt).toISOString(),
        unreadCount: chat.messages.filter((m) => m.senderId !== userId && !m.seenBy.includes(userId)).length };
    });
  }

  public async create(userId: string, input: { recipientId: string; listingId?: string; subject?: string; message?: string }) {
    if (input.recipientId === userId) throw new ConflictError("You cannot message your own listing.");
    const recipient = await CustomerAccountModel.exists({ _id: input.recipientId, deletedAt: null });
    if (!recipient) throw new ResourceNotFoundError("Seller was not found.");
    const participants = [userId, input.recipientId].sort();
    let chat = await MarketplaceChatModel.findOne({ participants: { $all: participants, $size: 2 }, listingId: input.listingId });
    if (!chat) {
      chat = await MarketplaceChatModel.create({ participants, listingId: input.listingId,
        subject: input.subject?.trim() || "Listing inquiry", messages: [] });
      if (input.message?.trim()) await this.send(userId, chat.id, { content: input.message });
      chat = (await MarketplaceChatModel.findById(chat.id))!;
    }
    return (await this.list(userId)).find((item) => item.id === chat.id);
  }

  public async messages(userId: string, chatId: string) {
    const chat = await this.requireParticipant(userId, chatId);
    return chat.messages.map((message) => messageJson(chat.id, message));
  }

  public async send(userId: string, chatId: string, input: SendChatMessageInput) {
    const chat = await this.requireParticipant(userId, chatId);
    const message = { _id: new Types.ObjectId(), senderId: userId, content: input.content.trim(),
      messageType: input.messageType ?? "text", fileUrl: input.fileUrl, seenBy: [userId], createdAt: new Date() } as ChatMessage;
    chat.messages.push(message);
    await chat.save();
    return { message: messageJson(chat.id, message), participantIds: chat.participants };
  }

  public async markSeen(userId: string, chatId: string, messageId: string) {
    const chat = await this.requireParticipant(userId, chatId);
    const message = chat.messages.find((item) => item._id.toString() === messageId);
    if (!message) throw new ResourceNotFoundError("Message was not found.");
    if (!message.seenBy.includes(userId)) message.seenBy.push(userId);
    await chat.save();
    return { participantIds: chat.participants, message: messageJson(chat.id, message) };
  }

  public async participants(userId: string, chatId: string) {
    return (await this.requireParticipant(userId, chatId)).participants;
  }

  private async requireParticipant(userId: string, chatId: string): Promise<MarketplaceChatDocument> {
    if (!Types.ObjectId.isValid(chatId)) throw new ResourceNotFoundError("Conversation was not found.");
    const chat = await MarketplaceChatModel.findById(chatId);
    if (!chat) throw new ResourceNotFoundError("Conversation was not found.");
    if (!chat.participants.includes(userId)) throw new AuthorizationError("You are not a participant in this conversation.");
    return chat;
  }
}
