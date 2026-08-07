import { ConflictError, ExternalServiceError } from "../../../common/errors/app-error.js";
import { getMarketplaceConfig } from "../../../config/marketplace.config.js";

export type MarketplaceListing = {
  externalId: string;
  title: string;
  brand?: string;
  model?: string;
  referenceNumber?: string;
  price: number;
  currency: string;
  sourceUrl: string;
  imageUrl?: string;
  condition?: string;
  productionYear?: number;
  movement?: string;
  scope?: string;
  aspects?: Record<string, string>;
  sellerUsername?: string;
  sellerFeedbackScore?: number;
  sellerFeedbackPercentage?: string;
  location?: string;
  buyingOptions: string[];
};

export type MarketplaceSearchResult = {
  total: number | null;
  items: MarketplaceListing[];
};

export type MarketplaceListingDetails = MarketplaceListing & {
  description?: string;
  itemCreationDate?: string;
  itemEndDate?: string;
};

export interface MarketplaceProvider {
  code: "EBAY" | "CHRONO24" | "GRAILZEE";
  searchListings(query: string, options?: MarketplaceSearchOptions): Promise<MarketplaceListing[]>;
  checkConnectivity(): Promise<boolean>;
}

export type MarketplaceSearchOptions = {
  limit?: number;
  marketplaceId?: string;
  minPrice?: number;
  maxPrice?: number;
  priceCurrency?: string;
};

type EbayTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type EbaySearchResponse = {
  total?: number;
  itemSummaries?: EbayItemSummary[];
};

type EbayItemResponse = EbayItemSummary & {
  description?: string;
  itemCreationDate?: string;
  itemEndDate?: string;
};

type EbayItemSummary = {
  itemId?: string;
  title?: string;
  price?: {
    value?: string;
    currency?: string;
  };
  itemWebUrl?: string;
  image?: {
    imageUrl?: string;
  };
  condition?: string;
  localizedAspects?: Array<{
    name?: string;
    value?: string;
  }>;
  itemSpecifics?: Array<{
    name?: string;
    value?: string;
  }>;
  seller?: {
    username?: string;
    feedbackScore?: number;
    feedbackPercentage?: string;
  };
  itemLocation?: {
    city?: string;
    stateOrProvince?: string;
    country?: string;
  };
  buyingOptions?: string[];
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

const endpointBaseByEnvironment = {
  sandbox: "https://api.sandbox.ebay.com",
  production: "https://api.ebay.com"
} as const;

const defaultScope = "https://api.ebay.com/oauth/api_scope";

const parseLimit = (limit: number | undefined): number => {
  if (typeof limit === "undefined") {
    return 20;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new ConflictError("eBay search limit must be between 1 and 200.");
  }
  return limit;
};

const compactLocation = (location: EbayItemSummary["itemLocation"]): string | undefined => {
  if (!location) {
    return undefined;
  }
  return [location.city, location.stateOrProvince, location.country].filter(Boolean).join(", ") || undefined;
};

const normalizeAspectName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ebayAspects = (item: EbayItemSummary): Record<string, string> => {
  const entries = [...(item.localizedAspects ?? []), ...(item.itemSpecifics ?? [])];
  return Object.fromEntries(
    entries.flatMap((aspect) => {
      if (!aspect.name?.trim() || !aspect.value?.trim()) {
        return [];
      }
      return [[normalizeAspectName(aspect.name), aspect.value.trim()]];
    })
  );
};

const firstAspect = (aspects: Record<string, string>, names: string[]): string | undefined => {
  for (const name of names) {
    const value = aspects[normalizeAspectName(name)];
    if (value) {
      return value;
    }
  }
  return undefined;
};

const productionYearFromAspects = (aspects: Record<string, string>): number | undefined => {
  const value = firstAspect(aspects, ["Year Manufactured", "Production Year", "Year", "Manufacture Year"]);
  const match = value?.match(/\b(19|20)\d{2}\b/);
  if (!match) {
    return undefined;
  }
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const scopeFromAspects = (aspects: Record<string, string>): string | undefined => {
  const box = firstAspect(aspects, ["With Original Box/Packaging", "With Original Box", "Box"]);
  const papers = firstAspect(aspects, ["With Papers", "Papers"]);
  const hasBox = box ? /yes|with|included/i.test(box) : false;
  const hasPapers = papers ? /yes|with|included/i.test(papers) : false;
  if (hasBox && hasPapers) {
    return "full set";
  }
  if (hasBox) {
    return "box only";
  }
  if (hasPapers) {
    return "papers only";
  }
  return firstAspect(aspects, ["Scope", "Included", "Set Includes"]);
};

export class EbayProvider implements MarketplaceProvider {
  public readonly code = "EBAY" as const;
  private cachedToken?: CachedToken;
  private tokenRequest: Promise<string> | undefined;

  public async searchListings(
    query: string,
    options: MarketplaceSearchOptions = {}
  ): Promise<MarketplaceListing[]> {
    return (await this.searchListingsWithMetadata(query, options)).items;
  }

  public async searchListingsWithMetadata(
    query: string,
    options: MarketplaceSearchOptions = {}
  ): Promise<MarketplaceSearchResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new ConflictError("Search query is required.");
    }

    const config = getMarketplaceConfig().ebay;
    const baseUrl = endpointBaseByEnvironment[config.environment];
    const url = new URL(`${baseUrl}/buy/browse/v1/item_summary/search`);
    url.searchParams.set("q", trimmedQuery);
    url.searchParams.set("limit", parseLimit(options.limit).toString());
    const filters: string[] = [];
    if (typeof options.minPrice === "number" || typeof options.maxPrice === "number") {
      filters.push(`price:[${options.minPrice ?? ""}..${options.maxPrice ?? ""}]`);
      filters.push(`priceCurrency:${options.priceCurrency ?? "USD"}`);
    }
    if (filters.length > 0) {
      url.searchParams.set("filter", filters.join(","));
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${await this.getApplicationAccessToken()}`,
        "X-EBAY-C-MARKETPLACE-ID": options.marketplaceId ?? config.marketplaceId
      }
    });

    if (!response.ok) {
      throw new ExternalServiceError(`eBay search failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as EbaySearchResponse;
    const total = payload.total;
    return {
      total: typeof total === "number" && Number.isInteger(total) ? total : null,
      items: (payload.itemSummaries ?? []).flatMap(toMarketplaceListing)
    };
  }

  public async getListingDetails(
    itemId: string,
    options: Pick<MarketplaceSearchOptions, "marketplaceId"> = {}
  ): Promise<MarketplaceListingDetails> {
    const trimmedItemId = itemId.trim();
    if (!trimmedItemId) {
      throw new ConflictError("eBay item ID is required.");
    }

    const config = getMarketplaceConfig().ebay;
    const baseUrl = endpointBaseByEnvironment[config.environment];
    const response = await fetch(
      `${baseUrl}/buy/browse/v1/item/${encodeURIComponent(trimmedItemId)}`,
      {
        headers: {
          Authorization: `Bearer ${await this.getApplicationAccessToken()}`,
          "X-EBAY-C-MARKETPLACE-ID": options.marketplaceId ?? config.marketplaceId
        }
      }
    );

    if (!response.ok) {
      throw new ExternalServiceError(`eBay item detail request failed with status ${response.status}.`);
    }

    const item = (await response.json()) as EbayItemResponse;
    const listing = toMarketplaceListing(item)[0];
    if (!listing) {
      throw new ExternalServiceError("eBay item detail response did not include item data.");
    }
    const details: MarketplaceListingDetails = { ...listing };
    if (item.description) {
      details.description = item.description;
    }
    if (item.itemCreationDate) {
      details.itemCreationDate = item.itemCreationDate;
    }
    if (item.itemEndDate) {
      details.itemEndDate = item.itemEndDate;
    }
    return details;
  }

  public async checkConnectivity(): Promise<boolean> {
    await this.getApplicationAccessToken();
    return true;
  }

  private async getApplicationAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.accessToken;
    }
    if (this.tokenRequest) {
      return this.tokenRequest;
    }

    this.tokenRequest = this.requestApplicationAccessToken(now).finally(() => {
      this.tokenRequest = undefined;
    });
    return this.tokenRequest;
  }

  private async requestApplicationAccessToken(now: number): Promise<string> {
    const config = getMarketplaceConfig().ebay;
    if (!config.clientId || !config.clientSecret) {
      throw new ConflictError("eBay client ID and client secret are required.");
    }

    const baseUrl = endpointBaseByEnvironment[config.environment];
    const response = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: defaultScope
      })
    });

    if (!response.ok) {
      throw new ExternalServiceError(`eBay token request failed with status ${response.status}.`);
    }

    const token = (await response.json()) as EbayTokenResponse;
    if (!token.access_token) {
      throw new ExternalServiceError("eBay token response did not include an access token.");
    }

    this.cachedToken = {
      accessToken: token.access_token,
      expiresAt: now + Math.max((token.expires_in ?? 7200) - 60, 60) * 1000
    };
    return token.access_token;
  }
}

