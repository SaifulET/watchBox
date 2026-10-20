import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { deleteObject, getObjectUrl, uploadObject } from "../../../infrastructure/storage/s3-storage.js";
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

export class ListingsService {
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
