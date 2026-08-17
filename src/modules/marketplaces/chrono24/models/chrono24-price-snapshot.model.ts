import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type Chrono24PriceSnapshot = {
  listingId: string;
  reference: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  availability: string;
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const chrono24PriceSnapshotSchema = new Schema<Chrono24PriceSnapshot>(
  {
    listingId: { type: String, required: true, index: true },
    reference: { type: String, default: "", trim: true, index: true },
    brand: { type: String, default: "", trim: true, index: true },
    model: { type: String, default: "", trim: true, index: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", trim: true, uppercase: true, index: true },
    availability: { type: String, default: "", trim: true },
    capturedAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

chrono24PriceSnapshotSchema.index({ listingId: 1, capturedAt: 1 });
chrono24PriceSnapshotSchema.index({ brand: 1, model: 1, reference: 1, capturedAt: 1 });

export type Chrono24PriceSnapshotDocument = HydratedDocument<Chrono24PriceSnapshot>;

export const Chrono24PriceSnapshotModel: Model<Chrono24PriceSnapshot> =
  mongoose.models.Chrono24PriceSnapshot ??
  mongoose.model<Chrono24PriceSnapshot>("Chrono24PriceSnapshot", chrono24PriceSnapshotSchema);
