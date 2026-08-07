import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { AppError, ConflictError, ExternalServiceError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { getAiConfig } from "../../../config/ai.config.js";
import { getMarketplaceConfig } from "../../../config/marketplace.config.js";
import { createAiProvider } from "../../../infrastructure/external/ai/ai-provider.js";
import type {
  ImageAnalysis,
  ImageAnalysisRequest,
  ProductDetailGuess
} from "../../../infrastructure/external/ai/ai-provider.js";
import { EbayProvider, type MarketplaceListing } from "../../../infrastructure/external/ebay/ebay-provider.js";
import { uploadObject } from "../../../infrastructure/storage/s3-storage.js";
import { GeneratedApiRecordModel } from "../../generated-api/generated-api.model.js";
import type { GeneratedApiRecordDocument } from "../../generated-api/generated-api.model.js";
import type { Actor, AiImageInput } from "./ai.types.js";

type AnalyzeInput = AiImageInput & {
  file?: Express.Multer.File;
  includeEmbedding?: boolean;
};

type SearchInput = AnalyzeInput & {
  q?: string;
  keyword?: string;
  query?: string;
  search?: string;
  brand?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  listingStatus?: ListingStatusFilter;
  condition?: ConditionFilter;
  region?: string;
  limit: number;
  marketplaceId?: string;
};

type ProductDetailSource = "local" | "ebay";
type ListingStatusFilter = "active" | "historical_sold";
type ConditionFilter = "new" | "unworn" | "very_good" | "vintage";

type ProductSearchFilters = {
  brand?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  listingStatus?: ListingStatusFilter;
  condition?: ConditionFilter;
  region?: string;
};

type MarketplaceQueryNormalization = {
  query: string;
  source: "ai" | "fallback";
  confidence: number | null;
  detectedBrand: string | null;
  detectedModel: string | null;
  reasoning: string | null;
};

type EbaySearchPlan = {
  normalization: MarketplaceQueryNormalization;
  queries: string[];
};

type LocalSearchItem = {
  source: "local";
  id: string;
  title: string | null;
  brand: string | null;
  model: string | null;
  referenceNumber: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  productionYear: number | null;
  movement: string | null;
  scope: string | null;
  description: string | null;
  rating: ProductRating | null;
  salesAmount: number | null;
  priceTrendData: Array<{ label: string; averagePrice: number | null; listingCount: number }>;
  image: string | null;
  region: string | null;
  status: string;
  listingStatus: string | null;
  score: number;
  createdAt: string;
  updatedAt: string;
};

type EbaySearchItem = Omit<MarketplaceListing, "imageUrl"> & {
  source: "ebay";
  image: string | null;
  description?: string;
};

type RankedSearchItem = {
  source: "local" | "ebay";
  id: string;
  externalId: string | null;
  title: string | null;
  brand: string | null;
  model: string | null;
  referenceNumber: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  productionYear: number | null;
  movement: string | null;
  scope: string | null;
  description: string | null;
  rating: ProductRating | null;
  salesAmount: number | null;
  priceTrendData: Array<{ label: string; averagePrice: number | null; listingCount: number }>;
  image: string | null;
  sourceUrl: string | null;
  similarityScore: number;
  matchReasons: string[];
};

type InternalRankedSearchItem = RankedSearchItem & {
  rawScore: number;
};

type MarketLevel = "unknown" | "low" | "medium" | "high";

type ProductRating = {
  sellerUsername: string | null;
  feedbackScore: number | null;
  feedbackPercentage: string | null;
};

type ProductDetails = {
  source: "local" | "ebay";
  id: string;
  externalId: string;
  title: string;
  brand: string;
  model: string;
  referenceNumber: string;
  currentPrice: number;
  currency: string;
  currentPriceChangePercentage: number;
  currentPriceDirection: "increase" | "decrease" | "same";
  marketAveragePrice: number;
  marketStatus: "stable" | "unstable";
  productionYear: number;
  condition: string;
  movement: string;
  scope: string;
  rating: number;
  salesAmount: number;
  lowestPrice: number;
  highestPrice: number;
  priceTrendData: Array<{ label: string; averagePrice: number; listingCount: number }>;
  liquidityScope: "low" | "medium" | "high";
  listingVolumeAmount: number;
  listingVolumePercentage: number;
  volatility: "low" | "medium" | "high";
  description: string;
  image: string;
  sourceUrl: string;
  similarityScore: number;
  matchReasons: string[];
  similarProducts: Array<{
    source: "local" | "ebay";
    id: string;
    externalId: string;
    title: string;
    price: number;
    currency: string;
    condition: string;
    image: string;
    sourceUrl: string;
  }>;
};

const imageExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const sandboxEmptySearchWarning =
  "eBay sandbox does not include live marketplace inventory. Use EBAY_ENVIRONMENT=production with production eBay Browse API credentials for real eBay results.";

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

const fileToDataUrl = (file: Express.Multer.File): string =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

const compactAnalysisData = (analysis: ImageAnalysis): Record<string, unknown> => ({
  containsWatch: analysis.containsWatch,
  generatedTitle: analysis.generatedTitle ?? null,
  probableBrand: analysis.probableBrand ?? null,
  probableModel: analysis.probableModel ?? null,
  probableReferenceNumber: analysis.probableReferenceNumber ?? null,
  visualAttributes: analysis.visualAttributes,
  embedding: analysis.embedding,
  modelVersion: analysis.modelVersion
});

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const normalizedLooseText = (value: string | null | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const includesLooseText = (value: string | null | undefined, expected: string | undefined): boolean =>
  !expected || normalizedLooseText(value).includes(normalizedLooseText(expected));

const numberValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const integerValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const roundMoney = (value: number): number => Number(value.toFixed(2));

const roundPercentage = (value: number): number => Number(value.toFixed(2));

const average = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null;

const standardDeviation = (values: number[]): number | null => {
  const avg = average(values);
  if (avg === null || values.length < 2) {
    return null;
  }
  const variance = average(values.map((value) => (value - avg) ** 2));
  return variance === null ? null : Math.sqrt(variance);
};

const levelFromCoefficient = (coefficientOfVariation: number | null): MarketLevel => {
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

const liquidityLevel = (totalVolume: number, comparableCount: number, volatility: MarketLevel): MarketLevel => {
  if (comparableCount === 0) {
    return "unknown";
  }
  const volumeScore = Math.max(totalVolume, comparableCount);
  if (volumeScore >= 50 && volatility !== "high") {
    return "high";
  }
  if (volumeScore >= 10) {
    return "medium";
  }
  return "low";
};

const ratingFromRecord = (data: Record<string, unknown>): ProductRating | null => {
  const rating = typeof data.rating === "object" && data.rating !== null && !Array.isArray(data.rating)
    ? (data.rating as Record<string, unknown>)
    : {};
  const sellerUsername = stringValue(data.sellerUsername) ?? stringValue(rating.sellerUsername);
  const feedbackScore = numberValue(data.sellerFeedbackScore) ?? numberValue(rating.feedbackScore);
  const feedbackPercentage = stringValue(data.sellerFeedbackPercentage) ?? stringValue(rating.feedbackPercentage);
  return sellerUsername || feedbackScore !== null || feedbackPercentage
    ? {
        sellerUsername,
        feedbackScore,
        feedbackPercentage
      }
    : null;
};

const listingImageUrl = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return stringValue((value as Record<string, unknown>).url);
  }
  return null;
};

const firstListingImageUrl = (data: Record<string, unknown>): string | null => {
  if (typeof data.image === "string" && data.image.trim()) {
    return data.image;
  }
  if (!Array.isArray(data.images)) {
    return null;
  }
  return data.images.map(listingImageUrl).find((url): url is string => Boolean(url)) ?? null;
};

const searchableText = (data: Record<string, unknown>): string =>
  [
    data.title,
    data.brand,
    data.model,
    data.referenceNumber,
    data.condition,
    data.description
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

const queryTerms = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);

const uniqueTerms = (terms: string[]): string[] => Array.from(new Set(terms));

const compactSearchPart = (value: string | null | undefined): string | null => {
  const compacted = value?.trim().replace(/\s+/g, " ");
  return compacted ? compacted : null;
};

const uniqueSearchQueries = (queries: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const query of queries) {
    const compacted = compactSearchPart(query);
    if (!compacted) {
      continue;
    }
    const key = compacted.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(compacted);
    }
  }
  return output;
};

