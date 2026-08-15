import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { getMarketplaceConfig } from "../../../config/marketplace.config.js";
import { getEnv } from "../../../config/env.js";
import { AppError, ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { decryptString, encryptString } from "../../../common/utils/encryption.js";
import { createLogger, type WatchboxLogger } from "../../../common/utils/logger.js";
import {
  EbayProvider,
  type EbayAspectMetadata,
  type EbayCategoryResolution,
  type EbayInventoryItemInput
} from "../../../infrastructure/external/ebay/ebay-provider.js";
import { GeneratedApiRecordModel, type GeneratedApiRecordDocument } from "../../generated-api/generated-api.model.js";
import { EbayConnectionModel, type EbayConnectionDocument } from "./ebay-connection.model.js";
import type { PublishToEbayInput } from "./ebay.validation.js";

type EbayStatePayload = {
  dealerId: string;
  nonce: string;
  exp: number;
};

type EbayPublishingData = {
  sku?: string;
  categoryId?: string;
  offerId?: string;
  listingId?: string;
  marketplaceId?: string;
  status?: string;
  publishedAt?: string;
  lastError?: string | null;
};

const stateTtlMs = 10 * 60 * 1000;
const defaultWatchCategoryId = "31387";

const signState = (payload: string): string =>
  createHmac("sha256", getEnv().ENCRYPTION_KEY).update(payload).digest("base64url");

const encodeState = (payload: EbayStatePayload): string => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signState(encoded)}`;
};

const decodeState = (state: string): EbayStatePayload => {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    throw new ConflictError("Invalid eBay OAuth state.");
  }
  const expected = signState(encoded);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new ConflictError("Invalid eBay OAuth state.");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as EbayStatePayload;
  if (!payload.dealerId || payload.exp < Date.now()) {
    throw new ConflictError("Expired eBay OAuth state.");
  }
  return payload;
};

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const numberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const firstString = (data: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = stringValue(data[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const imageUrlFromValue = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return firstString(value as Record<string, unknown>, ["url", "imageUrl", "src"]);
  }
  return null;
};

const listingImageUrls = (data: Record<string, unknown>): string[] => {
  const urls = new Set<string>();
  for (const key of ["image", "imageUrl", "thumbnailUrl"]) {
    const url = imageUrlFromValue(data[key]);
    if (url) {
      urls.add(url);
    }
  }
  if (Array.isArray(data.images)) {
    for (const image of data.images) {
      const url = imageUrlFromValue(image);
      if (url) {
        urls.add(url);
      }
    }
  }
  return Array.from(urls).slice(0, 12);
};

const conditionCode = (value: string | null): string => {
  if (!value) {
    return "USED_EXCELLENT";
  }
  const normalized = value.toLowerCase();
  if (normalized.includes("new")) {
    return "NEW";
  }
  if (normalized.includes("poor") || normalized.includes("fair")) {
    return "USED_ACCEPTABLE";
  }
  if (normalized.includes("good")) {
    return "USED_GOOD";
  }
  return "USED_EXCELLENT";
};

const firstPrice = (data: Record<string, unknown>): number | null => {
  for (const key of ["price", "amount", "listingPrice", "salePrice"]) {
    const value = numberValue(data[key]);
    if (value !== null && value > 0) {
      return value;
    }
  }
  return null;
};

const existingPublishing = (listing: GeneratedApiRecordDocument): EbayPublishingData => {
  const value = listing.data.ebayPublishing;
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};
};

const defaultSku = (listingId: string): string => `watchbox-${listingId}`.slice(0, 80);

const aspectKey = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const baseAspectValues = (data: Record<string, unknown>): Record<string, string> => ({
  brand: firstString(data, ["brand", "manufacturer"]) ?? "Unbranded",
  model: firstString(data, ["model", "watchModel"]) ?? firstString(data, ["title", "name"]) ?? "Wristwatch",
  referencenumber: firstString(data, ["referenceNumber", "reference", "mpn"]) ?? "Not Available",
  movement: firstString(data, ["movement"]) ?? "Mechanical (Automatic)",
  yearmanufactured: firstString(data, ["productionYear", "year"]) ?? "Unknown",
  type: "Wristwatch",
  department: firstString(data, ["department", "gender"]) ?? "Unisex Adults"
});

const mappedAspects = (data: Record<string, unknown>, metadata: EbayAspectMetadata[]): Record<string, string[]> => {
  const baseValues = baseAspectValues(data);
  const aspects: Record<string, string[]> = {};
  for (const aspect of metadata) {
    const key = aspectKey(aspect.localizedAspectName);
    const value = baseValues[key];
    if (value) {
      aspects[aspect.localizedAspectName] = [value];
      continue;
    }
    if (aspect.required && aspect.values[0]) {
      aspects[aspect.localizedAspectName] = [aspect.values[0]];
    }
  }
  for (const [key, value] of Object.entries(baseValues)) {
    if (!value) {
      continue;
    }
    const label =
      key === "referencenumber"
        ? "Reference Number"
        : key === "yearmanufactured"
          ? "Year Manufactured"
          : key.charAt(0).toUpperCase() + key.slice(1);
    if (!aspects[label]) {
      aspects[label] = [value];
    }
  }
  return aspects;
};

const serializeConnection = (connection: EbayConnectionDocument) => ({
  id: connection._id.toString(),
  userId: connection.userId,
  dealerId: connection.dealerId,
  ebayUserId: connection.ebayUserId,
  marketplaceId: connection.marketplaceId,
  merchantLocationKey: connection.merchantLocationKey ?? null,
  fulfillmentPolicyId: connection.fulfillmentPolicyId ?? null,
  paymentPolicyId: connection.paymentPolicyId ?? null,
  returnPolicyId: connection.returnPolicyId ?? null,
  status: connection.status,
  connectedAt: connection.connectedAt?.toISOString() ?? null,
  lastSetupAt: connection.lastSetupAt?.toISOString() ?? null
});

const isBusinessPolicyEligibilityError = (error: unknown): boolean =>
  error instanceof AppError &&
  error.code === "EBAY_API_ERROR" &&
  /Business Policy/i.test(error.message);

export class EbayService {
  private readonly ebay = new EbayProvider();
  private readonly logger: WatchboxLogger;

  public constructor(logger: WatchboxLogger = createLogger({ service: "ebay" })) {
    this.logger = logger;
  }

  public connectUrl(dealerId: string): string {
    return this.ebay.oauthConsentUrl(
      encodeState({
        dealerId,
        nonce: randomUUID(),
        exp: Date.now() + stateTtlMs
      })
    );
  }

  public async handleOAuthCallback(code: string, state: string) {
    const payload = decodeState(state);
    const marketplaceId = getMarketplaceConfig().ebay.marketplaceId;
    const tokenSet = await this.ebay.exchangeAuthorizationCode(code);
    const seller = await this.ebay.getSellerUser(tokenSet.accessToken);
    let connection = await EbayConnectionModel.findOneAndUpdate(
      { userId: payload.dealerId, marketplaceId },
      {
        $set: {
          userId: payload.dealerId,
          dealerId: payload.dealerId,
          ebayUserId: seller.ebayUserId,
          marketplaceId,
          encryptedRefreshToken: encryptString(tokenSet.refreshToken),
          accessTokenExpiresAt: tokenSet.accessTokenExpiresAt,
          status: "setup_required",
          connectedAt: new Date(),
          lastError: null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
      const setup = await this.ebay.getOrCreateSellerSetup(tokenSet.accessToken, payload.dealerId);
      connection = await EbayConnectionModel.findByIdAndUpdate(
        connection._id,
        {
          $set: {
            ...setup,
            status: "connected",
            accessTokenExpiresAt: tokenSet.accessTokenExpiresAt,
            lastSetupAt: new Date(),
            lastError: null
          }
        },
        { new: true }
      ) ?? connection;
      this.logger.info({ dealerId: payload.dealerId, ebayUserId: seller.ebayUserId }, "eBay seller connected");
      return {
        connected: true,
        connection: serializeConnection(connection)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "eBay seller setup failed.";
      if (isBusinessPolicyEligibilityError(error)) {
        const updated = await EbayConnectionModel.findByIdAndUpdate(
          connection._id,
          {
            $set: {
              status: "setup_required",
              lastError: message
            }
          },
          { new: true }
        ) ?? connection;
        this.logger.warn({ err: error, dealerId: payload.dealerId }, "eBay seller business policy setup required");
        return {
          connected: true,
          setupRequired: true,
          message: "eBay account connected. Enable eBay Business Policies before publishing listings.",
          connection: serializeConnection(updated)
        };
      }
      await EbayConnectionModel.findByIdAndUpdate(connection._id, {
        $set: {
          status: "error",
          lastError: message
        }
      });
      this.logger.error({ err: error, dealerId: payload.dealerId }, "eBay seller setup failed");
      throw error;
    }
  }

  public handleOAuthDeclined(state: string | undefined) {
    const payload = state ? decodeState(state) : null;
    return {
      connected: false,
      dealerId: payload?.dealerId ?? null,
      status: "declined"
    };
  }

  public async publishListingToEbay(dealerId: string, listingId: string, input: PublishToEbayInput) {
    const listing = await this.requireOwnedListing(dealerId, listingId);
    const existing = existingPublishing(listing);
    if (existing.status === "published" && existing.listingId) {
      return {
        listingId,
        marketplace: "ebay",
        marketplaceId: existing.marketplaceId ?? getMarketplaceConfig().ebay.marketplaceId,
        sku: existing.sku ?? null,
        categoryId: existing.categoryId ?? null,
        offerId: existing.offerId ?? null,
        ebayListingId: existing.listingId,
        status: "published",
        duplicate: true
      };
    }
    if (existing.status === "publishing") {
      throw new ConflictError("This listing is already being published to eBay.");
    }

    const connection = await this.requireReadyConnection(dealerId);
    const accessToken = await this.freshAccessToken(connection);
    const locked = await this.lockListingForPublish(dealerId, listing, existing);
    const lockedPublishing = existingPublishing(locked);

    try {
      const category = lockedPublishing.categoryId
        ? { categoryId: lockedPublishing.categoryId, categoryTreeId: null, categoryName: null }
        : await this.resolveCategory(locked);
      const item = await this.ebayItemFromListing(locked, connection, category, lockedPublishing);

      await this.ebay.createOrReplaceInventoryItem(accessToken, item);
      const offers = await this.ebay.getOffersBySku(accessToken, item.sku, item.marketplaceId);
      const existingOffer = lockedPublishing.offerId
        ? offers.find((offer) => offer.offerId === lockedPublishing.offerId)
        : offers[0];
      const offerId = existingOffer?.offerId ?? await this.ebay.createOffer(accessToken, item);
      if (existingOffer?.offerId) {
        await this.ebay.updateOffer(accessToken, existingOffer.offerId, item);
      }

      const publishResult =
        input.publish === false
          ? { listingId: existingOffer?.listingId ?? null, listingUrl: null }
          : existingOffer?.listingId
            ? { listingId: existingOffer.listingId, listingUrl: `https://www.ebay.com/itm/${existingOffer.listingId}` }
            : await this.ebay.publishOffer(accessToken, offerId);

      const status = input.publish === false ? "offer_created" : "published";
      const publishData: EbayPublishingData = {
        sku: item.sku,
        categoryId: item.categoryId,
        offerId,
        marketplaceId: item.marketplaceId ?? getMarketplaceConfig().ebay.marketplaceId,
        status,
        lastError: null
      };
      if (publishResult.listingId) {
        publishData.listingId = publishResult.listingId;
      }
      if (status === "published") {
        publishData.publishedAt = new Date().toISOString();
      }
      const saved = await this.savePublishSuccess(dealerId, listingId, publishData);
      this.logger.info({ dealerId, listingId, offerId, ebayListingId: publishResult.listingId }, "Published listing to eBay");
      return {
        listingId,
        marketplace: "ebay",
        marketplaceId: item.marketplaceId,
        sku: item.sku,
        categoryId: item.categoryId,
        offerId,
        ebayListingId: publishResult.listingId,
        status,
        duplicate: false,
        record: saved
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "eBay publishing failed.";
      await this.savePublishFailure(dealerId, listingId, lockedPublishing, message);
      this.logger.error({ err: error, dealerId, listingId }, "eBay publishing failed");
      throw error;
    }
  }

  private async requireOwnedListing(dealerId: string, listingId: string): Promise<GeneratedApiRecordDocument> {
    if (!mongoose.isValidObjectId(listingId)) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    const listing = await GeneratedApiRecordModel.findOne({
      _id: listingId,
      resource: "listings",
      ownerId: dealerId,
      deletedAt: null
    });
    if (!listing) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    return listing;
  }

  private async requireReadyConnection(dealerId: string): Promise<EbayConnectionDocument> {
    const connection = await EbayConnectionModel.findOne({
      dealerId,
      marketplaceId: getMarketplaceConfig().ebay.marketplaceId
    });
    if (!connection || connection.status === "revoked") {
      throw new ConflictError("Connect an eBay seller account before publishing.");
    }
    return connection;
  }

  private async freshAccessToken(connection: EbayConnectionDocument): Promise<string> {
    const refreshToken = decryptString(connection.encryptedRefreshToken);
    const refreshed = await this.ebay.refreshUserAccessToken(refreshToken);
    await EbayConnectionModel.findByIdAndUpdate(connection._id, {
      $set: {
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
        status: connection.status === "error" ? "setup_required" : connection.status
      }
    });
    if (
      !connection.merchantLocationKey ||
      !connection.fulfillmentPolicyId ||
      !connection.paymentPolicyId ||
      !connection.returnPolicyId
    ) {
      const setup = await this.ebay.getOrCreateSellerSetup(refreshed.accessToken, connection.dealerId);
      await EbayConnectionModel.findByIdAndUpdate(connection._id, {
        $set: {
          ...setup,
          status: "connected",
          lastSetupAt: new Date(),
          lastError: null
        }
      });
      connection.merchantLocationKey = setup.merchantLocationKey;
      connection.fulfillmentPolicyId = setup.fulfillmentPolicyId;
      connection.paymentPolicyId = setup.paymentPolicyId;
      connection.returnPolicyId = setup.returnPolicyId;
      connection.status = "connected";
    }
    return refreshed.accessToken;
  }

  private async lockListingForPublish(
    dealerId: string,
    listing: GeneratedApiRecordDocument,
    previous: EbayPublishingData
  ): Promise<GeneratedApiRecordDocument> {
    const lock = await GeneratedApiRecordModel.findOneAndUpdate(
      {
        _id: listing._id,
        ownerId: dealerId,
        resource: "listings",
        deletedAt: null,
        $or: [
          { "data.ebayPublishing.status": { $exists: false } },
          { "data.ebayPublishing.status": { $nin: ["publishing", "published"] } }
        ]
      },
      {
        $set: {
          "data.ebayPublishing": {
            ...previous,
            sku: previous.sku ?? defaultSku(listing._id.toString()),
            marketplaceId: previous.marketplaceId ?? getMarketplaceConfig().ebay.marketplaceId,
            status: "publishing",
            lastError: null
          }
        }
      },
      { new: true }
    );
    if (!lock) {
      throw new ConflictError("This listing is already being published or was already published to eBay.");
    }
    return lock;
  }

  private async resolveCategory(listing: GeneratedApiRecordDocument): Promise<EbayCategoryResolution> {
    const title = firstString(listing.data, ["title", "name", "generatedTitle"]);
    if (!title) {
      throw new ConflictError("Listing title is required before publishing to eBay.");
    }
    return this.ebay.resolveCategory(title);
  }

  private async ebayItemFromListing(
    listing: GeneratedApiRecordDocument,
    connection: EbayConnectionDocument,
    category: EbayCategoryResolution,
    publishing: EbayPublishingData
  ): Promise<EbayInventoryItemInput> {
    const title = firstString(listing.data, ["title", "name", "generatedTitle"]);
    if (!title) {
      throw new ConflictError("Listing title is required before publishing to eBay.");
    }
    const price = firstPrice(listing.data);
    if (price === null) {
      throw new ConflictError("Listing price is required before publishing to eBay.");
    }
    const merchantLocationKey = connection.merchantLocationKey;
    const fulfillmentPolicyId = connection.fulfillmentPolicyId;
    const paymentPolicyId = connection.paymentPolicyId;
    const returnPolicyId = connection.returnPolicyId;
    if (!merchantLocationKey || !fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
      throw new ConflictError("eBay seller setup is incomplete. Reconnect the eBay seller account.");
    }
    const aspectMetadata = category.categoryTreeId
      ? await this.ebay.getItemAspectsForCategory(category.categoryTreeId, category.categoryId)
      : [];
    return {
      sku: publishing.sku ?? defaultSku(listing._id.toString()),
      title: title.slice(0, 80),
      description:
        firstString(listing.data, ["description", "details", "summary"]) ??
        `${title} listed from Watchbox.`,
      price,
      currency: firstString(listing.data, ["currency", "priceCurrency"]) ?? "USD",
      quantity: Math.max(1, Math.round(numberValue(listing.data.quantity) ?? 1)),
      condition: conditionCode(firstString(listing.data, ["condition"])),
      categoryId: category.categoryId || defaultWatchCategoryId,
      merchantLocationKey,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
      marketplaceId: connection.marketplaceId,
      format: "FIXED_PRICE",
      imageUrls: listingImageUrls(listing.data),
      aspects: mappedAspects(listing.data, aspectMetadata)
    };
  }

  private async savePublishSuccess(
    dealerId: string,
    listingId: string,
    data: EbayPublishingData
  ) {
    await GeneratedApiRecordModel.findOneAndUpdate(
      {
        _id: listingId,
        ownerId: dealerId,
        resource: "listings",
        deletedAt: null
      },
      {
        $set: {
          "data.ebayPublishing": data
        },
        $push: {
          history: {
            action: data.status === "published" ? "listings.ebay.published" : "listings.ebay.offer-created",
            actorId: dealerId,
            actorType: "customer",
            at: new Date(),
            metadata: data
          }
        }
      }
    );
    return data;
  }

  private async savePublishFailure(
    dealerId: string,
    listingId: string,
    previous: EbayPublishingData,
    message: string
  ): Promise<void> {
    await GeneratedApiRecordModel.findOneAndUpdate(
      {
        _id: listingId,
        ownerId: dealerId,
        resource: "listings",
        deletedAt: null
      },
      {
        $set: {
          "data.ebayPublishing": {
            ...previous,
            status: "error",
            lastError: message
          }
        },
        $push: {
          history: {
            action: "listings.ebay.publish-failed",
            actorId: dealerId,
            actorType: "customer",
            at: new Date(),
            metadata: {
              ...previous,
              lastError: message
            }
          }
        }
      }
    );
  }
}
