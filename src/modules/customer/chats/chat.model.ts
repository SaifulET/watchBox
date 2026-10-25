import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type ChatMessage = {
  _id: mongoose.Types.ObjectId;
  senderId: string;
  content: string;
  messageType: "text" | "image" | "file";
  fileUrl?: string;
  seenBy: string[];
  createdAt: Date;
};

export type MarketplaceChat = {
  participants: string[];
  listingId?: string;
  subject: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
};

const messageSchema = new Schema<ChatMessage>(
  {
    senderId: { type: String, required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    messageType: { type: String, enum: ["text", "image", "file"], default: "text" },
    fileUrl: String,
    seenBy: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const chatSchema = new Schema<MarketplaceChat>(
  {
    participants: { type: [String], required: true, index: true },
    listingId: { type: String, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 240 },
    messages: { type: [messageSchema], default: [] }
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1, listingId: 1 });

export type MarketplaceChatDocument = HydratedDocument<MarketplaceChat>;
export const MarketplaceChatModel: Model<MarketplaceChat> =
  mongoose.models.MarketplaceChat ?? mongoose.model<MarketplaceChat>("MarketplaceChat", chatSchema);
