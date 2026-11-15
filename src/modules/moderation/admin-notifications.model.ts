import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type AdminNotificationType = "report.created" | "report.resolved" | "report.deleted";

export type AdminNotification = {
  type: AdminNotificationType;
  title: string;
  body: string;
  reportId?: string;
  readAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const adminNotificationSchema = new Schema<AdminNotification>(
  {
    type: {
      type: String,
      enum: ["report.created", "report.resolved", "report.deleted"],
      required: true,
      index: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    reportId: { type: String, index: true },
    readAt: { type: Date },
    deletedAt: { type: Date, index: true }
  },
  { timestamps: true }
);

adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ readAt: 1, deletedAt: 1 });

export type AdminNotificationDocument = HydratedDocument<AdminNotification>;

export const AdminNotificationModel: Model<AdminNotification> =
  mongoose.models.AdminNotification ??
  mongoose.model<AdminNotification>("AdminNotification", adminNotificationSchema);
