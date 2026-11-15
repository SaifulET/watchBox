import type { ChatConversation, ChatParticipantRole } from "./chats.model.js";

export const isCustomerInChat = (chat: Pick<ChatConversation, "buyerId" | "sellerId">, userId: string): boolean =>
  chat.buyerId === userId || chat.sellerId === userId;

export const customerRoleInChat = (
  chat: Pick<ChatConversation, "buyerId" | "sellerId">,
  userId: string
): Exclude<ChatParticipantRole, "admin"> | null => {
  if (chat.buyerId === userId) {
    return "buyer";
  }
  if (chat.sellerId === userId) {
    return "seller";
  }
  return null;
};

export const messagePreview = (message?: string, attachmentCount = 0): string => {
  const text = message?.trim() ?? "";
  if (text) {
    return text.slice(0, 180);
  }
  if (attachmentCount === 1) {
    return "Sent an attachment";
  }
  if (attachmentCount > 1) {
    return `Sent ${attachmentCount} attachments`;
  }
  return "";
};

export const unreadCountFor = (
  chat: Pick<ChatConversation, "messages" | "participants">,
  participantId: string
): number => {
  const participant = chat.participants.find((item) => item.id === participantId);
  const lastReadAt = participant?.lastReadAt;
  if (!lastReadAt) {
    return chat.messages.length;
  }
  return chat.messages.filter((item) => item.createdAt > lastReadAt && item.senderId !== participantId)
    .length;
};
