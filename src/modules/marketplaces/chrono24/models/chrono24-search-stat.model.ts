import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type Chrono24SearchStat = {
  query: string;
  normalizedQuery: string;
  brand: string | null;
  model: string | null;
  reference: string | null;
  count: number;
  lastSearchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const chrono24SearchStatSchema = new Schema<Chrono24SearchStat>(
  {
    query: { type: String, required: true, trim: true },
    normalizedQuery: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    brand: { type: String, default: null, trim: true, index: true },
    model: { type: String, default: null, trim: true, index: true },
    reference: { type: String, default: null, trim: true, index: true },
    count: { type: Number, default: 0, min: 0, index: true },
    lastSearchedAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

chrono24SearchStatSchema.index({ count: -1, lastSearchedAt: -1 });

export type Chrono24SearchStatDocument = HydratedDocument<Chrono24SearchStat>;

export const Chrono24SearchStatModel: Model<Chrono24SearchStat> =
  mongoose.models.Chrono24SearchStat ??
  mongoose.model<Chrono24SearchStat>("Chrono24SearchStat", chrono24SearchStatSchema);