const searchQueryFromParts = (...parts: Array<string | null | undefined>): string =>
  uniqueSearchQueries(parts.flatMap((part) => (part ? [part] : []))).join(" ");

const normalizedText = (...values: Array<string | null | undefined>): string =>
  values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ").toLowerCase();

const localMatchScore = (data: Record<string, unknown>, terms: string[]): number => {
  const haystack = searchableText(data);
  return terms.reduce((score, term) => {
    if (stringValue(data.referenceNumber)?.toLowerCase() === term) {
      return score + 8;
    }
    if (stringValue(data.title)?.toLowerCase().includes(term)) {
      return score + 4;
    }
    if (stringValue(data.brand)?.toLowerCase().includes(term)) {
      return score + 3;
    }
    if (stringValue(data.model)?.toLowerCase().includes(term)) {
      return score + 3;
    }
    return haystack.includes(term) ? score + 1 : score;
  }, 0);
};

const textMatchScore = (input: {
  title: string | null;
  brand?: string | null;
  model?: string | null;
  referenceNumber?: string | null;
  condition?: string | null;
  description?: string | null;
  terms: string[];
}): { score: number; reasons: string[] } => {
  const haystack = normalizedText(
    input.title,
    input.brand,
    input.model,
    input.referenceNumber,
    input.condition,
    input.description
  );
  const reasons: string[] = [];
  const score = input.terms.reduce((total, term) => {
    let termScore = 0;
    if (input.referenceNumber?.toLowerCase() === term) {
      reasons.push(`reference:${term}`);
      termScore += 45;
    }
    if (input.title?.toLowerCase().includes(term)) {
      reasons.push(`title:${term}`);
      termScore += 12;
    }
    if (input.brand?.toLowerCase().includes(term)) {
      reasons.push(`brand:${term}`);
      termScore += 16;
    }
    if (input.model?.toLowerCase().includes(term)) {
      reasons.push(`model:${term}`);
      termScore += 16;
    }
    if (termScore === 0 && haystack.includes(term)) {
      reasons.push(`text:${term}`);
      termScore += 6;
    }
    return total + termScore;
  }, 0);
  return {
    score,
    reasons: uniqueTerms(reasons)
  };
};

const similarityPercent = (rawScore: number, termCount: number): number => {
  const maxExpectedScore = Math.max(termCount, 1) * 32 + 20;
  return Math.max(0, Math.min(100, Math.round((rawScore / maxExpectedScore) * 100)));
};

const rankedLocalItem = (item: LocalSearchItem, terms: string[]): InternalRankedSearchItem => {
  const match = textMatchScore({
    title: item.title,
    brand: item.brand,
    model: item.model,
    referenceNumber: item.referenceNumber,
    condition: item.condition,
    description: item.description,
    terms
  });
  const rawScore = match.score + Math.min(item.score, 30) + (item.image ? 5 : 0);
  return {
    source: "local",
    id: item.id,
    externalId: null,
    title: item.title,
    brand: item.brand,
    model: item.model,
    referenceNumber: item.referenceNumber,
    price: item.price,
    currency: item.currency,
    condition: item.condition,
    productionYear: item.productionYear,
    movement: item.movement,
    scope: item.scope,
    description: item.description,
    rating: item.rating,
    salesAmount: item.salesAmount,
    priceTrendData: item.priceTrendData,
    image: item.image,
    sourceUrl: null,
    similarityScore: similarityPercent(rawScore, terms.length),
    matchReasons: match.reasons,
    rawScore
  };
};

