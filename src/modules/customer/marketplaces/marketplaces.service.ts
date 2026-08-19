import { getMarketplaceConfig } from "../../../config/marketplace.config.js";
import {
  AppError,
  ConflictError,
  ExternalServiceError,
  ResourceNotFoundError
} from "../../../common/errors/app-error.js";
import { createAiProvider } from "../../../infrastructure/external/ai/ai-provider.js";
import { EbayProvider } from "../../../infrastructure/external/ebay/ebay-provider.js";
import { NominatimGeocodingProvider } from "../../../infrastructure/external/geocoding/geocoding-provider.js";
import type { RedisClient } from "../../../infrastructure/redis/client.js";
import type {
  EbayInventoryItemInput,
  EbayPublishInventoryListingResult,
  MarketplaceListing,
  MarketplaceListingDetails,
  MarketplaceSearchOptions
} from "../../../infrastructure/external/ebay/ebay-provider.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import type {
  EbayAnalyticsQuery,
  EbayLocationSearchInput,
  EbayMarketInsightsQuery,
  MarketplaceAggregateSearchQuery,
  EbaySellerVerificationQuery,
  EbaySearchQuery,
  EbayShareListingInput
} from "./marketplaces.validation.js";
import { Chrono24Service } from "../../marketplaces/chrono24/chrono24.service.js";
import type {
  Chrono24Product,
  Chrono24SearchQuery
} from "../../marketplaces/chrono24/chrono24.types.js";

type PriceStats = {
  currency: string | null;
  average: number | null;
  median: number | null;
  lowest: number | null;
  highest: number | null;
  sampleSize: number;
};

type MarketInsightProduct = {
  title: string;
  externalId: string;
  sourceUrl: string;
  image: string;
  price: number;
  currency: string;
  brand: string;
  model: string;
  referenceNumber: string;
  upDownPercentage: number;
  direction: "up" | "down" | "same";
  marketAveragePrice: number;
  basis: string;
};

type SellerVerificationLevel = "trusted" | "acceptable" | "risky" | "unknown";

type MarketplaceSource = "chrono24" | "ebay" | "local_store";

type AggregateItem = {
  source: MarketplaceSource;
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  reference: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  image: string | null;
  url: string | null;
};

type LocalStoreListing = AggregateItem & {
  source: "local_store";
  ownerId: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type LocalStoreRecord = {
  _id: { toString(): string };
  ownerId?: string;
  data: Record<string, unknown>;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const aiQueryNormalizationTimeoutMs = 3_000;

const withTimeout = async <T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new ExternalServiceError(message)), milliseconds);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const roundMoney = (value: number): number => Number(value.toFixed(2));

const roundPercentage = (value: number): number => Number(value.toFixed(2));

const boundedPercentage = (value: number): number =>
  roundPercentage(Math.max(-100, Math.min(100, value)));

const average = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null;

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const searchTextFromRecord = (data: Record<string, unknown>): string | null =>
  stringValue(data.marketplaceQueries && typeof data.marketplaceQueries === "object"
    ? (data.marketplaceQueries as Record<string, unknown>).ebay
    : null) ??
  stringValue(data.query) ??
  stringValue(data.generatedTitle);

const numericValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const truncate = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : value.slice(0, maxLength).trim();

