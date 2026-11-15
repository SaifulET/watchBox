import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type UserBlock = {
  blockerId: string;
  blockedId: string;
  createdAt: Date;
  updatedAt: Date;
};

const userBlockSchema = new Schema<UserBlock>(
  {
    blockerId: { type: String, required: true, index: true },
    blockedId: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

userBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export type UserBlockDocument = HydratedDocument<UserBlock>;

export const UserBlockModel: Model<UserBlock> =
  mongoose.models.UserBlock ?? mongoose.model<UserBlock>("UserBlock", userBlockSchema);
