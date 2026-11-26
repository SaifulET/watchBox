import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import {
  deleteObject,
  getObjectUrl,
  resolveStoredObjectUrl,
  uploadObject
} from "../../../infrastructure/storage/s3-storage.js";
import { CustomerAccountModel } from "../auth/auth.model.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import { optimizeListingImage, type ListingImage } from "./listing-images.service.js";

const protectedImageFields = new Set(["image", "imageUrl", "images"]);

const isListingImage = (value: unknown): value is ListingImage =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as ListingImage).id === "string" &&
  typeof (value as ListingImage).key === "string" &&
  typeof (value as ListingImage).url === "string";

const existingImages = (listing: GeneratedApiRecordDocument): ListingImage[] =>
  Array.isArray(listing.data.images) ? listing.data.images.filter(isListingImage) : [];

const normalizeListingField = (key: string, value: unknown): unknown => {
  if (key === "price" && typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
};

const cleanListingData = (body: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(body)
      .filter(([key]) => !protectedImageFields.has(key))
      .map(([key, value]) => [key, normalizeListingField(key, value)])
  );

const publicListingData = (data: Record<string, unknown>): Record<string, unknown> => {
  const imageUrls = Array.isArray(data.images)
    ? data.images
        .map((image) => (isListingImage(image) ? getObjectUrl(image.key) : undefined))
        .filter((url): url is string => Boolean(url))
    : [];
  const output = { ...data };
  delete output.images;
  output.image = imageUrls[0] ?? null;
  return output;
};

const serializeListing = (listing: GeneratedApiRecordDocument) => ({
  id: listing._id.toString(),
  resource: listing.resource,
  ownerId: listing.ownerId ?? null,
  scope: listing.scope,
  data: publicListingData(listing.data),
  status: listing.status,
  createdAt: listing.createdAt.toISOString(),
  updatedAt: listing.updatedAt.toISOString()
});

type ListingOwnerInfo = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type ListListingsQuery = {
  page?: unknown;
  limit?: unknown;
  q?: unknown;
  search?: unknown;
  brand?: unknown;
  model?: unknown;
  status?: unknown;
  condition?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  ownerId?: unknown;
};

const parsePositiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const stringQuery = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const numberQuery = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STATUS_BUCKET_MAP: Record<string, string> = {
  drafts: "draft",
  draft: "draft",
  pending: "pending",
  active: "active",
  published: "active",
  paused: "paused",
  rejected: "rejected",
  sold: "sold",
  archived: "archived"
};

const ACTION_STATUS_MAP: Record<string, string> = {
  submit: "pending",
  publish: "active",
  pause: "paused",
  resume: "active",
  archive: "archived",
  "mark-sold": "sold",
  reserve: "reserved",
  unreserve: "active"
};

const resolveListingData = async (data: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const output = { ...data };
  let imageUrl: string | null = null;
  if (Array.isArray(data.images)) {
    for (const image of data.images) {
      if (isListingImage(image)) {
        const resolved = await resolveStoredObjectUrl(image.key, image.url);
        if (resolved) {
          imageUrl = resolved;
          break;
        }
      }
    }
  }
  delete output.images;
  output.image = imageUrl;
  return output;
};

const loadOwnersMap = async (
  records: GeneratedApiRecordDocument[]
): Promise<Map<string, ListingOwnerInfo>> => {
  const ownerIds = Array.from(
    new Set(
      records
        .map((record) => record.ownerId)
        .filter((ownerId): ownerId is string => Boolean(ownerId && mongoose.isValidObjectId(ownerId)))
    )
  );
  if (ownerIds.length === 0) {
    return new Map();
  }
  const accounts = await Promise.all(
    ownerIds.map((ownerId) =>
      CustomerAccountModel.findById(ownerId).select("displayName avatarUrl deletedAt").lean()
    )
  );
  const map = new Map<string, ListingOwnerInfo>();
  for (const account of accounts) {
    if (!account || account.deletedAt || typeof account.displayName !== "string") {
      continue;
    }
    const id = String(account._id);
    map.set(id, {
      id,
      displayName: account.displayName,
      avatarUrl: typeof account.avatarUrl === "string" ? account.avatarUrl : null
    });
  }
  return map;
};

const serializeListingWithOwner = async (
  listing: GeneratedApiRecordDocument,
  ownerMap: Map<string, ListingOwnerInfo>
) => ({
  id: listing._id.toString(),
  resource: listing.resource,
  ownerId: listing.ownerId ?? null,
  owner: listing.ownerId ? (ownerMap.get(listing.ownerId) ?? null) : null,
  scope: listing.scope,
  data: await resolveListingData(listing.data),
  status: listing.status,
  createdAt: listing.createdAt.toISOString(),
  updatedAt: listing.updatedAt.toISOString()
});

export class ListingsService {
  public async listListings(query: ListListingsQuery, ownerIdOverride?: string, statusBucket?: string) {
    const page = parsePositiveInt(query.page, 1, 1000);
    const limit = parsePositiveInt(query.limit, 20, 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      resource: "listings",
      deletedAt: null
    };

    const resolvedOwnerId = ownerIdOverride ?? stringQuery(query.ownerId);
    if (resolvedOwnerId) {
      filter.ownerId = resolvedOwnerId;
    }

    const rawStatus = statusBucket ?? stringQuery(query.status);
    if (rawStatus) {
      const normalizedStatus = STATUS_BUCKET_MAP[rawStatus.toLowerCase()] ?? rawStatus.toLowerCase();
      filter.status = normalizedStatus;
    }

    const brand = stringQuery(query.brand);
    if (brand) {
      filter["data.brand"] = mongoose.trusted({ $regex: escapeRegex(brand), $options: "i" });
    }

    const model = stringQuery(query.model);
    if (model) {
      filter["data.model"] = mongoose.trusted({ $regex: escapeRegex(model), $options: "i" });
    }

    const condition = stringQuery(query.condition);
    if (condition) {
      filter["data.condition"] = mongoose.trusted({ $regex: escapeRegex(condition), $options: "i" });
    }

    const minPrice = numberQuery(query.minPrice);
    const maxPrice = numberQuery(query.maxPrice);
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceRange: Record<string, number> = {};
      if (minPrice !== undefined) priceRange.$gte = minPrice;
      if (maxPrice !== undefined) priceRange.$lte = maxPrice;
      filter["data.price"] = mongoose.trusted(priceRange);
    }

    const search = stringQuery(query.q) ?? stringQuery(query.search);
    if (search) {
      const pattern = mongoose.trusted({ $regex: escapeRegex(search), $options: "i" });
      filter.$or = mongoose.trusted([
        { "data.title": pattern },
        { "data.brand": pattern },
        { "data.model": pattern },
        { "data.referenceNumber": pattern },
        { "data.reference": pattern }
      ]);
    }

    const [records, total] = await Promise.all([
      GeneratedApiRecordModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      GeneratedApiRecordModel.countDocuments(filter)
    ]);

    const ownerMap = await loadOwnersMap(records);
    const items = await Promise.all(
      records.map((record) => serializeListingWithOwner(record, ownerMap))
    );

    return {
      items,
      meta: {
        page,
        limit,
        count: items.length,
        total,
        hasMore: skip + items.length < total
      }
    };
  }

  public async getListingById(listingId: string) {
    if (!mongoose.isValidObjectId(listingId)) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    const listing = await GeneratedApiRecordModel.findOne({
      _id: listingId,
      resource: "listings",
      deletedAt: null
    });
    if (!listing) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    const ownerMap = await loadOwnersMap([listing]);
    return serializeListingWithOwner(listing, ownerMap);
  }

  public async deleteListing(userId: string, listingId: string) {
    const listing = await this.requireOwnedListing(userId, listingId);
    const now = new Date();
    await GeneratedApiRecordModel.findByIdAndUpdate(listing._id, {
      $set: {
        deletedAt: now,
        status: "deleted"
      },
      $push: {
        history: {
          action: "listings.deleted",
          actorId: userId,
          actorType: "customer",
          at: now,
          metadata: {}
        }
      }
    });
    return {
      id: listing._id.toString(),
      deleted: true
    };
  }

  public async transitionStatus(userId: string, listingId: string, action: string) {
    const listing = await this.requireOwnedListing(userId, listingId);
    const nextStatus = ACTION_STATUS_MAP[action] ?? listing.status;
    const now = new Date();
    const updated = await GeneratedApiRecordModel.findByIdAndUpdate(
      listing._id,
      {
        $set: { status: nextStatus },
        $push: {
          history: {
            action: `listings.${action}`,
            actorId: userId,
            actorType: "customer",
            at: now,
            metadata: { status: nextStatus }
          }
        }
      },
      { new: true }
    );
    const ownerMap = await loadOwnersMap([updated ?? listing]);
    return serializeListingWithOwner(updated ?? listing, ownerMap);
  }

  public async createListing(
    userId: string,
    body: Record<string, unknown>,
    file: Express.Multer.File | undefined
  ) {
    const data = cleanListingData(body);
    const listingId = new mongoose.Types.ObjectId();
    let image: ListingImage | undefined;
    try {
      [, image] = await Promise.all([
        this.assertUniqueTitle(data.title),
        file ? this.buildListingImage(listingId.toString(), file) : Promise.resolve(undefined)
      ]);
    } catch (error) {
      if (image) {
        void deleteObject(image.key);
      }
      throw error;
    }
    if (image) {
      data.images = [image];
    }

    const listing = await GeneratedApiRecordModel.create({
      _id: listingId,
      resource: "listings",
      ownerId: userId,
      scope: {},
      data,
      status: "active",
      history: [
        {
          action: "listings.created",
          actorId: userId,
          actorType: "customer",
          at: new Date(),
          metadata: data
        }
      ]
    });

    return serializeListing(listing);
  }

  public async updateListing(
    userId: string,
    listingId: string,
    body: Record<string, unknown>,
    file: Express.Multer.File | undefined
  ) {
    const listing = await this.requireOwnedListing(userId, listingId);
    const data = cleanListingData(body);
    if (Object.keys(data).length === 0 && !file) {
      throw new ConflictError("No listing changes were provided.");
    }
    if (typeof data.title === "string" && data.title !== listing.data.title) {
      await this.assertUniqueTitle(data.title, listingId);
    }
    const dataChanged = Object.entries(data).some(([key, value]) => listing.data[key] !== value);
    if (!dataChanged && !file) {
      throw new ConflictError("No listing changes were detected.");
    }

    const updateData = {
      ...listing.data,
      ...data
    };

    if (file) {
      updateData.images = [await this.uploadReplacementImage(listingId, file, existingImages(listing))];
    }

    const updated = await GeneratedApiRecordModel.findByIdAndUpdate(
      listing._id,
      {
        $set: { data: updateData },
        $push: {
          history: {
            action: file ? "listings.updated-with-image" : "listings.updated",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: data
          }
        }
      },
      { new: true }
    );

    return serializeListing(updated ?? listing);
  }

  private async buildListingImage(listingId: string, file: Express.Multer.File): Promise<ListingImage> {
    const optimized = await optimizeListingImage(file);
    const imageId = randomUUID();
    const key = `listings/${listingId}/images/${imageId}.${optimized.extension}`;
    const url = await uploadObject({
      key,
      body: optimized.buffer,
      contentType: optimized.contentType
    });
    return {
      id: imageId,
      key,
      url,
      contentType: optimized.contentType,
      sortOrder: 0,
      createdAt: new Date().toISOString()
    };
  }

  private async uploadReplacementImage(
    listingId: string,
    file: Express.Multer.File,
    imagesToDelete: ListingImage[]
  ): Promise<ListingImage> {
    const image = await this.buildListingImage(listingId, file);
    void Promise.all(imagesToDelete.map((existingImage) => deleteObject(existingImage.key)));
    return image;
  }

  private async requireOwnedListing(
    userId: string,
    listingId: string
  ): Promise<GeneratedApiRecordDocument> {
    if (!mongoose.isValidObjectId(listingId)) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    const listing = await GeneratedApiRecordModel.findOne({
      _id: listingId,
      resource: "listings",
      ownerId: userId,
      deletedAt: null
    });
    if (!listing) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    return listing;
  }

  private async assertUniqueTitle(title: unknown, excludeListingId?: string): Promise<void> {
    if (typeof title !== "string" || !title.trim()) {
      return;
    }

    const duplicate = await GeneratedApiRecordModel.findOne({
      resource: "listings",
      deletedAt: null,
      "data.title": title.trim()
    })
      .select("_id")
      .lean();

    if (duplicate && duplicate._id.toString() !== excludeListingId) {
      throw new ConflictError("Listing title must be unique. Please use a different title.");
    }
  }
}
