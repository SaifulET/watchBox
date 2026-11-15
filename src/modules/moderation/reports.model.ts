import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type ReportReason =
  | "spam"
  | "scam"
  | "harassment"
  | "unprofessional"
  | "fake-listing"
  | "other";

export type ReportStatus = "pending" | "resolved" | "dismissed";

export type ReportProofImage = {
  id: string;
  key: string;
  url: string;
  name: string;
  contentType: string;
  size: number;
};

export type UserReport = {
  reporterId: string;
  reportedUserId: string;
  listingId?: string;
  reason: ReportReason;
  message?: string;
  proofImages: ReportProofImage[];
  status: ReportStatus;
  resolvedBy?: string;
  resolvedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const proofImageSchema = new Schema<ReportProofImage>(
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

const userReportSchema = new Schema<UserReport>(
  {
    reporterId: { type: String, required: true, index: true },
    reportedUserId: { type: String, required: true, index: true },
    listingId: { type: String, index: true },
    reason: {
      type: String,
      enum: ["spam", "scam", "harassment", "unprofessional", "fake-listing", "other"],
      required: true
    },
    message: { type: String },
    proofImages: { type: [proofImageSchema], default: [] },
    status: { type: String, enum: ["pending", "resolved", "dismissed"], default: "pending", index: true },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    deletedAt: { type: Date, index: true }
  },
  { timestamps: true }
);

userReportSchema.index({ status: 1, createdAt: -1 });
userReportSchema.index({ reporterId: 1, reportedUserId: 1, createdAt: -1 });

export type UserReportDocument = HydratedDocument<UserReport>;

export const UserReportModel: Model<UserReport> =
  mongoose.models.UserReport ?? mongoose.model<UserReport>("UserReport", userReportSchema);
