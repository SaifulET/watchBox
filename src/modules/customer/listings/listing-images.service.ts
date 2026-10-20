import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { deleteObject, resolveStoredObjectUrl, uploadObject } from "../../../infrastructure/storage/s3-storage.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";

export type ListingImage = {
  id: string;
  key: string;
  url: string;
  contentType: string;
  sortOrder: number;
  createdAt: string;
};

export type ListingImageResponse = {
  image: string | null;
};

const imageExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const listingImageMaxEdge = 1600;
const skipOptimizeBelowBytes = 250 * 1024;

export const optimizeListingImage = async (
  file: Express.Multer.File
): Promise<{ buffer: Buffer; contentType: string; extension: string }> => {
  const extension = imageExtensionByMimeType[file.mimetype];
  if (!extension) {
    throw new ConflictError("Only image/jpeg, image/png, image/webp, and image/gif files are supported.");
  }
  if (file.mimetype === "image/gif") {
    return { buffer: file.buffer, contentType: file.mimetype, extension };
  }
  if (file.mimetype === "image/jpeg" && file.buffer.length <= skipOptimizeBelowBytes) {
    return { buffer: file.buffer, contentType: file.mimetype, extension };
  }

  const optimized = await sharp(file.buffer)
    .rotate()
    .resize(listingImageMaxEdge, listingImageMaxEdge, {
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: 74, chromaSubsampling: "4:2:0" })
    .toBuffer();

  if (optimized.length >= file.buffer.length && file.mimetype === "image/jpeg") {
    return { buffer: file.buffer, contentType: file.mimetype, extension };
  }
  return { buffer: optimized, contentType: "image/jpeg", extension: "jpg" };
};

const isListingImage = (value: unknown): value is ListingImage =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as ListingImage).id === "string" &&
  typeof (value as ListingImage).key === "string" &&
  typeof (value as ListingImage).url === "string";

const existingImages = (listing: GeneratedApiRecordDocument): ListingImage[] =>
  Array.isArray(listing.data.images) ? listing.data.images.filter(isListingImage) : [];

export class ListingImagesService {
  public async listImages(userId: string, listingId: string): Promise<ListingImageResponse> {
    const listing = await this.requireOwnedListing(userId, listingId);
    const image = existingImages(listing)[0];
    return {
      image: image ? await resolveStoredObjectUrl(image.key, image.url) : null
    };
  }

  public async uploadImage(
    userId: string,
    listingId: string,
    file: Express.Multer.File | undefined
  ): Promise<{ image: string }> {
    const listing = await this.requireOwnedListing(userId, listingId);
    if (!file) {
      throw new ConflictError("Image file is required.");
    }
    const optimized = await optimizeListingImage(file);
    const images = existingImages(listing);
    const imageId = randomUUID();
    const key = `listings/${listingId}/images/${imageId}.${optimized.extension}`;
    const url = await uploadObject({
      key,
      body: optimized.buffer,
      contentType: optimized.contentType
    });
    const image: ListingImage = {
      id: imageId,
      key,
      url,
      contentType: optimized.contentType,
      sortOrder: 0,
      createdAt: new Date().toISOString()
    };

    await Promise.all(images.map((existingImage) => deleteObject(existingImage.key)));

    await GeneratedApiRecordModel.findByIdAndUpdate(
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
            action: "listings.images.replaced",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: {
              image,
              replacedImageIds: images.map((existingImage) => existingImage.id)
            }
          }
        }
      },
      { new: true }
    );

    return { image: image.url };
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
}