const rankedEbayItem = (item: EbaySearchItem, terms: string[], index: number): InternalRankedSearchItem => {
  const match = textMatchScore({
    title: item.title,
    condition: item.condition ?? null,
    terms
  });
  const ebayRankBoost = Math.max(0, 20 - index);
  const rawScore = match.score + ebayRankBoost + (item.image ? 5 : 0);
  return {
    source: "ebay",
    id: item.externalId,
    externalId: item.externalId,
    title: item.title,
    brand: item.brand ?? null,
    model: item.model ?? null,
    referenceNumber: item.referenceNumber ?? null,
    price: item.price,
    currency: item.currency,
    condition: item.condition ?? null,
    productionYear: item.productionYear ?? null,
    movement: item.movement ?? null,
    scope: item.scope ?? null,
    description: item.description ?? null,
    rating:
      item.sellerUsername || typeof item.sellerFeedbackScore === "number" || item.sellerFeedbackPercentage
        ? {
            sellerUsername: item.sellerUsername ?? null,
            feedbackScore: item.sellerFeedbackScore ?? null,
            feedbackPercentage: item.sellerFeedbackPercentage ?? null
          }
        : null,
    salesAmount: null,
    priceTrendData: [],
    image: item.image,
    sourceUrl: item.sourceUrl,
    similarityScore: similarityPercent(rawScore, terms.length),
    matchReasons: match.reasons,
    rawScore
  };
};

const rankedSearchItems = (
  query: string,
  local: LocalSearchItem[],
  ebay: EbaySearchItem[],
  limit: number
): RankedSearchItem[] => {
  const terms = uniqueTerms(queryTerms(query));
  return [
    ...local.map((item) => rankedLocalItem(item, terms)),
    ...ebay.map((item, index) => rankedEbayItem(item, terms, index))
  ]
    .filter((item) => item.rawScore > 0)
    .sort((left, right) => right.similarityScore - left.similarityScore || right.rawScore - left.rawScore)
    .slice(0, limit)
    .map(({ rawScore: _rawScore, ...item }) => item);
};

const productKey = (item: Pick<RankedSearchItem, "source" | "id">): string => `${item.source}:${item.id}`;

const knownString = (value: string | null | undefined, fallback: string): string =>
  value && value.trim() ? value.trim() : fallback;

const knownNumber = (value: number | null | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const knownLevel = (value: MarketLevel, fallback: "low" | "medium" | "high"): "low" | "medium" | "high" =>
  value === "low" || value === "medium" || value === "high" ? value : fallback;

const searchFilters = (input: SearchInput): ProductSearchFilters => {
  const filters: ProductSearchFilters = {};
  if (input.brand) {
    filters.brand = input.brand;
  }
  if (input.model) {
    filters.model = input.model;
  }
  if (typeof input.minPrice === "number") {
    filters.minPrice = input.minPrice;
  }
  if (typeof input.maxPrice === "number") {
    filters.maxPrice = input.maxPrice;
  }
  if (input.listingStatus) {
    filters.listingStatus = input.listingStatus;
  }
  if (input.condition) {
    filters.condition = input.condition;
  }
  if (input.region) {
    filters.region = input.region;
  }
  return filters;
};

const hasFilters = (filters: ProductSearchFilters): boolean => Object.keys(filters).length > 0;

const listingStatusMatches = (status: string | null | undefined, dataStatus: string | null | undefined, filter?: ListingStatusFilter): boolean => {
  if (!filter) {
    return true;
  }
  const values = [status, dataStatus].map(normalizedLooseText);
  const soldStatuses = new Set(["sold", "historical sold", "historical_sold", "completed", "ended"]);
  const isSold = values.some((value) => soldStatuses.has(value));
  return filter === "historical_sold" ? isSold : !isSold && values.every((value) => value !== "deleted");
};

const conditionMatches = (condition: string | null | undefined, filter?: ConditionFilter): boolean => {
  if (!filter) {
    return true;
  }
  const value = normalizedLooseText(condition);
  if (filter === "new") {
    return value.includes("new") && !value.includes("unworn");
  }
  if (filter === "unworn") {
    return value.includes("unworn") || value.includes("new other") || value.includes("new without tags");
  }
  if (filter === "very_good") {
    return value.includes("very good") || value.includes("excellent");
  }
  return value.includes("vintage") || value.includes("antique");
};

const priceMatches = (price: number | null | undefined, filters: ProductSearchFilters): boolean => {
  if (typeof filters.minPrice === "number" && (typeof price !== "number" || price < filters.minPrice)) {
    return false;
  }
  if (typeof filters.maxPrice === "number" && (typeof price !== "number" || price > filters.maxPrice)) {
    return false;
  }
  return true;
};

const regionFromData = (data: Record<string, unknown>): string | null =>
  [
    stringValue(data.region),
    stringValue(data.location),
    stringValue(data.country),
    stringValue(data.city),
    stringValue(data.state),
    stringValue(data.stateOrProvince)
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ") || null;

const localProductUrl = (id: string): string => `/api/v1/listings/${id}`;

const firstTitleWords = (title: string | null | undefined, start: number, count: number): string =>
  (title ?? "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(start, start + count)
    .join(" ");

const guessedBrand = (item: Pick<RankedSearchItem, "brand" | "title">): string =>
  knownString(item.brand, firstTitleWords(item.title, 0, 1) || "Estimated");

const guessedModel = (item: Pick<RankedSearchItem, "model" | "title">): string =>
  knownString(item.model, firstTitleWords(item.title, 1, 3) || knownString(item.title, "Watch model"));

const guessedReferenceNumber = (item: Pick<RankedSearchItem, "referenceNumber" | "title" | "id">): string => {
  if (item.referenceNumber?.trim()) {
    return item.referenceNumber.trim();
  }
  const referenceLike = (item.title ?? "")
    .split(/\s+/)
    .find((word) => /[A-Z0-9-]{4,}/i.test(word) && /\d/.test(word));
  return referenceLike ?? `estimated-${item.id.slice(0, 8)}`;
};

const productImage = (item: Pick<RankedSearchItem, "image">, fallback: ProductDetailGuess): string =>
  knownString(item.image, fallback.image);

const productSourceUrl = (item: Pick<RankedSearchItem, "source" | "id" | "sourceUrl">, fallback: ProductDetailGuess): string =>
  knownString(item.sourceUrl, item.source === "local" ? localProductUrl(item.id) : fallback.sourceUrl);

const ratingScore = (rating: ProductRating | null, fallback: number): number => {
  if (!rating) {
    return fallback;
  }
  if (rating.feedbackPercentage) {
    const percentage = Number(rating.feedbackPercentage.replace("%", ""));
    if (Number.isFinite(percentage)) {
      return roundPercentage(Math.max(0, Math.min(5, percentage / 20)));
    }
  }
  if (typeof rating.feedbackScore === "number") {
    return roundPercentage(Math.max(0, Math.min(5, rating.feedbackScore / 1000)));
  }
  return fallback;
};

const compactSimilarProduct = (item: RankedSearchItem, fallback: ProductDetailGuess) => ({
  source: item.source,
  id: item.id,
  externalId: knownString(item.externalId, item.id),
  title: knownString(item.title, fallback.description),
  price: knownNumber(item.price, fallback.currentPrice),
  currency: knownString(item.currency, "USD"),
  condition: knownString(item.condition, fallback.condition),
  image: productImage(item, fallback),
  sourceUrl: productSourceUrl(item, fallback)
});

const compactGuessedSimilarProduct = (
  item: RankedSearchItem,
  fallback: ProductDetailGuess,
  index: number
): ProductDetails["similarProducts"][number] => {
  const guess = fallback.similarProducts[index] ?? fallback.similarProducts[0];
  return {
    source: item.source,
    id: `${item.id}:similar:${index + 1}`,
    externalId: `${item.id}:similar:${index + 1}`,
    title: knownString(guess?.title, fallback.description),
    price: knownNumber(guess?.price, fallback.currentPrice),
    currency: knownString(guess?.currency, knownString(item.currency, "USD")),
    condition: knownString(guess?.condition, fallback.condition),
    image: knownString(guess?.image, productImage(item, fallback)),
    sourceUrl: knownString(guess?.sourceUrl, productSourceUrl(item, fallback))
  };
};

const fiveSimilarProducts = (
  item: RankedSearchItem,
  comparableItems: RankedSearchItem[],
  fallback: ProductDetailGuess
): ProductDetails["similarProducts"] => {
  const realSimilar = comparableItems
    .filter((candidate) => candidate.id !== item.id || candidate.source !== item.source)
    .map((candidate) => compactSimilarProduct(candidate, fallback));
  const guessedSimilar = Array.from({ length: 5 }, (_value, index) => compactGuessedSimilarProduct(item, fallback, index));
  const unique = [...realSimilar, ...guessedSimilar].filter((candidate, index, list) => {
    const key = `${candidate.source}:${candidate.id}:${candidate.title}`;
    return list.findIndex((other) => `${other.source}:${other.id}:${other.title}` === key) === index;
  });
  return unique.slice(0, 5);
};

const trendDataFromRecord = (value: unknown): Array<{ label: string; averagePrice: number | null; listingCount: number }> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }
    const record = item as Record<string, unknown>;
    const label = stringValue(record.label) ?? stringValue(record.date) ?? stringValue(record.period);
    if (!label) {
      return [];
    }
    return [
      {
        label,
        averagePrice: numberValue(record.averagePrice) ?? numberValue(record.price),
        listingCount: integerValue(record.listingCount) ?? integerValue(record.count) ?? 0
      }
    ];
  });
};