const firstString = (data: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = stringValue(data[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const firstPrice = (data: Record<string, unknown>): number | null => {
  for (const key of ["price", "amount", "listingPrice", "salePrice"]) {
    const value = numericValue(data[key]);
    if (value !== null && value > 0) {
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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchTerms = (query: string): string[] =>
  Array.from(new Set(query.split(/\s+/).map((term) => term.trim()).filter((term) => term.length >= 2)));

const aggregateQueryText = (query: MarketplaceAggregateSearchQuery): string =>
  query.q?.trim() || [query.brand, query.model, query.reference].filter(Boolean).join(" ").trim() || "watch";

const addAspect = (aspects: Record<string, string[]>, name: string, value: string | null): void => {
  if (value) {
    aspects[name] = [value];
  }
};

const listingAspects = (data: Record<string, unknown>): Record<string, string[]> => {
  const aspects: Record<string, string[]> = {};
  addAspect(aspects, "Brand", firstString(data, ["brand", "manufacturer"]));
  addAspect(aspects, "Model", firstString(data, ["model", "watchModel"]));
  addAspect(aspects, "Reference Number", firstString(data, ["referenceNumber", "reference", "mpn"]));
  addAspect(aspects, "Movement", firstString(data, ["movement"]));
  addAspect(aspects, "Year Manufactured", firstString(data, ["productionYear", "year"]));
  return aspects;
};

const defaultEbaySku = (listingId: string): string => `watchbox-${listingId}`.slice(0, 80);

const ebayShareHistoryMetadata = (
  result: EbayPublishInventoryListingResult,
  environment: "sandbox" | "production"
) => ({
  marketplace: "ebay",
  environment,
  marketplaceId: result.marketplaceId,
  sku: result.sku,
  offerId: result.offerId,
  listingId: result.listingId,
  listingUrl: result.listingUrl,
  published: result.published,
  sharedAt: new Date().toISOString()
});

const titleWords = (title: string): string[] => title.split(/\s+/).map((word) => word.trim()).filter(Boolean);

const brandFromListing = (item: MarketplaceListing): string => item.brand ?? titleWords(item.title)[0] ?? "Unknown";

const modelFromListing = (item: MarketplaceListing): string => item.model ?? modelTitleFallback(item.title);

const referenceFromListing = (item: MarketplaceListing): string =>
  item.referenceNumber ??
  titleWords(item.title).find((word) => /[A-Z0-9-]{4,}/i.test(word) && /\d/.test(word)) ??
  "not_available";

const modelTitleFallback = (title: string): string => titleWords(title).slice(1, 4).join(" ") || title;

const marketInsightProduct = (
  item: MarketplaceListing,
  marketAveragePrice: number,
  basis: string
): MarketInsightProduct => {
  const delta = marketAveragePrice > 0 ? boundedPercentage(((item.price - marketAveragePrice) / marketAveragePrice) * 100) : 0;
  return {
    title: item.title,
    externalId: item.externalId,
    sourceUrl: item.sourceUrl,
    image: item.imageUrl ?? "not_available",
    price: item.price,
    currency: item.currency,
    brand: brandFromListing(item),
    model: modelFromListing(item),
    referenceNumber: referenceFromListing(item),
    upDownPercentage: delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "same",
    marketAveragePrice,
    basis
  };
};

const median = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
};

const standardDeviation = (values: number[]): number | null => {
  const avg = average(values);
  if (avg === null || values.length < 2) {
    return null;
  }
  const variance = average(values.map((value) => (value - avg) ** 2));
  return variance === null ? null : Math.sqrt(variance);
};

const priceStats = (items: MarketplaceListing[]): PriceStats => {
  const prices = items.map((item) => item.price).filter((price) => Number.isFinite(price));
  const avg = average(prices);
  const medianPrice = median(prices);
  return {
    currency: items.find((item) => item.currency)?.currency ?? null,
    average: avg === null ? null : roundMoney(avg),
    median: medianPrice === null ? null : roundMoney(medianPrice),
    lowest: prices.length > 0 ? roundMoney(Math.min(...prices)) : null,
    highest: prices.length > 0 ? roundMoney(Math.max(...prices)) : null,
    sampleSize: prices.length
  };
};

const priceBands = (items: MarketplaceListing[]): Array<{ label: string; min: number; max: number; count: number }> => {
  const stats = priceStats(items);
  if (stats.lowest === null || stats.highest === null || stats.lowest === stats.highest) {
    return [];
  }
  const lowest = stats.lowest;
  const highest = stats.highest;
  const bandCount = 5;
  const width = (highest - lowest) / bandCount;
  return Array.from({ length: bandCount }, (_value, index) => {
    const min = lowest + width * index;
    const max = index === bandCount - 1 ? highest : lowest + width * (index + 1);
    return {
      label: `${roundMoney(min)}-${roundMoney(max)}`,
      min: roundMoney(min),
      max: roundMoney(max),
      count: items.filter((item) => item.price >= min && item.price <= max).length
    };
  });
};

const sellerFeedbackPercentage = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const usernameMatches = (expected: string | undefined, actual: string | undefined): boolean =>
  Boolean(expected && actual && expected.toLowerCase() === actual.toLowerCase());

const sellerVerificationScore = (input: {
  feedbackScore: number | null;
  feedbackPercentage: number | null;
  hasLiveListingEvidence: boolean;
  matchedRequestedSeller: boolean | null;
}): number => {
  let score = 0;
  if (input.feedbackPercentage !== null) {
    if (input.feedbackPercentage >= 99.5) {
      score += 45;
    } else if (input.feedbackPercentage >= 98.5) {
      score += 38;
    } else if (input.feedbackPercentage >= 97) {
      score += 28;
    } else if (input.feedbackPercentage >= 95) {
      score += 16;
    } else {
      score += 4;
    }
  }
  if (input.feedbackScore !== null) {
    if (input.feedbackScore >= 1000) {
      score += 35;
    } else if (input.feedbackScore >= 100) {
      score += 27;
    } else if (input.feedbackScore >= 25) {
      score += 18;
    } else if (input.feedbackScore >= 10) {
      score += 10;
    } else {
      score += 3;
    }
  }
  if (input.hasLiveListingEvidence) {
    score += 10;
  }
  if (input.matchedRequestedSeller === true) {
    score += 10;
  }
  if (input.matchedRequestedSeller === false) {
    score -= 35;
  }
  return Math.max(0, Math.min(100, score));
};

const sellerVerificationLevel = (input: {
  trustScore: number;
  feedbackScore: number | null;
  feedbackPercentage: number | null;
  matchedRequestedSeller: boolean | null;
}): SellerVerificationLevel => {
  if (input.matchedRequestedSeller === false) {
    return "risky";
  }
  if (input.feedbackScore === null && input.feedbackPercentage === null) {
    return "unknown";
  }
  if (
    (input.feedbackPercentage !== null && input.feedbackPercentage < 95) ||
    (input.feedbackScore !== null && input.feedbackScore < 10)
  ) {
    return "risky";
  }
  if (
    input.trustScore >= 80 &&
    (input.feedbackPercentage ?? 0) >= 98.5 &&
    (input.feedbackScore ?? 0) >= 100
  ) {
    return "trusted";
  }
  if (
    input.trustScore >= 55 &&
    (input.feedbackPercentage ?? 0) >= 97 &&
    (input.feedbackScore ?? 0) >= 25
  ) {
    return "acceptable";
  }
  return "unknown";
};

const sellerVerificationReasons = (input: {
  level: SellerVerificationLevel;
  feedbackScore: number | null;
  feedbackPercentage: number | null;
  matchedRequestedSeller: boolean | null;
  activeListingsSampled: number;
}): string[] => {
  const reasons: string[] = [];
  if (input.matchedRequestedSeller === true) {
    reasons.push("Seller username matches the requested seller.");
  }
  if (input.matchedRequestedSeller === false) {
    reasons.push("Seller username does not match the requested seller.");
  }
  if (input.feedbackPercentage !== null) {
    reasons.push(`Positive feedback is ${input.feedbackPercentage}%.`);
  }
  if (input.feedbackScore !== null) {
    reasons.push(`Feedback score is ${input.feedbackScore}.`);
  }
  if (input.activeListingsSampled > 0) {
    reasons.push(`Found ${input.activeListingsSampled} active eBay listing sample${input.activeListingsSampled === 1 ? "" : "s"}.`);
  }
  if (input.level === "unknown") {
    reasons.push("Available eBay data is not enough for a confident reputation verdict.");
  }
  return reasons;
};

const similarListing = (item: MarketplaceListing) => ({
  source: "ebay" as const,
  externalId: item.externalId,
  title: item.title,
  price: item.price,
  currency: item.currency,
  condition: item.condition ?? null,
  image: item.imageUrl ?? null,
  sourceUrl: item.sourceUrl,
  seller: item.sellerUsername
    ? {
        username: item.sellerUsername,
        feedbackScore: item.sellerFeedbackScore ?? null,
        feedbackPercentage: item.sellerFeedbackPercentage ?? null,
        accountType: item.sellerAccountType ?? null
      }
    : null,
  buyingOptions: item.buyingOptions
});

const chrono24AggregateItem = (item: Chrono24Product): AggregateItem => ({
  source: "chrono24",
  id: item.id,
  title: item.title,
  brand: item.brand || null,
  model: item.model || null,
  reference: item.reference || null,
  price: item.price,
  currency: item.currency || null,
  condition: item.condition || null,
  image: item.image || null,
  url: item.url || null
});

const ebayAggregateItem = (item: MarketplaceListing): AggregateItem => ({
  source: "ebay",
  id: item.externalId,
  title: item.title,
  brand: item.brand ?? null,
  model: item.model ?? null,
  reference: item.referenceNumber ?? null,
  price: item.price,
  currency: item.currency,
  condition: item.condition ?? null,
  image: item.imageUrl ?? null,
  url: item.sourceUrl
});

const localStoreAggregateItem = (record: LocalStoreRecord): LocalStoreListing => ({
  source: "local_store",
  id: record._id.toString(),
  title: firstString(record.data, ["title", "name", "generatedTitle"]) ?? "Local store listing",
  brand: firstString(record.data, ["brand", "manufacturer"]),
  model: firstString(record.data, ["model", "watchModel"]),
  reference: firstString(record.data, ["referenceNumber", "reference", "mpn"]),
  price: firstPrice(record.data),
  currency: firstString(record.data, ["currency", "priceCurrency"]),
  condition: firstString(record.data, ["condition"]),
  image: listingImageUrls(record.data)[0] ?? null,
  url: `/api/v1/listings/${record._id.toString()}`,
  ownerId: record.ownerId ?? null,
  status: record.status,
  createdAt: record.createdAt?.toISOString() ?? null,
  updatedAt: record.updatedAt?.toISOString() ?? null
});

const sourceFailure = (source: MarketplaceSource, error: unknown) => ({
  source,
  status: "error" as const,
  total: 0,
  count: 0,
  items: [],
  warnings: [error instanceof Error ? error.message : `${source} search failed.`]
});

const sandboxEmptySearchWarning =
  "eBay sandbox does not include live marketplace inventory. Use EBAY_ENVIRONMENT=production with production eBay Browse API credentials for real eBay results.";

const searchWarnings = (input: {
  environment: "sandbox" | "production";
  count: number;
}): string[] => {
  if (input.environment === "sandbox" && input.count === 0) {
    return [sandboxEmptySearchWarning];
  }
  return [];
};

const volatilityLevel = (coefficientOfVariation: number | null): "unknown" | "low" | "medium" | "high" => {
  if (coefficientOfVariation === null) {
    return "unknown";
  }
  if (coefficientOfVariation < 0.15) {
    return "low";
  }
  if (coefficientOfVariation < 0.35) {
    return "medium";
  }
  return "high";
};

const liquidityScore = (input: {
  activeListingsTotal: number;
  sampleSize: number;
  fixedPriceRatio: number;
  coefficientOfVariation: number | null;
  averageSellerFeedbackPercentage: number | null;
}): number => {
  const volumeScore = Math.min(input.activeListingsTotal, 200) / 200;
  const sampleScore = Math.min(input.sampleSize, 100) / 100;
  const sellerScore = input.averageSellerFeedbackPercentage === null ? 0.5 : input.averageSellerFeedbackPercentage / 100;
  const volatilityPenalty = Math.min(input.coefficientOfVariation ?? 0.5, 1);
  return Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (volumeScore * 0.35 + sampleScore * 0.25 + input.fixedPriceRatio * 0.2 + sellerScore * 0.2 - volatilityPenalty * 0.25) *
          100
      )
    )
  );
};

export class MarketplaceService {
  private readonly ebay = new EbayProvider();
  private readonly ai = createAiProvider();
  private readonly geocoding = new NominatimGeocodingProvider();
  private readonly chrono24: Chrono24Service;

  public constructor(redis?: RedisClient) {
    this.chrono24 = new Chrono24Service(redis);
  }

  public async searchAll(query: MarketplaceAggregateSearchQuery) {
    const queryText = aggregateQueryText(query);
    const chrono24Limit = query.chrono24Limit ?? query.limit;
    const ebayLimit = query.ebayLimit ?? query.limit;
    const localLimit = query.localLimit ?? query.limit;
    const chrono24Query: Chrono24SearchQuery = {
      page: query.page,
      limit: chrono24Limit
    };
    chrono24Query.q = query.q ?? queryText;
    chrono24Query.refresh = query.refresh;
    if (query.brand) {
      chrono24Query.brand = query.brand;
    }
    if (query.model) {
      chrono24Query.model = query.model;
    }
    if (query.reference) {
      chrono24Query.reference = query.reference;
    }
    if (typeof query.minPrice === "number") {
      chrono24Query.minPrice = query.minPrice;
    }
    if (typeof query.maxPrice === "number") {
      chrono24Query.maxPrice = query.maxPrice;
    }
    if (query.condition) {
      chrono24Query.condition = query.condition;
    }
    if (typeof query.year === "number") {
      chrono24Query.year = query.year;
    }
    if (query.country) {
      chrono24Query.country = query.country;
    }
    if (query.sort) {
      chrono24Query.sort = query.sort;
    }

    const ebayQuery: EbaySearchQuery = { q: queryText, limit: ebayLimit };
    if (query.marketplaceId) {
      ebayQuery.marketplaceId = query.marketplaceId;
    }

    const [chrono24, ebay, localStore] = await Promise.all([
      this.chrono24.search(chrono24Query)
        .then((result) => ({
          source: "chrono24" as const,
          status: "ok" as const,
          total: result.total,
          count: result.count,
          page: result.page,
          limit: result.limit,
          cached: result.cached,
          warnings: result.warnings,
          items: result.items
        }))
        .catch((error: unknown) => sourceFailure("chrono24", error)),
      this.searchEbay(ebayQuery)
        .then((result) => ({
          source: "ebay" as const,
          status: "ok" as const,
          total: result.total,
          count: result.count,
          environment: result.environment,
          marketplaceId: result.marketplaceId,
          ebayQuery: result.ebayQuery,
          queryNormalization: result.queryNormalization,
          warnings: result.warnings,
          items: result.items.map((item) => ({ source: "ebay" as const, ...item }))
        }))
        .catch((error: unknown) => sourceFailure("ebay", error)),
      this.searchLocalStore(query, queryText, localLimit)
        .then((items) => ({
          source: "local_store" as const,
          status: "ok" as const,
          total: items.length,
          count: items.length,
          warnings: [] as string[],
          items
        }))
        .catch((error: unknown) => sourceFailure("local_store", error))
    ]);

    const items = [
      ...(chrono24.status === "ok" ? chrono24.items.map(chrono24AggregateItem) : []),
      ...(ebay.status === "ok" ? ebay.items.map(ebayAggregateItem) : []),
      ...(localStore.status === "ok" ? localStore.items : [])
    ];

    return {
      query: {
        text: queryText,
        q: query.q ?? null,
        brand: query.brand ?? null,
        model: query.model ?? null,
        reference: query.reference ?? null
      },
      sources: ["chrono24", "ebay", "local_store"],
      total: items.length,
      count: items.length,
      items,
      chrono24,
      ebay,
      localStore
    };
  }

  public async searchEbay(query: EbaySearchQuery) {
    const options: Parameters<EbayProvider["searchListings"]>[1] = {
      limit: query.limit
    };
    if (query.marketplaceId) {
      options.marketplaceId = query.marketplaceId;
    }
    const config = getMarketplaceConfig().ebay;
    const normalized = await this.normalizeMarketplaceQuery(query.q);
    const searchResult = await this.ebay.searchListingsWithMetadata(normalized.query, options);
    const items = searchResult.items;
    return {
      query: query.q,
      ebayQuery: normalized.query,
      queryNormalization: normalized,
      environment: config.environment,
      marketplaceId: query.marketplaceId ?? config.marketplaceId,
      total: searchResult.total,
      count: items.length,
      warnings: searchWarnings({
        environment: config.environment,
        count: items.length
      }),
      items
    };
  }

  private async searchLocalStore(
    query: MarketplaceAggregateSearchQuery,
    queryText: string,
    limit: number
  ): Promise<LocalStoreListing[]> {
    const clauses: Array<Record<string, unknown>> = [];
    const fields = [
      "data.title",
      "data.name",
      "data.generatedTitle",
      "data.brand",
      "data.manufacturer",
      "data.model",
      "data.watchModel",
      "data.referenceNumber",
      "data.reference",
      "data.mpn"
    ];
    for (const term of searchTerms(queryText)) {
      const regex = new RegExp(escapeRegExp(term), "i");
      clauses.push({
        $or: fields.map((field) => ({ [field]: regex }))
      });
    }
    if (query.brand) {
      const regex = new RegExp(escapeRegExp(query.brand), "i");
      clauses.push({ $or: [{ "data.brand": regex }, { "data.manufacturer": regex }] });
    }
    if (query.model) {
      const regex = new RegExp(escapeRegExp(query.model), "i");
      clauses.push({ $or: [{ "data.model": regex }, { "data.watchModel": regex }, { "data.title": regex }] });
    }
    if (query.reference) {
      const regex = new RegExp(escapeRegExp(query.reference), "i");
      clauses.push({
        $or: [{ "data.referenceNumber": regex }, { "data.reference": regex }, { "data.mpn": regex }, { "data.title": regex }]
      });
    }

    const filter: Record<string, unknown> = {
      resource: "listings",
      deletedAt: null,
      status: "active"
    };
    if (clauses.length > 0) {
      filter.$and = clauses;
    }
    if (typeof query.minPrice === "number" || typeof query.maxPrice === "number") {
      filter["data.price"] = {
        ...(typeof query.minPrice === "number" ? { $gte: query.minPrice } : {}),
        ...(typeof query.maxPrice === "number" ? { $lte: query.maxPrice } : {})
      };
    }

    const records = await GeneratedApiRecordModel.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean() as LocalStoreRecord[];
    return records.map(localStoreAggregateItem);
  }

  public async searchEbayByLocation(input: EbayLocationSearchInput) {
    const config = getMarketplaceConfig().ebay;
    const marketplaceId = input.marketplaceId ?? config.marketplaceId;
    void this.ebay.checkConnectivity().catch(() => undefined);
    const location = await this.geocoding.reversePostalCode(input.latitude, input.longitude);
    const options: MarketplaceSearchOptions = {
      limit: input.limit,
      marketplaceId,
      priceCurrency: input.priceCurrency,
      timeoutMs: 3_000
    };
    if (typeof input.minPrice === "number") {
      options.minPrice = input.minPrice;
    }
    if (typeof input.maxPrice === "number") {
      options.maxPrice = input.maxPrice;
    }
    if (input.searchMode === "pickup") {
      options.pickupPostalCode = location.postalCode;
      options.pickupCountry = location.countryCode;
      options.pickupRadius = input.pickupRadius;
      options.pickupRadiusUnit = input.pickupRadiusUnit;
    } else {
      options.deliveryPostalCode = location.postalCode;
      options.deliveryCountry = location.countryCode;
    }
    const result = await this.ebay.searchListingsWithMetadata(input.q, options);
    return result.items;
  }

  public async testEbayConnection(): Promise<{ connected: true }> {
    await this.ebay.checkConnectivity();
    return { connected: true };
  }

  public async verifyEbaySeller(query: EbaySellerVerificationQuery) {
    const config = getMarketplaceConfig().ebay;
    const marketplaceId = query.marketplaceId ?? config.marketplaceId;
    const warnings = [
      "This is a reputation verification based on public eBay marketplace signals. It does not prove the seller's legal identity."
    ];
    let items: MarketplaceListing[] = [];
    let total: number | null = null;
    let source: "item_detail" | "seller_listing_sample" = "seller_listing_sample";

    if (query.itemId) {
      const item = await this.ebay.getListingDetails(query.itemId, { marketplaceId });
      items = [item];
      total = 1;
      source = "item_detail";
    } else if (query.sellerUsername) {
      const result = await this.ebay.searchListingsWithMetadata(query.q, {
        limit: query.limit,
        marketplaceId,
        sellerUsername: query.sellerUsername
      });
      items = result.items;
      total = result.total;
      if (items.length === 0) {
        warnings.push("No active eBay listings were found for this seller and query sample.");
      }
    }

    const sellerItem =
      items.find((item) => item.sellerUsername || item.sellerFeedbackScore || item.sellerFeedbackPercentage) ?? items[0];
    const actualUsername = sellerItem?.sellerUsername ?? null;
    const feedbackScore =
      typeof sellerItem?.sellerFeedbackScore === "number" ? sellerItem.sellerFeedbackScore : null;
    const feedbackPercentage = sellerFeedbackPercentage(sellerItem?.sellerFeedbackPercentage) ?? null;
    const matchedRequestedSeller = query.sellerUsername
      ? usernameMatches(query.sellerUsername, actualUsername ?? undefined)
      : null;
    const trustScore = sellerVerificationScore({
      feedbackScore,
      feedbackPercentage,
      hasLiveListingEvidence: items.length > 0,
      matchedRequestedSeller
    });
    const level = sellerVerificationLevel({
      trustScore,
      feedbackScore,
      feedbackPercentage,
      matchedRequestedSeller
    });

    return {
      source,
      environment: config.environment,
      marketplaceId,
      requested: {
        itemId: query.itemId ?? null,
        sellerUsername: query.sellerUsername ?? null,
        q: query.itemId ? null : query.q
      },
      seller: {
        username: actualUsername,
        feedbackScore,
        feedbackPercentage,
        accountType: sellerItem?.sellerAccountType ?? null
      },
      verification: {
        verified: level === "trusted" || level === "acceptable",
        level,
        trustScore,
        reasons: sellerVerificationReasons({
          level,
          feedbackScore,
          feedbackPercentage,
          matchedRequestedSeller,
          activeListingsSampled: items.length
        })
      },
      evidence: {
        activeListingsTotal: total,
        sampledListings: items.length,
        sampleListings: items.slice(0, 5).map(similarListing)
      },
      warnings: [
        ...warnings,
        ...searchWarnings({
          environment: config.environment,
          count: items.length
        })
      ]
    };
  }

  public async shareListingToEbay(
    userId: string,
    listingId: string,
    input: EbayShareListingInput
  ) {
    const listing = await this.requireOwnedListing(userId, listingId);
    const ebayItem = this.ebayInventoryItemFromListing(listing, input);
    const result = await this.ebay.publishInventoryListing(ebayItem, {
      sellerAccessToken: input.sellerAccessToken,
      publish: input.publish
    });
    const metadata = ebayShareHistoryMetadata(result, getMarketplaceConfig().ebay.environment);
    const marketplaceShares =
      typeof listing.data.marketplaceShares === "object" &&
      listing.data.marketplaceShares !== null &&
      !Array.isArray(listing.data.marketplaceShares)
        ? (listing.data.marketplaceShares as Record<string, unknown>)
        : {};

    await GeneratedApiRecordModel.findByIdAndUpdate(listing._id, {
      $set: {
        "data.marketplaceShares": {
          ...marketplaceShares,
          ebay: metadata
        }
      },
      $push: {
        history: {
          action: result.published ? "listings.ebay.published" : "listings.ebay.offer-created",
          actorId: userId,
          actorType: "customer",
          at: new Date(),
          metadata
        }
      }
    });

    return {
      listingId,
      marketplace: "ebay",
      environment: metadata.environment,
      marketplaceId: result.marketplaceId,
      sku: result.sku,
      offerId: result.offerId,
      ebayListingId: result.listingId,
      ebayListingUrl: result.listingUrl,
      published: result.published
    };
  }

  public async ebayMarketInsights(query: EbayMarketInsightsQuery) {
    const config = getMarketplaceConfig().ebay;
    const marketplaceId = query.marketplaceId ?? config.marketplaceId;
    const insightQuery = await this.marketInsightQuery(query.q);
    const warnings: string[] = [
      "eBay Browse API provides active listing samples, not true historical sold-price trend data. Price drop/upward percentages are calculated against the current sampled eBay market average."
    ];
    let total = 0;
    let averagePrice = 0;
    let allProducts: MarketInsightProduct[] = [];
    try {
      const result = await this.ebay.searchListingsWithMetadata(insightQuery.query, {
        limit: query.sampleLimit,
        marketplaceId
      });
      total = result.total ?? result.items.length;
      const stats = priceStats(result.items);
      averagePrice = stats.average ?? 0;
      allProducts = averagePrice > 0
        ? result.items.map((item) =>
            marketInsightProduct(
              item,
              averagePrice,
              `Compared with current active eBay sample average for "${insightQuery.query}".`
            )
          )
        : [];
    } catch (error) {
      warnings.push(
        error instanceof AppError
          ? `Skipped "${insightQuery.query}": ${error.message}`
          : `Skipped "${insightQuery.query}": eBay insight search failed.`
      );
    }
    const biggestPriceDropProduct = allProducts
      .filter((product) => product.direction === "down")
      .sort((left, right) => left.upDownPercentage - right.upDownPercentage)[0] ?? null;
    const trendingUpwardProduct = allProducts
      .filter((product) => product.direction === "up")
      .sort((left, right) => right.upDownPercentage - left.upDownPercentage)[0] ?? null;
    const firstProduct = allProducts[0] ?? null;

    return {
      environment: config.environment,
      marketplaceId,
      query: insightQuery.query,
      searchCount: insightQuery.searchCount,
      activeListingTotal: total,
      marketAveragePrice: roundMoney(averagePrice),
      generatedFrom: "single_active_ebay_browse_listing_sample_and_saved_watchbox_searches",
      warnings: [
        ...warnings,
        ...searchWarnings({
          environment: config.environment,
          count: allProducts.length
        })
      ],
      mostSearchedProduct: firstProduct
        ? {
            ...firstProduct,
            searchCount: insightQuery.searchCount,
            activeListingTotal: total,
            query: insightQuery.query,
            basis: `Top WatchBox saved search query count ${insightQuery.searchCount}; current eBay active listing total ${total}.`
          }
        : null,
      biggestPriceDropProduct,
      trendingUpwardProduct
    };
  }

  public async ebayAnalytics(query: EbayAnalyticsQuery) {
    const options: Parameters<EbayProvider["searchListingsWithMetadata"]>[1] = {
      limit: query.limit
    };
    if (query.marketplaceId) {
      options.marketplaceId = query.marketplaceId;
    }

    const config = getMarketplaceConfig().ebay;
    const detailOptions: Parameters<EbayProvider["getListingDetails"]>[1] = {};
    if (query.marketplaceId) {
      detailOptions.marketplaceId = query.marketplaceId;
    }
    const normalized = await this.normalizeMarketplaceQuery(query.q);
    const [searchResult, primaryProduct] = await Promise.all([
      this.ebay.searchListingsWithMetadata(normalized.query, options),
      query.itemId
        ? this.ebay.getListingDetails(query.itemId, detailOptions)
        : Promise.resolve<MarketplaceListingDetails | undefined>(undefined)
    ]);
    const items = searchResult.items;
    const stats = priceStats(items);
    const stdDev = standardDeviation(items.map((item) => item.price));
    const coefficientOfVariation = stats.average && stdDev !== null ? stdDev / stats.average : null;
    const feedbackScores = items
      .map((item) => item.sellerFeedbackScore)
      .filter((value): value is number => typeof value === "number");
    const feedbackPercentages = items
      .map((item) => sellerFeedbackPercentage(item.sellerFeedbackPercentage))
      .filter((value): value is number => typeof value === "number");
    const fixedPriceCount = items.filter((item) => item.buyingOptions.includes("FIXED_PRICE")).length;
    const activeListingsTotal = searchResult.total ?? items.length;
    const fixedPriceRatio = items.length > 0 ? fixedPriceCount / items.length : 0;
    const averageFeedbackPercentage = average(feedbackPercentages);

    return {
      query: query.q,
      ebayQuery: normalized.query,
      queryNormalization: normalized,
      itemId: query.itemId ?? null,
      environment: config.environment,
      marketplaceId: query.marketplaceId ?? config.marketplaceId,
      generatedFrom: "active_ebay_browse_listings",
      primaryProduct: primaryProduct
        ? {
            ...similarListing(primaryProduct),
            description: primaryProduct.description ?? null,
            itemCreationDate: primaryProduct.itemCreationDate ?? null,
            itemEndDate: primaryProduct.itemEndDate ?? null
          }
        : items[0]
          ? similarListing(items[0])
          : null,
      market: {
        averagePrice: stats.average,
        medianPrice: stats.median,
        lowerPrice: stats.lowest,
        higherPrice: stats.highest,
        currency: stats.currency,
        activeListingsTotal,
        sampledListings: stats.sampleSize,
        listingsVolume: activeListingsTotal,
        fixedPriceCount,
        auctionCount: items.filter((item) => item.buyingOptions.includes("AUCTION")).length,
        conditionBreakdown: Object.fromEntries(
          Array.from(new Set(items.map((item) => item.condition ?? "unknown"))).map((condition) => [
            condition,
            items.filter((item) => (item.condition ?? "unknown") === condition).length
          ])
        )
      },
      sellerRating: {
        averageFeedbackScore: average(feedbackScores) === null ? null : Math.round(average(feedbackScores) ?? 0),
        averagePositiveFeedbackPercentage:
          averageFeedbackPercentage === null ? null : Number(averageFeedbackPercentage.toFixed(2)),
        ratedSellerCount: Math.max(feedbackScores.length, feedbackPercentages.length)
      },
      sales: {
        totalSales: null,
        reason:
          "eBay Browse API active listing search does not provide completed/sold item counts. Connect a sold-listings or Terapeak/Marketplace Insights source for true sales totals."
      },
      priceTrend: {
        direction: "unknown",
        reason:
          "True price trend needs historical sold/listed snapshots. This response includes the current active-listing price distribution only.",
        currentDistribution: priceBands(items)
      },
      volatility: {
        level: volatilityLevel(coefficientOfVariation),
        standardDeviation: stdDev === null ? null : roundMoney(stdDev),
        coefficientOfVariation: coefficientOfVariation === null ? null : Number(coefficientOfVariation.toFixed(4))
      },
      liquidity: {
        score: liquidityScore({
          activeListingsTotal,
          sampleSize: stats.sampleSize,
          fixedPriceRatio,
          coefficientOfVariation,
          averageSellerFeedbackPercentage: averageFeedbackPercentage
        }),
        basis:
          "Proxy score from active listing volume, sampled listings, fixed-price availability, seller feedback, and price volatility."
      },
      similarListings: items.slice(0, 20).map(similarListing)
    };
  }

  private async normalizeMarketplaceQuery(query: string): Promise<{
    query: string;
    source: "ai" | "fallback";
    confidence: number | null;
    detectedBrand: string | null;
    detectedModel: string | null;
    reasoning: string | null;
  }> {
    const fallbackQuery = query.trim().replace(/\s+/g, " ");
    try {
      const normalized = await withTimeout(
        this.ai.normalizeSearchQuery({ query }),
        aiQueryNormalizationTimeoutMs,
        "AI search query normalization timed out."
      );
      return {
        query: normalized.optimizedQuery,
        source: "ai",
        confidence: normalized.confidence,
        detectedBrand: normalized.detectedBrand ?? null,
        detectedModel: normalized.detectedModel ?? null,
        reasoning: normalized.reasoning ?? null
      };
    } catch (error) {
      return {
        query: fallbackQuery,
        source: "fallback",
        confidence: null,
        detectedBrand: null,
        detectedModel: null,
        reasoning: error instanceof AppError ? error.message : null
      };
    }
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

  private ebayInventoryItemFromListing(
    listing: GeneratedApiRecordDocument,
    input: EbayShareListingInput
  ): EbayInventoryItemInput {
    const title = firstString(listing.data, ["title", "name", "generatedTitle"]);
    if (!title) {
      throw new ConflictError("Listing title is required before sharing to eBay.");
    }
    const price = input.price ?? firstPrice(listing.data);
    if (price === null || price <= 0) {
      throw new ConflictError("Listing price is required before sharing to eBay.");
    }

    const description =
      firstString(listing.data, ["description", "details", "summary"]) ??
      `${title} listed from WatchBox.`;
    const item: EbayInventoryItemInput = {
      sku: input.sku ?? defaultEbaySku(listing._id.toString()),
      title: truncate(title, 80),
      description,
      price,
      currency: input.currency,
      quantity: input.quantity,
      condition: input.condition,
      categoryId: input.categoryId,
      merchantLocationKey: input.merchantLocationKey,
      fulfillmentPolicyId: input.fulfillmentPolicyId,
      paymentPolicyId: input.paymentPolicyId,
      returnPolicyId: input.returnPolicyId,
      format: input.format,
      imageUrls: listingImageUrls(listing.data),
      aspects: listingAspects(listing.data)
    };
    if (input.marketplaceId) {
      item.marketplaceId = input.marketplaceId;
    }
    if (input.listingDuration) {
      item.listingDuration = input.listingDuration;
    }
    return item;
  }

  private async marketInsightQuery(query: string | undefined): Promise<{ query: string; searchCount: number }> {
    if (query?.trim()) {
      return { query: query.trim(), searchCount: 1 };
    }
    const records = await GeneratedApiRecordModel.find({
      resource: "image-search",
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const counts = new Map<string, number>();
    for (const record of records) {
      const text = searchTextFromRecord(record.data);
      if (!text) {
        continue;
      }
      const normalized = text.trim().replace(/\s+/g, " ");
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    const savedQueries = Array.from(counts.entries())
      .map(([savedQuery, searchCount]) => ({ query: savedQuery, searchCount }))
      .sort((left, right) => right.searchCount - left.searchCount || left.query.localeCompare(right.query))
    return savedQueries[0] ?? { query: "Rolex Submariner", searchCount: 0 };
  }
}
