import mongoose, { type FilterQuery } from "mongoose";
import type {
  Chrono24AnalyticsQuery,
  Chrono24LocationSearchInput,
  Chrono24Product,
  Chrono24SearchQuery
} from "./chrono24.types.js";
import {
  Chrono24ListingModel,
  type Chrono24Listing
} from "./models/chrono24-listing.model.js";
import { Chrono24PriceSnapshotModel } from "./models/chrono24-price-snapshot.model.js";
import { Chrono24SearchStatModel } from "./models/chrono24-search-stat.model.js";

const normalizedText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\s+/g, " ") : undefined;
};

const regexFilter = (value: string): RegExp => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

const listingFilter = (query: Chrono24AnalyticsQuery | Chrono24SearchQuery): FilterQuery<Chrono24Listing> => {
  const filter: FilterQuery<Chrono24Listing> = {};
  const brand = normalizedText(query.brand);
  const model = normalizedText(query.model);
  const reference = normalizedText(query.reference);
  if (brand) {
    filter.brand = regexFilter(brand);
  }
  if (model) {
    filter.model = regexFilter(model);
  }
  if (reference) {
    filter.reference = regexFilter(reference);
  }
  return filter;
};

const searchFilter = (query: Chrono24SearchQuery): FilterQuery<Chrono24Listing> => {
  const filter = listingFilter(query);
  const text = normalizedText(query.q);
  if (text) {
    filter.$or = [
      { title: regexFilter(text) },
      { brand: regexFilter(text) },
      { model: regexFilter(text) },
      { reference: regexFilter(text) }
    ];
  }
  if (typeof query.minPrice === "number" || typeof query.maxPrice === "number") {
    const price: { $gte?: number; $lte?: number } = {};
    if (typeof query.minPrice === "number") {
      price.$gte = query.minPrice;
    }
    if (typeof query.maxPrice === "number") {
      price.$lte = query.maxPrice;
    }
    filter.price = price;
  }
  if (query.condition) {
    filter.condition = regexFilter(query.condition);
  }
  if (query.year) {
    filter.year = query.year;
  }
  if (query.country) {
    filter["location.country"] = regexFilter(query.country);
  }
  return filter;
};

const sortForQuery = (sort: string | undefined): Record<string, 1 | -1> => {
  switch (sort) {
    case "price_asc":
      return { price: 1 };
    case "price_desc":
      return { price: -1 };
    case "newest":
      return { lastSeenAt: -1 };
    default:
      return { lastSeenAt: -1, price: 1 };
  }
};

export const listingToProduct = (listing: Chrono24Listing & { _id?: unknown }): Chrono24Product => ({
  id: listing.listingId,
  source: "chrono24",
  title: listing.title,
  brand: listing.brand,
  model: listing.model,
  reference: listing.reference,
  price: listing.price,
  currency: listing.currency,
  condition: listing.condition,
  year: listing.year,
  image: listing.image,
  url: listing.url,
  availability: listing.availability,
  location: listing.location,
  caseMaterial: listing.caseMaterial,
  movement: listing.movement,
  description: listing.description,
  sellerName: listing.sellerName,
  structuredData: listing.structuredData,
  capturedAt: listing.lastSeenAt.toISOString()
});

const snapshotFromProduct = (product: Chrono24Product, capturedAt: Date) => ({
  listingId: product.id,
  reference: product.reference,
  brand: product.brand,
  model: product.model,
  price: product.price,
  currency: product.currency,
  availability: product.availability,
  capturedAt
});

export class Chrono24Repository {
  public async upsertListings(products: Chrono24Product[], capturedAt = new Date()): Promise<Chrono24Product[]> {
    await Promise.all(
      products.map((product) =>
        Chrono24ListingModel.updateOne(
          { listingId: product.id },
          {
            $set: {
              source: "chrono24",
              title: product.title,
              brand: product.brand,
              model: product.model,
              reference: product.reference,
              price: product.price,
              currency: product.currency,
              condition: product.condition,
              year: product.year,
              image: product.image,
              url: product.url,
              availability: product.availability,
              location: product.location,
              caseMaterial: product.caseMaterial,
              movement: product.movement,
              description: product.description,
              sellerName: product.sellerName,
              structuredData: product.structuredData,
              lastSeenAt: capturedAt
            },
            $setOnInsert: {
              listingId: product.id,
              firstSeenAt: capturedAt
            }
          },
          { upsert: true }
        )
      )
    );
    await this.saveSnapshots(products, capturedAt);
    return products;
  }

