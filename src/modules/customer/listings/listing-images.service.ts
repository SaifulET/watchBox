import { randomUUID } from "node:crypto";
import { ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { deleteObject, uploadObject } from "../../../infrastructure/storage/s3-storage.js";
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
      image: image?.url ?? null
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
    const extension = imageExtensionByMimeType[file.mimetype];
    if (!extension) {
      throw new ConflictError("Only image/jpeg, image/png, image/webp, and image/gif files are supported.");
    }

    const images = existingImages(listing);
    const imageId = randomUUID();
    const key = `listings/${listingId}/images/${imageId}.${extension}`;
    const url = await uploadObject({
      key,
      body: file.buffer,
      contentType: file.mimetype
    });
    const image: ListingImage = {
      id: imageId,
      key,
      url,
      contentType: file.mimetype,
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