const fallbackGuess = (
  item: RankedSearchItem,
  marketAveragePrice: number | null,
  lowestPrice: number | null,
  highestPrice: number | null,
  listingVolumeAmount: number,
  volatility: MarketLevel
): ProductDetailGuess => {
  const currentPrice = item.price ?? marketAveragePrice ?? 0;
  const averagePrice = marketAveragePrice ?? currentPrice;
  const changePercentage = averagePrice ? roundPercentage(((currentPrice - averagePrice) / averagePrice) * 100) : 0;
  const condition = item.condition ?? "Pre-Owned";
  const currency = item.currency ?? "USD";
  const sourceUrl = item.sourceUrl ?? (item.source === "local" ? localProductUrl(item.id) : "not_available");
  const image = item.image ?? "not_available";
  return {
    id: productKey(item),
    brand: guessedBrand(item),
    model: guessedModel(item),
    referenceNumber: guessedReferenceNumber(item),
    currentPrice,
    marketAveragePrice: averagePrice,
    currentPriceChangePercentage: changePercentage,
    currentPriceDirection: changePercentage > 0 ? "increase" : changePercentage < 0 ? "decrease" : "same",
    marketStatus: volatility === "high" ? "unstable" : "stable",
    productionYear: new Date().getUTCFullYear(),
    condition,
    movement: "automatic",
    scope: "watch only",
    rating: 0,
    salesAmount: 0,
    lowestPrice: lowestPrice ?? currentPrice,
    highestPrice: highestPrice ?? currentPrice,
    priceTrendData: [{ label: "estimated", averagePrice: averagePrice, listingCount: Math.max(1, listingVolumeAmount) }],
    liquidityScope: "medium",
    listingVolumeAmount: Math.max(1, listingVolumeAmount),
    listingVolumePercentage: 100,
    volatility: knownLevel(volatility, "medium"),
    description: item.description ?? item.title ?? "Watch marketplace product",
    image,
    sourceUrl,
    similarProducts: Array.from({ length: 5 }, (_value, index) => {
      const multiplier = [0.92, 0.97, 1.03, 1.08, 1.15][index] ?? 1;
      const suffix = ["Comparable listing", "Similar condition", "Market alternative", "Recent comparable", "Nearby market price"][index];
      return {
        title: `${item.title ?? "Watch marketplace product"} - ${suffix}`,
        price: roundMoney(currentPrice * multiplier),
        currency,
        condition,
        image,
        sourceUrl
      };
    })
  };
};

const realProductGuessInput = (item: RankedSearchItem) => ({
  id: productKey(item),
  title: item.title ?? "Watch marketplace product",
  source: item.source,
  ...(item.brand ? { brand: item.brand } : {}),
  ...(item.model ? { model: item.model } : {}),
  ...(item.referenceNumber ? { referenceNumber: item.referenceNumber } : {}),
  ...(typeof item.price === "number" ? { price: item.price } : {}),
  ...(item.currency ? { currency: item.currency } : {}),
  ...(item.condition ? { condition: item.condition } : {}),
  ...(item.description ? { description: item.description } : {}),
  ...(item.image ? { image: item.image } : {}),
  ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : item.source === "local" ? { sourceUrl: localProductUrl(item.id) } : {})
});