  public async saveSnapshots(products: Chrono24Product[], capturedAt = new Date()): Promise<void> {
    if (products.length === 0) {
      return;
    }
    await Chrono24PriceSnapshotModel.insertMany(products.map((product) => snapshotFromProduct(product, capturedAt)), {
      ordered: false
    });
  }

  public async recordSearch(query: Chrono24SearchQuery): Promise<void> {
    const raw = normalizedText([query.q, query.brand, query.model, query.reference].filter(Boolean).join(" ")) ?? "chrono24";
    const normalizedQuery = raw.toLowerCase();
    await Chrono24SearchStatModel.updateOne(
      { normalizedQuery },
      {
        $set: {
          query: raw,
          brand: query.brand ?? null,
          model: query.model ?? null,
          reference: query.reference ?? null,
          lastSearchedAt: new Date()
        },
        $inc: { count: 1 }
      },
      { upsert: true }
    );
  }

  public async findByListingId(listingId: string): Promise<Chrono24Product | null> {
    const listing = await Chrono24ListingModel.findOne({ listingId }).lean();
    return listing ? listingToProduct(listing) : null;
  }

  public async findByUrl(url: string): Promise<Chrono24Product | null> {
    const listing = await Chrono24ListingModel.findOne({ url }).lean();
    return listing ? listingToProduct(listing) : null;
  }

  public async searchStored(query: Chrono24SearchQuery): Promise<{ items: Chrono24Product[]; total: number }> {
    const filter = searchFilter(query);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      Chrono24ListingModel.find(filter)
        .sort(sortForQuery(query.sort))
        .skip(skip)
        .limit(query.limit)
        .lean(),
      Chrono24ListingModel.countDocuments(filter)
    ]);
    return { items: items.map(listingToProduct), total };
  }

  public async analyticsListings(query: Chrono24AnalyticsQuery): Promise<Chrono24Product[]> {
    const listings = await Chrono24ListingModel.find(listingFilter(query)).limit(1000).lean();
    return listings.map(listingToProduct);
  }

  public async snapshots(query: Chrono24AnalyticsQuery, since?: Date) {
    const filter = listingFilter(query) as FilterQuery<{
      brand: string;
      model: string;
      reference: string;
      capturedAt: Date;
    }>;
    if (since) {
      filter.capturedAt = mongoose.trusted({ $gte: since });
    }
    return Chrono24PriceSnapshotModel.find(filter).sort({ capturedAt: 1 }).limit(5000).lean();
  }

  public async latestProducts(limit = 500): Promise<Chrono24Product[]> {
    const listings = await Chrono24ListingModel.find({}).sort({ lastSeenAt: -1 }).limit(limit).lean();
    return listings.map(listingToProduct);
  }

  public async mostSearched(limit = 10): Promise<Array<{ query: string; count: number; lastSearchedAt: string | null }>> {
    const stats = await Chrono24SearchStatModel.find({}).sort({ count: -1, lastSearchedAt: -1 }).limit(limit).lean();
    return stats.map((stat) => ({
      query: stat.query,
      count: stat.count,
      lastSearchedAt: stat.lastSearchedAt?.toISOString() ?? null
    }));
  }

  public async preciseLocationProducts(input: Chrono24LocationSearchInput): Promise<Chrono24Product[]> {
    const filter = listingFilter(input);
    filter["location.latitude"] = { $type: "number" };
    filter["location.longitude"] = { $type: "number" };
    const listings = await Chrono24ListingModel.find(filter).limit(1000).lean();
    return listings.map(listingToProduct);
  }
}
