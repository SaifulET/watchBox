import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type { Chrono24Location } from "../chrono24.types.js";

export type Chrono24Listing = {
  listingId: string;
  source: "chrono24";
  title: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  currency: string;
  condition: string;
  year: number | null;
  image: string;
  url: string;
  availability: string;
  location: Chrono24Location | null;
  caseMaterial: string | null;
  movement: string | null;
  description: string | null;
  sellerName: string | null;
  structuredData: Record<string, unknown>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const locationSchema = new Schema<Chrono24Location>(
  {
    raw: String,
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number
  },
  { _id: false }
);

const chrono24ListingSchema = new Schema<Chrono24Listing>(
  {
    listingId: { type: String, required: true, unique: true, index: true },
    source: { type: String, enum: ["chrono24"], default: "chrono24", index: true },
    title: { type: String, required: true, trim: true, index: true },
    brand: { type: String, default: "", trim: true, index: true },
    model: { type: String, default: "", trim: true, index: true },
    reference: { type: String, default: "", trim: true, index: true },
    price: { type: Number, required: true, min: 0, index: true },
    currency: { type: String, default: "USD", trim: true, uppercase: true, index: true },
    condition: { type: String, default: "", trim: true, index: true },
    year: { type: Number, default: null, index: true },
    image: { type: String, default: "", trim: true },
    url: { type: String, required: true, trim: true, index: true },
    availability: { type: String, default: "", trim: true },
    location: { type: locationSchema, default: null },
    caseMaterial: { type: String, default: null, trim: true, index: true },
    movement: { type: String, default: null, trim: true, index: true },
    description: { type: String, default: null, trim: true },
    sellerName: { type: String, default: null, trim: true },
    structuredData: { type: Schema.Types.Mixed, default: {} },
    firstSeenAt: { type: Date, required: true, index: true },
    lastSeenAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

chrono24ListingSchema.index({ brand: 1, model: 1, reference: 1 });
chrono24ListingSchema.index({ price: 1, currency: 1 });
chrono24ListingSchema.index({ "location.latitude": 1, "location.longitude": 1 });

export type Chrono24ListingDocument = HydratedDocument<Chrono24Listing>;

export const Chrono24ListingModel: Model<Chrono24Listing> =
  mongoose.models.Chrono24Listing ??
  mongoose.model<Chrono24Listing>("Chrono24Listing", chrono24ListingSchema);