const enrichProductDetails = async (
  ai: ReturnType<typeof createAiProvider>,
  query: string,
  items: RankedSearchItem[],
  comparableItems: RankedSearchItem[],
  listingVolumeAmount: number
): Promise<ProductDetails[]> => {
  const prices = comparableItems.map((item) => item.price).filter((price): price is number => typeof price === "number");
  const avg = average(prices);
  const marketAveragePrice = avg === null ? null : roundMoney(avg);
  const stdDev = standardDeviation(prices);
  const coefficientOfVariation = avg && stdDev !== null ? stdDev / avg : null;
  const volatility = levelFromCoefficient(coefficientOfVariation);
  const marketStatus = volatility === "unknown" ? "unknown" : volatility === "high" ? "unstable" : "stable";
  const liquidityScope = liquidityLevel(listingVolumeAmount, comparableItems.length, volatility);
  const lowestPrice = prices.length > 0 ? roundMoney(Math.min(...prices)) : null;
  const highestPrice = prices.length > 0 ? roundMoney(Math.max(...prices)) : null;
  const fallbacks = new Map(
    items.map((item) => [productKey(item), fallbackGuess(item, marketAveragePrice, lowestPrice, highestPrice, listingVolumeAmount, volatility)])
  );
  const guesses = await withTimeout(
    ai.inferProductDetails({
      query,
      products: items.map(realProductGuessInput)
    }),
    getAiConfig().analysisTimeoutMs,
    "AI product detail inference timed out."
  ).catch(() => Array.from(fallbacks.values()));
  const guessById = new Map(guesses.map((guess) => [guess.id, guess]));

  return items.map((item) => {
    const key = productKey(item);
    const guess = guessById.get(key) ?? fallbacks.get(key) ?? fallbackGuess(item, marketAveragePrice, lowestPrice, highestPrice, listingVolumeAmount, volatility);
    const sourceVolume = comparableItems.filter((candidate) => candidate.source === item.source).length;
    const currentPrice = knownNumber(item.price, guess.currentPrice);
    const averagePrice = marketAveragePrice ?? guess.marketAveragePrice;
    const currentPriceChangePercentage =
      averagePrice ? roundPercentage(((currentPrice - averagePrice) / averagePrice) * 100) : guess.currentPriceChangePercentage;
    const currentPriceDirection =
      currentPriceChangePercentage > 0
          ? "increase"
          : currentPriceChangePercentage < 0
            ? "decrease"
            : "same";
    const similarProducts = fiveSimilarProducts(item, comparableItems, guess);

    return {
      source: item.source,
      id: item.id,
      externalId: knownString(item.externalId, item.id),
      title: knownString(item.title, guess.description),
      brand: knownString(item.brand, guess.brand),
      model: knownString(item.model, guess.model),
      referenceNumber: knownString(item.referenceNumber, guess.referenceNumber),
      currentPrice,
      currency: knownString(item.currency, "USD"),
      currentPriceChangePercentage,
      currentPriceDirection,
      marketAveragePrice: averagePrice,
      marketStatus: marketStatus === "unknown" ? guess.marketStatus : marketStatus,
      productionYear: item.productionYear ?? guess.productionYear,
      condition: knownString(item.condition, guess.condition),
      movement: knownString(item.movement, guess.movement),
      scope: knownString(item.scope, guess.scope),
      rating: ratingScore(item.rating, guess.rating),
      salesAmount: item.salesAmount ?? guess.salesAmount,
      lowestPrice: lowestPrice ?? guess.lowestPrice,
      highestPrice: highestPrice ?? guess.highestPrice,
      priceTrendData: item.priceTrendData.length > 0 ? item.priceTrendData.map((trend) => ({
        label: trend.label,
        averagePrice: trend.averagePrice ?? averagePrice,
        listingCount: trend.listingCount
      })) : guess.priceTrendData,
      liquidityScope: knownLevel(liquidityScope, guess.liquidityScope),
      listingVolumeAmount: listingVolumeAmount > 0 ? listingVolumeAmount : guess.listingVolumeAmount,
      listingVolumePercentage: comparableItems.length > 0 ? roundPercentage((sourceVolume / comparableItems.length) * 100) : guess.listingVolumePercentage,
      volatility: knownLevel(volatility, guess.volatility),
      description: knownString(item.description, guess.description),
      image: productImage(item, guess),
      sourceUrl: productSourceUrl(item, guess),
      similarityScore: item.similarityScore,
      matchReasons: item.matchReasons,
      similarProducts
    };
  });
};

const fallbackAnalysisTitleTerms = (analysis: ImageAnalysis): string[] =>
  Object.values(analysis.visualAttributes)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 3);

const generatedTitleFromAnalysis = (analysis: ImageAnalysis): string =>
  compactSearchPart(analysis.generatedTitle) ||
  searchQueryFromParts(analysis.probableBrand, analysis.probableModel, analysis.probableReferenceNumber) ||
  searchQueryFromParts(...fallbackAnalysisTitleTerms(analysis));

const appErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof AppError || error instanceof Error ? error.message : fallback;

const ebaySearchPlanFromAnalysis = (analysis: ImageAnalysis, query: string): EbaySearchPlan => {
  const brand = compactSearchPart(analysis.probableBrand);
  const model = compactSearchPart(analysis.probableModel);
  const referenceNumber = compactSearchPart(analysis.probableReferenceNumber);
  const dialColor = compactSearchPart(analysis.visualAttributes.dialColor);

  const queries = uniqueSearchQueries([
    searchQueryFromParts(brand, model, referenceNumber),
    searchQueryFromParts(brand, referenceNumber),
    searchQueryFromParts(brand, model),
    searchQueryFromParts(brand, model, dialColor),
    query
  ]);
  const primaryQuery = queries[0] ?? query.trim().replace(/\s+/g, " ");

  return {
    normalization: {
      query: primaryQuery,
      source: "fallback",
      confidence: analysis.containsWatch ? 1 : null,
      detectedBrand: brand,
      detectedModel: model,
      reasoning: "Built from image-detected watch identifiers for eBay Browse search."
    },
    queries: queries.length > 0 ? queries : [primaryQuery]
  };
};

