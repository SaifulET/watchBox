import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type EbayConnectionStatus = "connected" | "setup_required" | "revoked" | "error";

export type EbayConnection = {
  userId: string;
  dealerId: string;
  ebayUserId: string;
  marketplaceId: string;
  encryptedRefreshToken: string;
  accessTokenExpiresAt: Date;
  merchantLocationKey?: string;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  status: EbayConnectionStatus;
  lastError?: string;
  connectedAt?: Date;
  lastSetupAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const ebayConnectionSchema = new Schema<EbayConnection>(
  {
    userId: { type: String, required: true, index: true },
    dealerId: { type: String, required: true, index: true },
    ebayUserId: { type: String, required: true, trim: true },
    marketplaceId: { type: String, required: true, trim: true, index: true },
    encryptedRefreshToken: { type: String, required: true },
    accessTokenExpiresAt: { type: Date, required: true },
    merchantLocationKey: { type: String, trim: true },
    fulfillmentPolicyId: { type: String, trim: true },
    paymentPolicyId: { type: String, trim: true },
    returnPolicyId: { type: String, trim: true },
    status: {
      type: String,
      enum: ["connected", "setup_required", "revoked", "error"],
      default: "setup_required",
      index: true
    },
    lastError: String,
    connectedAt: Date,
    lastSetupAt: Date
  },
  { timestamps: true }
);

ebayConnectionSchema.index({ userId: 1, marketplaceId: 1 }, { unique: true });
ebayConnectionSchema.index({ dealerId: 1, marketplaceId: 1 });

export type EbayConnectionDocument = HydratedDocument<EbayConnection>;

export const EbayConnectionModel: Model<EbayConnection> =
  mongoose.models.EbayConnection ?? mongoose.model<EbayConnection>("EbayConnection", ebayConnectionSchema);
