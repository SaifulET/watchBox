import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type GeneratedApiRecord = {
  resource: string;
  ownerId?: string;
  scope: Record<string, string>;
  data: Record<string, unknown>;
  status: string;
  history: Array<{
    action: string;
    actorId?: string;
    actorType?: string;
    at: Date;
    metadata: Record<string, unknown>;
  }>;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const generatedApiRecordSchema = new Schema<GeneratedApiRecord>(
  {
    resource: { type: String, required: true, index: true },
    ownerId: { type: String, index: true },
    scope: { type: Schema.Types.Mixed, default: {} },
    data: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, default: "active", index: true },
    history: [
      {
        action: { type: String, required: true },
        actorId: String,
        actorType: String,
        at: { type: Date, required: true },
        metadata: { type: Schema.Types.Mixed, default: {} }
      }
    ],
    deletedAt: { type: Date, index: true }
  },
  { timestamps: true }
);

generatedApiRecordSchema.index({ resource: 1, ownerId: 1, deletedAt: 1 });
generatedApiRecordSchema.index({ resource: 1, "scope.key": 1 });

export type GeneratedApiRecordDocument = HydratedDocument<GeneratedApiRecord>;

export const GeneratedApiRecordModel: Model<GeneratedApiRecord> =
  mongoose.models.GeneratedApiRecord ??
  mongoose.model<GeneratedApiRecord>("GeneratedApiRecord", generatedApiRecordSchema);