const ebayItem = (item: MarketplaceListing): EbaySearchItem => {
  const output: EbaySearchItem = {
    source: "ebay",
    externalId: item.externalId,
    title: item.title,
    price: item.price,
    currency: item.currency,
    sourceUrl: item.sourceUrl,
    buyingOptions: item.buyingOptions,
    image: item.imageUrl ?? null
  };
  if ("description" in item && typeof item.description === "string") {
    output.description = item.description;
  } else if (item.aspects && Object.keys(item.aspects).length > 0) {
    output.description = Object.entries(item.aspects)
      .slice(0, 8)
      .map(([name, value]) => `${name}: ${value}`)
      .join("; ");
  }
  if (item.condition) {
    output.condition = item.condition;
  }
  if (item.brand) {
    output.brand = item.brand;
  }
  if (item.model) {
    output.model = item.model;
  }
  if (item.referenceNumber) {
    output.referenceNumber = item.referenceNumber;
  }
  if (typeof item.productionYear === "number") {
    output.productionYear = item.productionYear;
  }
  if (item.movement) {
    output.movement = item.movement;
  }
  if (item.scope) {
    output.scope = item.scope;
  }
  if (item.sellerUsername) {
    output.sellerUsername = item.sellerUsername;
  }
  if (item.location) {
    output.location = item.location;
  }
  return output;
};

const serializeRecord = (record: GeneratedApiRecordDocument) => ({
  id: record._id.toString(),
  resource: record.resource,
  ownerId: record.ownerId ?? null,
  scope: record.scope,
  data: record.data,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
});

const localSearchItemFromRecord = (record: GeneratedApiRecordDocument, terms: string[]): LocalSearchItem => ({
  source: "local",
  id: record._id.toString(),
  title: stringValue(record.data.title),
  brand: stringValue(record.data.brand),
  model: stringValue(record.data.model),
  referenceNumber: stringValue(record.data.referenceNumber),
  price: numberValue(record.data.price),
  currency: stringValue(record.data.currency),
  condition: stringValue(record.data.condition),
  productionYear: integerValue(record.data.productionYear) ?? integerValue(record.data.year),
  movement: stringValue(record.data.movement),
  scope: stringValue(record.data.scope) ?? stringValue(record.data.set),
  description: stringValue(record.data.description),
  image: firstListingImageUrl(record.data),
  region: regionFromData(record.data),
  rating: ratingFromRecord(record.data),
  salesAmount: numberValue(record.data.salesAmount) ?? numberValue(record.data.totalSales),
  priceTrendData: trendDataFromRecord(record.data.priceTrendData),
  status: record.status,
  listingStatus: stringValue(record.data.listingStatus) ?? stringValue(record.data.status),
  score: terms.length > 0 ? localMatchScore(record.data, terms) : 1,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
});

export class AiService {
  private readonly ai = createAiProvider();
  private readonly ebay = new EbayProvider();

  public async analyzeImage(input: AnalyzeInput): Promise<ImageAnalysis> {
    const request = this.toAnalysisRequest(input);
    try {
      return await withTimeout(
        this.ai.analyzeImage(request),
        getAiConfig().analysisTimeoutMs,
        "AI image analysis timed out."
      );
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError("AI image analysis failed.");
    }
  }

  public async createSearch(actor: Actor, input: SearchInput) {
    const filters = searchFilters(input);
    const explicitText = (input.q ?? input.keyword ?? input.query ?? input.search)?.trim();
    const explicitQuery = searchQueryFromParts(explicitText, filters.brand, filters.model);
    const hasImage = Boolean(input.file || input.imageUrl);
    if (!explicitQuery && !hasImage && !hasFilters(filters)) {
      throw new ConflictError("Provide a keyword, filter, or an image file.");
    }

    let imageUploadError: unknown;
    const imageUrlPromise = hasImage
      ? this.storeImageIfNeeded(actor.id, "image-search", input.file, input.imageUrl).catch((error: unknown) => {
          imageUploadError = error;
          return undefined;
        })
      : Promise.resolve<string | undefined>(undefined);
    let analysisError: string | undefined;
    const analysis = hasImage && !explicitQuery
      ? await this.analyzeImage({ ...input, includeEmbedding: false }).catch((error: unknown) => {
          analysisError = appErrorMessage(error, "AI image analysis failed.");
          return undefined;
        })
      : undefined;
    const generatedTitle = analysis ? generatedTitleFromAnalysis(analysis) : null;
    const filterOnlySearch = !explicitQuery && !generatedTitle && !hasImage && hasFilters(filters);
    const query = explicitQuery || generatedTitle || (hasImage && analysisError ? "watch" : hasFilters(filters) ? "watch" : "");
    if (!query) {
      throw new ConflictError("AI could not detect a searchable watch from the image.");
    }
    const ebaySearchPlan = analysis ? ebaySearchPlanFromAnalysis(analysis, query) : undefined;

    const [local, ebayResult] = await Promise.all([
      this.searchLocalListings(filterOnlySearch ? "" : query, input.limit, filters),
      this.searchEbayListings(query, input.limit, input.marketplaceId, ebaySearchPlan, filters)
    ]);
    const imageUrl = await imageUrlPromise;
    if (imageUploadError) {
      if (imageUploadError instanceof AppError) {
        throw imageUploadError;
      }
      throw new ExternalServiceError("Image upload failed.");
    }

    const rankedItems = rankedSearchItems(query, local, ebayResult.items, input.limit);
    const comparableItems = rankedSearchItems(query, local, ebayResult.items, Math.max(input.limit, local.length + ebayResult.items.length));
    const listingVolumeAmount = Math.max(ebayResult.total ?? 0, ebayResult.items.length) + local.length;
    const productDetails = await enrichProductDetails(this.ai, query, rankedItems, comparableItems, listingVolumeAmount);

    const record = await GeneratedApiRecordModel.create({
      resource: "image-search",
      ownerId: actor.id,
      scope: {},
      data: {
        query,
        generatedTitle,
        imageUrl,
        analysis: analysis ? compactAnalysisData(analysis) : null,
        analysisError: analysisError ?? null,
        resultCounts: {
          local: local.length,
          ebay: ebayResult.items.length
        },
        marketplaceQueries: {
          local: query,
          ebay: ebayResult.query
        },
        filters,
        queryNormalization: {
          ebay: ebayResult.queryNormalization
        },
        marketplaceMetadata: {
          ebay: {
            environment: ebayResult.environment,
            marketplaceId: ebayResult.marketplaceId,
            total: ebayResult.total,
            attemptedQueries: ebayResult.attemptedQueries,
            warnings: ebayResult.warnings
          }
        }
      },
      status: "completed",
      history: [
        {
          action: "image-search.created",
          actorId: actor.id,
          actorType: actor.audience,
          at: new Date(),
          metadata: { query, generatedTitle, imageUrl }
        }
      ]
    });

    return {
      searchId: record._id.toString(),
      query,
      generatedTitle,
      image: imageUrl ?? null,
      analysis: analysis ?? null,
      results: {
        items: productDetails,
        local,
        ebay: ebayResult.items
      },
      metadata: {
        filters,
        ebayQuery: ebayResult.query,
        queryNormalization: {
          ebay: ebayResult.queryNormalization
        },
        ebay: {
          environment: ebayResult.environment,
          marketplaceId: ebayResult.marketplaceId,
          total: ebayResult.total,
          count: ebayResult.items.length,
          attemptedQueries: ebayResult.attemptedQueries,
          warnings: ebayResult.warnings
        }
      },
      warnings: analysisError ? ["AI image analysis failed; returned broad watch search results."] : [],
      ...(analysisError || ebayResult.error
        ? {
            errors: {
              ...(analysisError ? { analysis: analysisError } : {}),
              ...(ebayResult.error ? { ebay: ebayResult.error } : {})
            }
          }
        : {}),
      record: serializeRecord(record)
    };
  }