const toMarketplaceListing = (item: EbayItemSummary): MarketplaceListing[] => {
  const price = Number(item.price?.value);
  if (!item.itemId || !item.title || !Number.isFinite(price)) {
    return [];
  }
  const aspects = ebayAspects(item);
  const listing: MarketplaceListing = {
    externalId: item.itemId,
    title: item.title,
    price,
    currency: item.price?.currency ?? "USD",
    sourceUrl: item.itemWebUrl ?? `https://www.ebay.com/itm/${encodeURIComponent(item.itemId)}`,
    buyingOptions: item.buyingOptions ?? []
  };
  if (Object.keys(aspects).length > 0) {
    listing.aspects = aspects;
  }
  const brand = firstAspect(aspects, ["Brand"]);
  if (brand) {
    listing.brand = brand;
  }
  const model = firstAspect(aspects, ["Model"]);
  if (model) {
    listing.model = model;
  }
  const referenceNumber = firstAspect(aspects, ["Reference Number", "Reference", "MPN"]);
  if (referenceNumber) {
    listing.referenceNumber = referenceNumber;
  }
  const productionYear = productionYearFromAspects(aspects);
  if (productionYear) {
    listing.productionYear = productionYear;
  }
  const movement = firstAspect(aspects, ["Movement"]);
  if (movement) {
    listing.movement = movement;
  }
  const scope = scopeFromAspects(aspects);
  if (scope) {
    listing.scope = scope;
  }
  if (item.image?.imageUrl) {
    listing.imageUrl = item.image.imageUrl;
  }
  if (item.condition) {
    listing.condition = item.condition;
  }
  if (item.seller?.username) {
    listing.sellerUsername = item.seller.username;
  }
  if (typeof item.seller?.feedbackScore === "number") {
    listing.sellerFeedbackScore = item.seller.feedbackScore;
  }
  if (item.seller?.feedbackPercentage) {
    listing.sellerFeedbackPercentage = item.seller.feedbackPercentage;
  }
  const location = compactLocation(item.itemLocation);
  if (location) {
    listing.location = location;
  }
  return [listing];
};
