import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type ChatParticipantRole = "buyer" | "seller" | "admin";
export type ChatType = "listing" | "support";
export type ChatStatus = "open" | "closed";

export type ChatAttachment = {
  id: string;
  key: string;
  url: string;
  name: string;
  contentType: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderRole: ChatParticipantRole;
  message?: string;
  attachments: ChatAttachment[];
  createdAt: Date;
};

export type ChatParticipant = {
  id: string;
  role: ChatParticipantRole;
  lastReadAt?: Date;
};

export type ChatConversation = {
  type: ChatType;
  listingId?: string;
  listingTitle?: string;
  buyerId?: string;
  sellerId?: string;
  participants: ChatParticipant[];
  messages: ChatMessage[];
  lastMessageAt: Date;
  lastMessagePreview?: string;
  status: ChatStatus;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const chatAttachmentSchema = new Schema<ChatAttachment>(
  {
    id: { type: String, required: true },
    key: { type: String, required: true },
    url: { type: String, required: true },
    name: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const chatMessageSchema = new Schema<ChatMessage>(
  {
    id: { type: String, required: true },
    senderId: { type: String, required: true },
    senderRole: { type: String, enum: ["buyer", "seller", "admin"], required: true },
    message: { type: String },
    attachments: { type: [chatAttachmentSchema], default: [] },
    createdAt: { type: Date, required: true }
  },
  { _id: false }
);

const chatParticipantSchema = new Schema<ChatParticipant>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["buyer", "seller", "admin"], required: true },
    lastReadAt: { type: Date }
  },
  { _id: false }
);

const chatConversationSchema = new Schema<ChatConversation>(
  {
    type: { type: String, enum: ["listing", "support"], required: true, index: true },
    listingId: { type: String, index: true },
    listingTitle: { type: String },
    buyerId: { type: String, index: true },
    sellerId: { type: String, index: true },
    participants: { type: [chatParticipantSchema], default: [] },
    messages: { type: [chatMessageSchema], default: [] },
    lastMessageAt: { type: Date, required: true, index: true },
    lastMessagePreview: { type: String },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    deletedAt: { type: Date, index: true }
  },
  { timestamps: true }
);

chatConversationSchema.index({ buyerId: 1, lastMessageAt: -1 });
chatConversationSchema.index({ sellerId: 1, lastMessageAt: -1 });
chatConversationSchema.index(
  { listingId: 1, buyerId: 1, sellerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      type: "listing",
      listingId: { $exists: true },
      buyerId: { $exists: true },
      sellerId: { $exists: true }
    }
  }
);
chatConversationSchema.index(
  { type: 1, buyerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      type: "support",
      buyerId: { $exists: true }
    }
  }
);

export type ChatConversationDocument = HydratedDocument<ChatConversation>;

export const ChatConversationModel: Model<ChatConversation> =
  mongoose.models.ChatConversation ??
  mongoose.model<ChatConversation>("ChatConversation", chatConversationSchema);