  public async autoDetectListing(actor: Actor, listingId: string, input: AnalyzeInput) {
    const imageUrl = await this.storeImageIfNeeded(actor.id, `listings/${listingId}/auto-detect`, input.file, input.imageUrl);
    const analysis = await this.analyzeImage({
      ...input,
      imageUrl
    });
    const record = await GeneratedApiRecordModel.create({
      resource: "auto-detect",
      ownerId: actor.id,
      scope: { listingId },
      data: {
        listingId,
        imageUrl,
        analysis: compactAnalysisData(analysis),
        suggestedListingFields: {
          brand: analysis.probableBrand ?? null,
          model: analysis.probableModel ?? null,
          referenceNumber: analysis.probableReferenceNumber ?? null
        }
      },
      status: "completed",
      history: [
        {
          action: "listings.auto-detect",
          actorId: actor.id,
          actorType: actor.audience,
          at: new Date(),
          metadata: { listingId, imageUrl }
        }
      ]
    });

    return {
      listingId,
      imageUrl,
      analysis,
      suggestedListingFields: {
        brand: analysis.probableBrand ?? null,
        model: analysis.probableModel ?? null,
        referenceNumber: analysis.probableReferenceNumber ?? null
      },
      record: serializeRecord(record)
    };
  }

  public async getImageSearch(actor: Actor, searchId: string) {
    const record = await GeneratedApiRecordModel.findOne({
      _id: searchId,
      resource: "image-search",
      ownerId: actor.id,
      deletedAt: null
    });
    if (!record) {
      throw new ResourceNotFoundError("Image search not found.");
    }
    return serializeRecord(record);
  }

