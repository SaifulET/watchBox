import { randomUUID } from "node:crypto";
import { ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { deleteObject, uploadObject } from "../../../infrastructure/storage/s3-storage.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import type { ListingImage } from "./listing-images.service.js";

const imageExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

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
        .map((image) => (isListingImage(image) ? image.url : undefined))
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

export class ListingsService {
  public async createListing(
    userId: string,
    body: Record<string, unknown>,
    file: Express.Multer.File | undefined
  ) {
    const data = cleanListingData(body);
    await this.assertUniqueTitle(data.title);

    const listing = await GeneratedApiRecordModel.create({
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

    if (!file) {
      return serializeListing(listing);
    }

    const image = await this.uploadReplacementImage(listing._id.toString(), file, []);
    const updated = await GeneratedApiRecordModel.findByIdAndUpdate(
      listing._id,
      {
        $set: {
          data: {
            ...listing.data,
            images: [image]
          }
        },
        $push: {
          history: {
            action: "listings.images.created",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: { image }
          }
        }
      },
      { new: true }
    );

    return serializeListing(updated ?? listing);
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

  private async uploadReplacementImage(
    listingId: string,
    file: Express.Multer.File,
    imagesToDelete: ListingImage[]
  ): Promise<ListingImage> {
    const extension = imageExtensionByMimeType[file.mimetype];
    if (!extension) {
      throw new ConflictError("Only image/jpeg, image/png, image/webp, and image/gif files are supported.");
    }

    const imageId = randomUUID();
    const key = `listings/${listingId}/images/${imageId}.${extension}`;
    const url = await uploadObject({
      key,
      body: file.buffer,
      contentType: file.mimetype
    });

    await Promise.all(imagesToDelete.map((image) => deleteObject(image.key)));

    return {
      id: imageId,
      key,
      url,
      contentType: file.mimetype,
      sortOrder: 0,
      createdAt: new Date().toISOString()
    };
  }

  private async requireOwnedListing(
    userId: string,
    listingId: string
  ): Promise<GeneratedApiRecordDocument> {
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
      .collation({ locale: "en", strength: 2 })
      .select("_id")
      .lean();

    if (duplicate && duplicate._id.toString() !== excludeListingId) {
      throw new ConflictError("Listing title must be unique. Please use a different title.");
    }
  }
}