  public async recentImageSearches(actor: Actor) {
    const records = await GeneratedApiRecordModel.find({
      resource: "image-search",
      ownerId: actor.id,
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .limit(20);
    return records.map(serializeRecord);
  }

  public async getProductDetailsById(input: {
    source: ProductDetailSource;
    productId: string;
    marketplaceId?: string;
  }): Promise<ProductDetails> {
    if (input.source === "local") {
      if (!Types.ObjectId.isValid(input.productId)) {
        throw new ResourceNotFoundError("Product not found.");
      }
      const record = await GeneratedApiRecordModel.findOne({
        _id: input.productId,
        resource: "listings",
        deletedAt: null
      });
      if (!record) {
        throw new ResourceNotFoundError("Product not found.");
      }
      const query = stringValue(record.data.title) ?? stringValue(record.data.brand) ?? "watch";
      const localItem = localSearchItemFromRecord(record, queryTerms(query));
      const [local, ebayResult] = await Promise.all([
        this.searchLocalListings(query, 20),
        this.searchEbayListings(query, 20, input.marketplaceId)
      ]);
      const rankedItem = rankedLocalItem(localItem, uniqueTerms(queryTerms(query)));
      const comparableItems = rankedSearchItems(query, local, ebayResult.items, Math.max(20, local.length + ebayResult.items.length));
      const listingVolumeAmount = Math.max(ebayResult.total ?? 0, ebayResult.items.length) + local.length;
      return (await enrichProductDetails(this.ai, query, [rankedItem], comparableItems, listingVolumeAmount))[0]!;
    }

    const detailOptions: Parameters<EbayProvider["getListingDetails"]>[1] = {};
    if (input.marketplaceId) {
      detailOptions.marketplaceId = input.marketplaceId;
    }
    const product = ebayItem(await this.ebay.getListingDetails(input.productId, detailOptions));
    const query = product.title;
    const ebayResult = await this.searchEbayListings(query, 20, input.marketplaceId, {
      normalization: {
        query,
        source: "fallback",
        confidence: null,
        detectedBrand: null,
        detectedModel: null,
        reasoning: null
      },
      queries: [query]
    });
    const rankedItem = rankedEbayItem(product, uniqueTerms(queryTerms(query)), 0);
    const comparableItems = rankedSearchItems(query, [], ebayResult.items, Math.max(20, ebayResult.items.length));
    const listingVolumeAmount = Math.max(ebayResult.total ?? 0, ebayResult.items.length);
    return (await enrichProductDetails(this.ai, query, [rankedItem], comparableItems, listingVolumeAmount))[0]!;
  }

  private async searchLocalListings(query: string, limit: number, filters: ProductSearchFilters = {}): Promise<LocalSearchItem[]> {
    const terms = queryTerms(query);
    if (terms.length === 0 && !hasFilters(filters)) {
      return [];
    }

    const records = await GeneratedApiRecordModel.find({
      resource: "listings",
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(Math.max(limit * 5, 200));

    return records
      .map((record): LocalSearchItem => localSearchItemFromRecord(record, terms))
      .filter((item) => (terms.length === 0 || item.score > 0) && this.localItemMatchesFilters(item, filters))
      .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);
  }

  private localItemMatchesFilters(item: LocalSearchItem, filters: ProductSearchFilters): boolean {
    return (
      includesLooseText(item.brand, filters.brand) &&
      includesLooseText(item.model, filters.model) &&
      priceMatches(item.price, filters) &&
      listingStatusMatches(item.status, item.listingStatus, filters.listingStatus) &&
      conditionMatches(item.condition, filters.condition) &&
      includesLooseText(item.region, filters.region)
    );
  }

  private async searchEbayListings(
    query: string,
    limit: number,
    marketplaceId: string | undefined,
    searchPlan?: EbaySearchPlan,
    filters: ProductSearchFilters = {}
  ): Promise<{
    items: EbaySearchItem[];
    query: string;
    queryNormalization: MarketplaceQueryNormalization;
    environment: "sandbox" | "production";
    marketplaceId: string;
    total: number | null;
    attemptedQueries: string[];
    warnings: string[];
    error?: string;
  }> {
    const normalization = searchPlan?.normalization ?? await this.normalizeMarketplaceQuery(query);
    const config = getMarketplaceConfig().ebay;
    const resolvedMarketplaceId = marketplaceId ?? config.marketplaceId;
    if (filters.listingStatus === "historical_sold") {
      return {
        query: normalization.query,
        queryNormalization: normalization,
        items: [],
        environment: config.environment,
        marketplaceId: resolvedMarketplaceId,
        total: null,
        attemptedQueries: [],
        warnings: ["eBay Browse search returns active listings only; historical sold results are searched from local database records."],
      };
    }
    try {
      const options: Parameters<EbayProvider["searchListingsWithMetadata"]>[1] = { limit };
      if (marketplaceId) {
        options.marketplaceId = marketplaceId;
      }
      if (typeof filters.minPrice === "number") {
        options.minPrice = filters.minPrice;
      }
      if (typeof filters.maxPrice === "number") {
        options.maxPrice = filters.maxPrice;
      }
      const allQueries = uniqueSearchQueries([normalization.query, ...(searchPlan?.queries ?? [])]);
      const queries = config.environment === "production" ? allQueries.slice(0, 4) : allQueries.slice(0, 1);
      const attemptedQueries: string[] = [];
      let total: number | null = null;
      let selectedQuery = normalization.query;
      let items: EbaySearchItem[] = [];

      for (const ebayQuery of queries) {
        attemptedQueries.push(ebayQuery);
        const result = await withTimeout(
          this.ebay.searchListingsWithMetadata(ebayQuery, options),
          getAiConfig().ebaySearchTimeoutMs,
          "eBay search timed out."
        );
        total = result.total;
        items = result.items.map(ebayItem).filter((item) => this.ebayItemMatchesFilters(item, filters));
        selectedQuery = ebayQuery;
        if (items.length > 0) {
          break;
        }
      }

      const warnings = config.environment === "sandbox" && items.length === 0 ? [sandboxEmptySearchWarning] : [];
      if (selectedQuery !== normalization.query && items.length > 0) {
        warnings.push(`No eBay results for "${normalization.query}"; used broader query "${selectedQuery}".`);
      }
      return {
        query: selectedQuery,
        queryNormalization: { ...normalization, query: selectedQuery },
        environment: config.environment,
        marketplaceId: resolvedMarketplaceId,
        total,
        attemptedQueries,
        warnings,
        items
      };
    } catch (error) {
      return {
        query: normalization.query,
        queryNormalization: normalization,
        items: [],
        environment: config.environment,
        marketplaceId: resolvedMarketplaceId,
        total: null,
        attemptedQueries: [],
        warnings: [],
        error: error instanceof AppError ? error.message : "eBay search failed."
      };
    }
  }

  private ebayItemMatchesFilters(item: EbaySearchItem, filters: ProductSearchFilters): boolean {
    return (
      includesLooseText(item.brand ?? null, filters.brand) &&
      includesLooseText(item.model ?? null, filters.model) &&
      priceMatches(item.price, filters) &&
      conditionMatches(item.condition ?? null, filters.condition) &&
      includesLooseText(item.location ?? null, filters.region)
    );
  }

  private async normalizeMarketplaceQuery(query: string): Promise<MarketplaceQueryNormalization> {
    const fallbackQuery = query.trim().replace(/\s+/g, " ");
    try {
      const normalized = await withTimeout(
        this.ai.normalizeSearchQuery({ query }),
        getAiConfig().queryNormalizationTimeoutMs,
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

  private toAnalysisRequest(input: AnalyzeInput): ImageAnalysisRequest {
    if (input.file) {
      const request: ImageAnalysisRequest = {
        imageUrl: input.imageUrl ?? "uploaded-image",
        imageDataUrl: fileToDataUrl(input.file)
      };
      if (typeof input.includeEmbedding === "boolean") {
        request.includeEmbedding = input.includeEmbedding;
      }
      if (input.modelVersion) {
        request.modelVersion = input.modelVersion;
      }
      return request;
    }
    if (input.imageUrl) {
      const request: ImageAnalysisRequest = {
        imageUrl: input.imageUrl
      };
      if (typeof input.includeEmbedding === "boolean") {
        request.includeEmbedding = input.includeEmbedding;
      }
      if (input.modelVersion) {
        request.modelVersion = input.modelVersion;
      }
      return request;
    }
    throw new ConflictError("Provide an image file or imageUrl.");
  }

  private async storeImageIfNeeded(
    userId: string,
    prefix: string,
    file: Express.Multer.File | undefined,
    fallbackImageUrl: string | undefined
  ): Promise<string> {
    if (!file) {
      if (!fallbackImageUrl) {
        throw new ConflictError("Provide an image file or imageUrl.");
      }
      return fallbackImageUrl;
    }

    const extension = imageExtensionByMimeType[file.mimetype];
    if (!extension) {
      throw new ConflictError("Only image/jpeg, image/png, image/webp, and image/gif files are supported.");
    }
    const key = `${prefix}/${userId}/${randomUUID()}.${extension}`;
    return uploadObject({
      key,
      body: file.buffer,
      contentType: file.mimetype
    });
  }
}
