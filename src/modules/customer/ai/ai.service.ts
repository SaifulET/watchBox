import { createHash, randomUUID } from "node:crypto";
import { Types } from "mongoose";
import sharp from "sharp";
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
import type { RedisClient } from "../../../infrastructure/redis/client.js";
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
  referenceNumber?: string;
  limit: number;
  marketplaceId?: string;
  visualDepth?: "fast" | "deep";
  candidateImageLimit?: number;
};

type AiServiceDependencies = {
  redis?: RedisClient;
};

type ImageAnalysisCacheLookup = {
  cacheHit: boolean;
  analysis?: ImageAnalysis;
  imageHash?: string;
  cacheKey?: string;
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
  aspects?: Record<string, string>;
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

type DirectSearchItem = {
  source: "local" | "ebay";
  marketplace: "local" | "ebay";
  id: string;
  externalId: string | null;
  title: string | null;
  brand: string | null;
  model: string | null;
  referenceNumber: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  image: string | null;
  sourceUrl: string | null;
  originalUrl: string | null;
  matchScore: number;
  matchType: "text" | "image";
  visualSimilarity: number | null;
  matchReasons: string[];
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
  priorityScore: number;
};

type SearchPrioritySignals = {
  containsWatch?: boolean;
  brand?: string;
  model?: string;
  referenceNumber?: string;
  visualTerms: string[];
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

type ImageQualityCheck = {
  passed: boolean;
  warnings: string[];
  checks: {
    hasImage: boolean;
    acceptedMimeType: boolean;
    nonEmptyFile: boolean | null;
    containsWatch: boolean | null;
  };
};

type VisualSearchMatch = Omit<ProductDetails, "similarProducts"> & {
  marketplace: "local" | "ebay";
  originalUrl: string;
  visualSimilarity: number | null;
  metadataSimilarity: number;
  matchScore: number;
  matchLevel: "very_high" | "high" | "possible" | "low";
  matchedOn: string[];
  confidence: number;
  confidenceBreakdown: {
    imageSimilarity: number | null;
    visualAttributes: number;
    metadata: number;
    text: number;
  };
  candidateImageAnalysis: {
    containsWatch: boolean;
    generatedTitle: string | null;
    probableBrand: string | null;
    probableModel: string | null;
    probableReferenceNumber: string | null;
    visualAttributes: Record<string, string>;
    modelVersion: string;
  } | null;
};

type VisualEmbeddingResult = {
  embedding: number[];
  imageHash?: string;
  cacheHit: boolean;
  model: string;
};

type CandidateVisualEmbedding = {
  key: string;
  embedding: number[];
  imageHash?: string;
  cacheHit: boolean;
  model: string;
};

type VisualMatchLevel = "very_high" | "high" | "possible" | "low";

type VisualSearchWeights = {
  visualSimilarity: number;
  brand: number;
  model: number;
  dialFeatures: number;
  caseBezel: number;
  strap: number;
  text: number;
};

type VisualSignalScores = {
  brand: number;
  model: number;
  dialFeatures: number;
  caseBezel: number;
  strap: number;
  text: number;
  matchedOn: string[];
};

type EbayListingsSearchResult = {
  items: EbaySearchItem[];
  query: string;
  queryNormalization: MarketplaceQueryNormalization;
  environment: "sandbox" | "production";
  marketplaceId: string;
  total: number | null;
  attemptedQueries: string[];
  warnings: string[];
  error?: string;
};

type VisualMarketplaceSearchResult = {
  local: LocalSearchItem[];
  ebay: EbayListingsSearchResult;
  localQueries: string[];
  ebayQueries: string[];
  localCacheHits: number;
  ebayCacheHits: number;
};

const imageExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const sandboxEmptySearchWarning =
  "eBay sandbox does not include live marketplace inventory. Use EBAY_ENVIRONMENT=production with production eBay Browse API credentials for real eBay results.";

const visualEmbeddingModel = "sharp-rgb-grid-histogram-v1";
const visualAnalysisCacheTtlSeconds = 60 * 60 * 24;
const visualEmbeddingCacheTtlSeconds = 60 * 60 * 24 * 14;
const marketplaceSearchCacheTtlSeconds = 60 * 3;
const visualSearchWeights: VisualSearchWeights = {
  visualSimilarity: 0.55,
  brand: 0.15,
  model: 0.10,
  dialFeatures: 0.08,
  caseBezel: 0.05,
  strap: 0.04,
  text: 0.03
};

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

type ImageSearchTimerStage =
  | "image-read"
  | "sharp-resize"
  | "image-upload"
  | "query-image-embedding"
  | "openai"
  | "marketplace-search"
  | "candidate-image-fetch"
  | "candidate-image-embedding"
  | "visual-ranking"
  | "total";

const createImageSearchTimer = (scope: string) => {
  const timerId = randomUUID().slice(0, 8);
  const activeLabels = new Set<string>();
  const counters = new Map<ImageSearchTimerStage, number>();
  const nextLabel = (stage: ImageSearchTimerStage): string => {
    const count = (counters.get(stage) ?? 0) + 1;
    counters.set(stage, count);
    return `${stage}:${scope}:${timerId}:${count}`;
  };
  const start = (stage: ImageSearchTimerStage): string => {
    const label = nextLabel(stage);
    activeLabels.add(label);
    console.time(label);
    return label;
  };
  const end = (label: string): void => {
    if (!activeLabels.delete(label)) {
      return;
    }
    console.timeEnd(label);
  };

  return {
    start,
    end,
    async measure<T>(stage: ImageSearchTimerStage, task: () => Promise<T>): Promise<T> {
      const label = start(stage);
      try {
        return await task();
      } finally {
        end(label);
      }
    },
    measureSync<T>(stage: ImageSearchTimerStage, task: () => T): T {
      const label = start(stage);
      try {
        return task();
      } finally {
        end(label);
      }
    },
    endAll(): void {
      for (const label of Array.from(activeLabels).reverse()) {
        end(label);
      }
    }
  };
};

const fileToDataUrl = (file: Express.Multer.File): string =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

const imagePreprocessInput = async <TInput extends AnalyzeInput>(input: TInput): Promise<TInput> => {
  if (!input.file) {
    return input;
  }
  const optimizedBuffer = await sharp(input.file.buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({
      quality: 82,
      mozjpeg: true
    })
    .toBuffer();
  const buffer = optimizedBuffer.length < input.file.buffer.length ? optimizedBuffer : input.file.buffer;
  return {
    ...input,
    file: {
      ...input.file,
      buffer,
      size: buffer.length,
      mimetype: optimizedBuffer.length < input.file.buffer.length ? "image/jpeg" : input.file.mimetype,
      originalname: optimizedBuffer.length < input.file.buffer.length
        ? input.file.originalname.replace(/\.[^.]+$/, ".jpg")
        : input.file.originalname
    }
  };
};

const imageHashInput = (input: AnalyzeInput): Buffer | string | undefined =>
  input.file?.buffer ?? input.imageUrl;

const imageHash = (input: AnalyzeInput): string | undefined => {
  const value = imageHashInput(input);
  return value ? createHash("sha256").update(value).digest("hex") : undefined;
};

const imageAnalysisCacheKey = (hash: string, input: AnalyzeInput): string =>
  `visual-analysis:${input.modelVersion ?? "default"}:${input.includeEmbedding === false ? "attrs" : "embedding"}:${hash}`;

const visualEmbeddingCacheKey = (hash: string): string =>
  `visual-embedding:${visualEmbeddingModel}:${hash}`;

const candidateVisualEmbeddingCacheKey = (source: string, id: string, imageUrl: string): string =>
  `visual-embedding:candidate:${visualEmbeddingModel}:${source}:${id}:${createHash("sha256").update(imageUrl).digest("hex")}`;

const marketplaceSearchCacheKey = (source: string, query: string, limit: number, filters: ProductSearchFilters, marketplaceId?: string): string =>
  `marketplace-search:${source}:${createHash("sha256")
    .update(JSON.stringify({ query, limit, filters, marketplaceId }))
    .digest("hex")}`;

const cachedImageAnalysis = (value: string | null): ImageAnalysis | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<ImageAnalysis>;
    if (typeof parsed.containsWatch !== "boolean" || typeof parsed.modelVersion !== "string") {
      return null;
    }
    const analysis: ImageAnalysis = {
      containsWatch: parsed.containsWatch,
      visualAttributes:
        typeof parsed.visualAttributes === "object" && parsed.visualAttributes !== null && !Array.isArray(parsed.visualAttributes)
          ? Object.fromEntries(Object.entries(parsed.visualAttributes).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
          : {},
      embedding: Array.isArray(parsed.embedding) ? parsed.embedding.filter((item): item is number => typeof item === "number") : [],
      modelVersion: parsed.modelVersion
    };
    if (typeof parsed.generatedTitle === "string") {
      analysis.generatedTitle = parsed.generatedTitle;
    }
    if (typeof parsed.probableBrand === "string") {
      analysis.probableBrand = parsed.probableBrand;
    }
    if (typeof parsed.probableModel === "string") {
      analysis.probableModel = parsed.probableModel;
    }
    if (typeof parsed.probableReferenceNumber === "string") {
      analysis.probableReferenceNumber = parsed.probableReferenceNumber;
    }
    return analysis;
  } catch {
    return null;
  }
};

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

const normalizeVector = (values: number[]): number[] => {
  const magnitude = Math.sqrt(values.reduce((total, value) => total + value * value, 0));
  return magnitude > 0 ? values.map((value) => Number((value / magnitude).toFixed(6))) : values;
};

const visualEmbeddingFromBuffer = async (buffer: Buffer): Promise<number[]> => {
  const image = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const resized = await image
    .clone()
    .resize({ width: 16, height: 16, fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const values: number[] = [];
  const histogram = Array.from({ length: 24 }, () => 0);
  for (let index = 0; index < resized.length; index += 3) {
    const red = resized[index] ?? 0;
    const green = resized[index + 1] ?? 0;
    const blue = resized[index + 2] ?? 0;
    values.push((red - 127.5) / 127.5, (green - 127.5) / 127.5, (blue - 127.5) / 127.5);
    const redBin = Math.min(7, Math.floor(red / 32));
    const greenBin = 8 + Math.min(7, Math.floor(green / 32));
    const blueBin = 16 + Math.min(7, Math.floor(blue / 32));
    histogram[redBin] = (histogram[redBin] ?? 0) + 1;
    histogram[greenBin] = (histogram[greenBin] ?? 0) + 1;
    histogram[blueBin] = (histogram[blueBin] ?? 0) + 1;
  }
  const pixelCount = Math.max(1, resized.length / 3);
  values.push(...histogram.map((count) => count / pixelCount));
  values.push((metadata.width ?? 1) / Math.max(metadata.height ?? 1, 1));
  return normalizeVector(values);
};

const cachedVisualEmbedding = (value: string | null): Omit<VisualEmbeddingResult, "cacheHit"> | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<VisualEmbeddingResult>;
    const embedding = Array.isArray(parsed.embedding)
      ? parsed.embedding.filter((item): item is number => typeof item === "number")
      : [];
    if (embedding.length === 0 || parsed.model !== visualEmbeddingModel) {
      return null;
    }
    return {
      embedding,
      model: visualEmbeddingModel,
      ...(typeof parsed.imageHash === "string" ? { imageHash: parsed.imageHash } : {})
    };
  } catch {
    return null;
  }
};

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
const weakSearchTerms = new Set(["watch", "watches", "luxury", "men", "mens", "women", "womens"]);
const genericBrandValues = new Set(["unbranded", "generic", "unknown", "not specified", "does not apply", "na", "n/a"]);
const watchCategoryTerms = ["watch", "wristwatch", "timepiece", "chronograph", "automatic", "quartz"];
const accessoryOnlyTerms = ["strap", "band", "box", "manual", "booklet", "parts", "movement", "caseback", "dial only"];

const significantQueryTerms = (query: string): string[] =>
  uniqueTerms(queryTerms(query)).filter((term) => !weakSearchTerms.has(term));

const priorityTermsFromText = (value: string | null | undefined): string[] =>
  (value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !weakSearchTerms.has(term));

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

const priorityText = (input: {
  title: string | null;
  brand?: string | null;
  model?: string | null;
  referenceNumber?: string | null;
  condition?: string | null;
  description?: string | null;
  aspects?: Record<string, string>;
}): string =>
  normalizedText(
    input.title,
    input.brand,
    input.model,
    input.referenceNumber,
    input.condition,
    input.description,
    ...(input.aspects ? Object.entries(input.aspects).flatMap(([name, value]) => [name, value]) : [])
  );

const hasLooseToken = (haystack: string, needle: string | null | undefined): boolean =>
  Boolean(needle?.trim()) && haystack.includes(normalizedLooseText(needle));

const hasExplicitBrandMismatch = (brand: string | null | undefined, expectedBrand: string | undefined): boolean => {
  const actual = normalizedLooseText(brand);
  const expected = normalizedLooseText(expectedBrand);
  return Boolean(actual && expected && !genericBrandValues.has(actual) && !actual.includes(expected) && !expected.includes(actual));
};

const imagePriorityScore = (
  input: {
    title: string | null;
    brand?: string | null;
    model?: string | null;
    referenceNumber?: string | null;
    condition?: string | null;
    description?: string | null;
    aspects?: Record<string, string>;
  },
  signals?: SearchPrioritySignals
): { score: number; reasons: string[]; rejected: boolean } => {
  if (!signals) {
    return { score: 0, reasons: [], rejected: false };
  }
  if (hasExplicitBrandMismatch(input.brand, signals.brand)) {
    return { score: 0, reasons: ["brand:mismatch"], rejected: true };
  }

  const haystack = priorityText(input);
  let score = 0;
  const reasons: string[] = [];
  if (signals.containsWatch) {
    if (watchCategoryTerms.some((term) => haystack.includes(term))) {
      score += 60;
      reasons.push("priority:category");
    }
    if (accessoryOnlyTerms.some((term) => haystack.includes(term)) && !haystack.includes("watch")) {
      score -= 40;
      reasons.push("priority:accessory-penalty");
    }
  }
  if (hasLooseToken(haystack, signals.brand)) {
    score += 90;
    reasons.push("priority:brand");
  }
  if (hasLooseToken(haystack, signals.model)) {
    score += 55;
    reasons.push("priority:model");
  }
  if (hasLooseToken(haystack, signals.referenceNumber)) {
    score += 120;
    reasons.push("priority:reference");
  }
  for (const term of signals.visualTerms) {
    if (haystack.includes(term)) {
      score += 18;
      reasons.push(`priority:visual:${term}`);
    }
  }
  return { score, reasons: uniqueTerms(reasons), rejected: false };
};

const boundedScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const cosineSimilarity = (left: number[], right: number[]): number | null => {
  if (left.length === 0 || left.length !== right.length) {
    return null;
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return null;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

const embeddingSimilarityScore = (left: number[], right: number[]): number | null => {
  const similarity = cosineSimilarity(left, right);
  return similarity === null ? null : boundedScore(similarity * 100);
};

const compactCandidateImageAnalysis = (analysis: ImageAnalysis | undefined): VisualSearchMatch["candidateImageAnalysis"] =>
  analysis
    ? {
        containsWatch: analysis.containsWatch,
        generatedTitle: analysis.generatedTitle ?? null,
        probableBrand: analysis.probableBrand ?? null,
        probableModel: analysis.probableModel ?? null,
        probableReferenceNumber: analysis.probableReferenceNumber ?? null,
        visualAttributes: analysis.visualAttributes,
        modelVersion: analysis.modelVersion
      }
    : null;

const visualAttributeValue = (analysis: ImageAnalysis, keys: string[]): string | null => {
  const normalizedKeys = new Set(keys.map(normalizedLooseText));
  for (const [key, value] of Object.entries(analysis.visualAttributes)) {
    if (normalizedKeys.has(normalizedLooseText(key)) && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const visualSearchQueries = (input: SearchInput, analysis: ImageAnalysis, filters: ProductSearchFilters): string[] => {
  const explicit = compactSearchPart(input.q ?? input.keyword ?? input.query ?? input.search);
  const userBrand = compactSearchPart(filters.brand);
  const userModel = compactSearchPart(filters.model);
  const userReference = compactSearchPart(input.referenceNumber);
  const aiBrand = userBrand ? null : compactSearchPart(analysis.probableBrand);
  const aiModel = userModel ? null : compactSearchPart(analysis.probableModel);
  const aiReference = userReference ? null : compactSearchPart(analysis.probableReferenceNumber);
  const brand = userBrand ?? aiBrand;
  const model = userModel ?? aiModel;
  const referenceNumber = userReference ?? aiReference;
  const dialColor = visualAttributeValue(analysis, ["dialColor", "dial", "color"]);
  const movement = visualAttributeValue(analysis, ["movement"]);
  const caseShape = visualAttributeValue(analysis, ["case", "caseShape", "shape"]);
  const bezel = visualAttributeValue(analysis, ["bezel"]);
  const bracelet = visualAttributeValue(analysis, ["bracelet", "strap", "band"]);
  const visualTerms = uniqueTerms(
    [dialColor, movement, caseShape, bezel, bracelet]
      .flatMap((value) => priorityTermsFromText(value))
      .filter((term) => !watchCategoryTerms.includes(term))
  ).slice(0, 4);

  return uniqueSearchQueries([
    searchQueryFromParts(explicit, userBrand, userModel, userReference),
    searchQueryFromParts(userBrand, userModel, userReference),
    searchQueryFromParts(brand, model, referenceNumber),
    searchQueryFromParts(brand, model, dialColor, "watch"),
    searchQueryFromParts(brand, movement, dialColor, "watch"),
    searchQueryFromParts(brand, ...visualTerms, "watch"),
    searchQueryFromParts(brand, "watch"),
    searchQueryFromParts(model, dialColor, "watch"),
    searchQueryFromParts(explicit, "watch"),
    searchQueryFromParts(dialColor, caseShape, "watch"),
    "watch"
  ]).slice(0, 8);
};

const visualTermsForKeys = (analysis: ImageAnalysis, keys: string[]): string[] =>
  uniqueTerms(keys.flatMap((key) => priorityTermsFromText(visualAttributeValue(analysis, [key]))));

const visualTermScore = (haystack: string, terms: string[], reasonPrefix: string): { score: number; matchedOn: string[] } => {
  if (terms.length === 0) {
    return { score: 0, matchedOn: [] };
  }
  const matched = terms.filter((term) => haystack.includes(term));
  return {
    score: matched.length / terms.length,
    matchedOn: matched.map((term) => `${reasonPrefix}:${term}`)
  };
};

const visualSignalScores = (
  item: RankedSearchItem,
  input: SearchInput,
  analysis: ImageAnalysis
): VisualSignalScores => {
  const aspects = "aspects" in item && typeof item.aspects === "object" && item.aspects !== null
    ? item.aspects as Record<string, string>
    : undefined;
  const priorityInput: Parameters<typeof priorityText>[0] = {
    title: item.title,
    brand: item.brand,
    model: item.model,
    referenceNumber: item.referenceNumber,
    condition: item.condition,
    description: item.description
  };
  if (aspects) {
    priorityInput.aspects = aspects;
  }
  const haystack = priorityText(priorityInput);
  const matchedOn: string[] = [];
  const brandExpected = compactSearchPart(input.brand) ?? compactSearchPart(analysis.probableBrand);
  const modelExpected = compactSearchPart(input.model) ?? compactSearchPart(analysis.probableModel);
  const referenceExpected = compactSearchPart(input.referenceNumber) ?? compactSearchPart(analysis.probableReferenceNumber);
  const brand = hasLooseToken(haystack, brandExpected) ? 1 : 0;
  const modelMatches = [modelExpected, referenceExpected].filter((value): value is string => Boolean(value));
  const model = modelMatches.length === 0
    ? 0
    : modelMatches.filter((value) => hasLooseToken(haystack, value)).length / modelMatches.length;
  if (brand > 0) {
    matchedOn.push(`brand:${brandExpected}`);
  }
  if (model > 0) {
    matchedOn.push(...modelMatches.filter((value) => hasLooseToken(haystack, value)).map((value) => `model:${value}`));
  }

  const dial = visualTermScore(haystack, visualTermsForKeys(analysis, ["dial", "dialColor", "color", "markers", "indices"]), "dial");
  const caseBezel = visualTermScore(haystack, visualTermsForKeys(analysis, ["case", "caseShape", "shape", "bezel", "material"]), "case");
  const strap = visualTermScore(haystack, visualTermsForKeys(analysis, ["bracelet", "strap", "band"]), "strap");
  matchedOn.push(...dial.matchedOn, ...caseBezel.matchedOn, ...strap.matchedOn);

  return {
    brand,
    model,
    dialFeatures: dial.score,
    caseBezel: caseBezel.score,
    strap: strap.score,
    text: Math.max(0, Math.min(1, item.similarityScore / 100)),
    matchedOn: uniqueTerms(matchedOn)
  };
};

const visualMetadataSimilarity = (scores: VisualSignalScores): number => {
  const nonVisualWeight =
    visualSearchWeights.brand +
    visualSearchWeights.model +
    visualSearchWeights.dialFeatures +
    visualSearchWeights.caseBezel +
    visualSearchWeights.strap +
    visualSearchWeights.text;
  return boundedScore(
    ((scores.brand * visualSearchWeights.brand) +
      (scores.model * visualSearchWeights.model) +
      (scores.dialFeatures * visualSearchWeights.dialFeatures) +
      (scores.caseBezel * visualSearchWeights.caseBezel) +
      (scores.strap * visualSearchWeights.strap) +
      (scores.text * visualSearchWeights.text)) / nonVisualWeight * 100
  );
};

const visualMatchScore = (visualSimilarity: number | null, scores: VisualSignalScores): number =>
  boundedScore(
    ((visualSimilarity ?? 0) / 100) * visualSearchWeights.visualSimilarity * 100 +
    scores.brand * visualSearchWeights.brand * 100 +
    scores.model * visualSearchWeights.model * 100 +
    scores.dialFeatures * visualSearchWeights.dialFeatures * 100 +
    scores.caseBezel * visualSearchWeights.caseBezel * 100 +
    scores.strap * visualSearchWeights.strap * 100 +
    scores.text * visualSearchWeights.text * 100
  );

const visualMatchLevel = (score: number): VisualMatchLevel => {
  if (score >= 90) {
    return "very_high";
  }
  if (score >= 75) {
    return "high";
  }
  if (score >= 45) {
    return "possible";
  }
  return "low";
};

const rankedVisualCandidateItems = (
  query: string,
  local: LocalSearchItem[],
  ebay: EbaySearchItem[],
  limit: number
): RankedSearchItem[] =>
  [
    ...local.map((item) => rankedLocalItem(item, uniqueTerms(queryTerms(query)))),
    ...ebay.map((item, index) => rankedEbayItem(item, uniqueTerms(queryTerms(query)), index))
  ]
    .sort((left, right) => right.similarityScore - left.similarityScore || Number(Boolean(right.image)) - Number(Boolean(left.image)))
    .slice(0, limit);

const directSearchItem = (
  item: RankedSearchItem,
  matchType: DirectSearchItem["matchType"],
  visualSimilarity: number | null = null
): DirectSearchItem => ({
  source: item.source,
  marketplace: item.source,
  id: item.id,
  externalId: item.externalId,
  title: item.title,
  brand: item.brand,
  model: item.model,
  referenceNumber: item.referenceNumber,
  price: item.price,
  currency: item.currency,
  condition: item.condition,
  image: item.image,
  sourceUrl: item.sourceUrl ?? (item.source === "local" ? localProductUrl(item.id) : null),
  originalUrl: item.sourceUrl ?? (item.source === "local" ? localProductUrl(item.id) : null),
  matchScore: item.similarityScore,
  matchType,
  visualSimilarity,
  matchReasons: item.matchReasons
});

const imageQualityCheck = (input: AnalyzeInput, analysis: ImageAnalysis): ImageQualityCheck => {
  const hasImage = Boolean(input.file || input.imageUrl);
  const acceptedMimeType = input.file ? Boolean(imageExtensionByMimeType[input.file.mimetype]) : true;
  const nonEmptyFile = input.file ? input.file.size > 0 && input.file.buffer.length > 0 : null;
  const warnings: string[] = [];
  if (!analysis.containsWatch) {
    warnings.push("AI image analysis did not confidently detect a watch.");
  }
  if (input.file && input.file.size < 2 * 1024) {
    warnings.push("Uploaded image is very small; visual matching confidence may be lower.");
  }
  return {
    passed: hasImage && acceptedMimeType && nonEmptyFile !== false && analysis.containsWatch,
    warnings,
    checks: {
      hasImage,
      acceptedMimeType,
      nonEmptyFile,
      containsWatch: analysis.containsWatch
    }
  };
};

const matchedTermsFromReasons = (reasons: string[]): Set<string> =>
  new Set(reasons.map((reason) => reason.split(":")[1]).filter((term): term is string => Boolean(term)));

const isReferenceLikeTerm = (term: string): boolean => term.length >= 4 && /\d/.test(term);

const strongEnoughSearchMatch = (item: InternalRankedSearchItem, significantTerms: string[]): boolean => {
  if (significantTerms.length === 0) {
    return item.rawScore > 0;
  }
  const matchedTerms = matchedTermsFromReasons(item.matchReasons);
  const matchedCount = significantTerms.filter((term) => matchedTerms.has(term)).length;
  if (significantTerms.some((term) => isReferenceLikeTerm(term) && matchedTerms.has(term))) {
    return true;
  }
  const requiredMatches = significantTerms.length >= 3 ? 2 : 1;
  return matchedCount >= requiredMatches;
};

const rankedLocalItem = (item: LocalSearchItem, terms: string[], signals?: SearchPrioritySignals): InternalRankedSearchItem => {
  const match = textMatchScore({
    title: item.title,
    brand: item.brand,
    model: item.model,
    referenceNumber: item.referenceNumber,
    condition: item.condition,
    description: item.description,
    terms
  });
  const priority = imagePriorityScore(item, signals);
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
    matchReasons: [...match.reasons, ...priority.reasons],
    rawScore,
    priorityScore: priority.rejected ? Number.NEGATIVE_INFINITY : priority.score
  };
};

const rankedEbayItem = (item: EbaySearchItem, terms: string[], index: number, signals?: SearchPrioritySignals): InternalRankedSearchItem => {
  const match = textMatchScore({
    title: item.title,
    condition: item.condition ?? null,
    description: item.description ?? null,
    terms
  });
  const priority = imagePriorityScore(item, signals);
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
    ...(item.aspects ? { aspects: item.aspects } : {}),
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
    matchReasons: [...match.reasons, ...priority.reasons],
    rawScore,
    priorityScore: priority.rejected ? Number.NEGATIVE_INFINITY : priority.score
  };
};

const rankedSearchItems = (
  query: string,
  local: LocalSearchItem[],
  ebay: EbaySearchItem[],
  limit: number,
  signals?: SearchPrioritySignals
): RankedSearchItem[] => {
  const terms = uniqueTerms(queryTerms(query));
  const significantTerms = significantQueryTerms(query);
  return [
    ...local.map((item) => rankedLocalItem(item, terms, signals)),
    ...ebay.map((item, index) => rankedEbayItem(item, terms, index, signals))
  ]
    .filter((item) => item.priorityScore > Number.NEGATIVE_INFINITY && strongEnoughSearchMatch(item, significantTerms))
    .sort((left, right) => right.priorityScore - left.priorityScore || right.similarityScore - left.similarityScore || right.rawScore - left.rawScore)
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

const withoutSimilarProducts = (item: ProductDetails): Omit<ProductDetails, "similarProducts"> => {
  const { similarProducts: _similarProducts, ...product } = item;
  return product;
};

const withoutSimilarProductLists = (items: ProductDetails[]): Array<Omit<ProductDetails, "similarProducts">> =>
  items.map(withoutSimilarProducts);

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
  listingVolumeAmount: number,
  options: { inferMissingDetails?: boolean } = {}
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
  const guesses = options.inferMissingDetails === false
    ? Array.from(fallbacks.values())
    : await withTimeout(
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

const imageSearchPriorityFromAnalysis = (analysis: ImageAnalysis): SearchPrioritySignals => {
  const brand = compactSearchPart(analysis.probableBrand);
  const model = compactSearchPart(analysis.probableModel);
  const referenceNumber = compactSearchPart(analysis.probableReferenceNumber);
  const signals: SearchPrioritySignals = {
    containsWatch: analysis.containsWatch,
    visualTerms: uniqueTerms(
      Object.values(analysis.visualAttributes)
        .flatMap((value) => priorityTermsFromText(value))
        .filter((term) => term.length > 2)
    )
  };
  if (brand) {
    signals.brand = brand;
  }
  if (model) {
    signals.model = model;
  }
  if (referenceNumber) {
    signals.referenceNumber = referenceNumber;
  }
  return signals;
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
  if (item.aspects) {
    output.aspects = item.aspects;
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

  public constructor(private readonly dependencies: AiServiceDependencies = {}) {}

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

  private async getCachedImageAnalysis(input: AnalyzeInput): Promise<ImageAnalysisCacheLookup> {
    const hash = imageHash(input);
    const cacheKey = hash ? imageAnalysisCacheKey(hash, input) : undefined;
    if (!cacheKey || !this.dependencies.redis) {
      return { cacheHit: false, ...(hash ? { imageHash: hash } : {}) };
    }
    const analysis = cachedImageAnalysis(await this.dependencies.redis.get(cacheKey).catch(() => null));
    return {
      cacheHit: Boolean(analysis),
      ...(analysis ? { analysis } : {}),
      ...(hash ? { imageHash: hash } : {}),
      cacheKey
    };
  }

  private async writeCachedImageAnalysis(cacheKey: string | undefined, analysis: ImageAnalysis): Promise<void> {
    if (!cacheKey || !this.dependencies.redis) {
      return;
    }
    await this.dependencies.redis
      .set(cacheKey, JSON.stringify(analysis), "EX", visualAnalysisCacheTtlSeconds)
      .catch(() => undefined);
  }

  private async visualEmbeddingFromBufferWithCache(
    buffer: Buffer,
    cacheKey: string | undefined,
    hash: string | undefined
  ): Promise<VisualEmbeddingResult> {
    if (cacheKey && this.dependencies.redis) {
      const cached = cachedVisualEmbedding(await this.dependencies.redis.get(cacheKey).catch(() => null));
      if (cached) {
        return {
          ...cached,
          cacheHit: true
        };
      }
    }
    const embedding = await visualEmbeddingFromBuffer(buffer);
    const result: VisualEmbeddingResult = {
      embedding,
      cacheHit: false,
      model: visualEmbeddingModel
    };
    if (hash) {
      result.imageHash = hash;
    }
    if (cacheKey && this.dependencies.redis) {
      await this.dependencies.redis
        .set(cacheKey, JSON.stringify(result), "EX", visualEmbeddingCacheTtlSeconds)
        .catch(() => undefined);
    }
    return result;
  }

  private async createQueryVisualEmbedding(input: AnalyzeInput): Promise<VisualEmbeddingResult> {
    if (input.file) {
      const hash = imageHash(input);
      return this.visualEmbeddingFromBufferWithCache(input.file.buffer, hash ? visualEmbeddingCacheKey(hash) : undefined, hash);
    }
    if (!input.imageUrl) {
      throw new ConflictError("Provide an image file or imageUrl.");
    }
    const buffer = await this.fetchImageBuffer(input.imageUrl);
    const hash = createHash("sha256").update(buffer).digest("hex");
    return this.visualEmbeddingFromBufferWithCache(buffer, visualEmbeddingCacheKey(hash), hash);
  }

  private async fetchImageBuffer(imageUrl: string): Promise<Buffer> {
    const response = await withTimeout(
      fetch(imageUrl),
      Math.min(getAiConfig().analysisTimeoutMs, 8_000),
      "Candidate image fetch timed out."
    );
    if (!response.ok) {
      throw new ExternalServiceError(`Candidate image fetch failed with status ${response.status}.`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async createCandidateVisualEmbeddings(
    items: RankedSearchItem[],
    timer: ReturnType<typeof createImageSearchTimer>,
    limit: number
  ): Promise<{ embeddings: Map<string, CandidateVisualEmbedding>; analyzedCandidateImages: number; cacheHits: number }> {
    if (limit <= 0) {
      return { embeddings: new Map(), analyzedCandidateImages: 0, cacheHits: 0 };
    }
    const candidates = items
      .filter((item) => typeof item.image === "string" && /^https?:\/\//i.test(item.image))
      .slice(0, limit);
    const results = await Promise.allSettled(
      candidates.map(async (item): Promise<CandidateVisualEmbedding | null> => {
        const imageUrl = item.image;
        if (!imageUrl) {
          return null;
        }
        const key = productKey(item);
        const cacheKey = candidateVisualEmbeddingCacheKey(item.source, item.id, imageUrl);
        if (this.dependencies.redis) {
          const cached = cachedVisualEmbedding(await this.dependencies.redis.get(cacheKey).catch(() => null));
          if (cached) {
            return {
              key,
              embedding: cached.embedding,
              ...(cached.imageHash ? { imageHash: cached.imageHash } : {}),
              cacheHit: true,
              model: cached.model
            };
          }
        }
        const buffer = await timer.measure("candidate-image-fetch", () => this.fetchImageBuffer(imageUrl));
        const hash = createHash("sha256").update(buffer).digest("hex");
        const embedding = await timer.measure("candidate-image-embedding", () => visualEmbeddingFromBuffer(buffer));
        const result: CandidateVisualEmbedding = {
          key,
          embedding,
          imageHash: hash,
          cacheHit: false,
          model: visualEmbeddingModel
        };
        if (this.dependencies.redis) {
          await this.dependencies.redis
            .set(cacheKey, JSON.stringify(result), "EX", visualEmbeddingCacheTtlSeconds)
            .catch(() => undefined);
        }
        return result;
      })
    );
    const successful = results
      .filter((result): result is PromiseFulfilledResult<CandidateVisualEmbedding | null> => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((result): result is CandidateVisualEmbedding => Boolean(result));
    return {
      embeddings: new Map(successful.map((result) => [result.key, result])),
      analyzedCandidateImages: successful.length,
      cacheHits: successful.filter((result) => result.cacheHit).length
    };
  }

  private async searchLocalVisualQuery(
    query: string,
    limit: number,
    filters: ProductSearchFilters
  ): Promise<{ items: LocalSearchItem[]; cacheHit: boolean }> {
    const cacheKey = marketplaceSearchCacheKey("local", query, limit, filters);
    if (this.dependencies.redis) {
      const cached = await this.dependencies.redis.get(cacheKey).catch(() => null);
      if (cached) {
        try {
          return { items: JSON.parse(cached) as LocalSearchItem[], cacheHit: true };
        } catch {
          // Ignore malformed cache values and refresh from the database.
        }
      }
    }
    const items = await this.searchLocalListings(query, limit, filters);
    if (this.dependencies.redis) {
      await this.dependencies.redis
        .set(cacheKey, JSON.stringify(items), "EX", marketplaceSearchCacheTtlSeconds)
        .catch(() => undefined);
    }
    return { items, cacheHit: false };
  }

  private async searchEbayVisualQuery(
    query: string,
    limit: number,
    marketplaceId: string | undefined,
    filters: ProductSearchFilters
  ): Promise<EbayListingsSearchResult & { cacheHit: boolean }> {
    const cacheKey = marketplaceSearchCacheKey("ebay", query, limit, filters, marketplaceId);
    if (this.dependencies.redis) {
      const cached = await this.dependencies.redis.get(cacheKey).catch(() => null);
      if (cached) {
        try {
          return { ...(JSON.parse(cached) as EbayListingsSearchResult), cacheHit: true };
        } catch {
          // Ignore malformed cache values and refresh from eBay.
        }
      }
    }
    const result = await this.searchEbayListings(query, limit, marketplaceId, {
      normalization: {
        query,
        source: "fallback",
        confidence: null,
        detectedBrand: null,
        detectedModel: null,
        reasoning: "Built programmatically from user filters and image visual attributes."
      },
      queries: [query]
    }, filters);
    if (this.dependencies.redis) {
      await this.dependencies.redis
        .set(cacheKey, JSON.stringify(result), "EX", marketplaceSearchCacheTtlSeconds)
        .catch(() => undefined);
    }
    return { ...result, cacheHit: false };
  }

  private async searchVisualMarketplaceCandidates(
    queries: string[],
    candidateLimit: number,
    filters: ProductSearchFilters,
    marketplaceId: string | undefined,
    timer: ReturnType<typeof createImageSearchTimer>
  ): Promise<VisualMarketplaceSearchResult> {
    const localTask = timer.measure("marketplace-search", async () => {
      const byId = new Map<string, LocalSearchItem>();
      const usedQueries: string[] = [];
      let cacheHits = 0;
      for (const query of queries) {
        if (byId.size >= candidateLimit) {
          break;
        }
        const result = await this.searchLocalVisualQuery(query, candidateLimit, filters);
        usedQueries.push(query);
        if (result.cacheHit) {
          cacheHits += 1;
        }
        for (const item of result.items) {
          byId.set(item.id, item);
        }
      }
      return {
        items: Array.from(byId.values()).slice(0, candidateLimit),
        queries: usedQueries,
        cacheHits
      };
    });
    const ebayTask = timer.measure("marketplace-search", async () => {
      const byId = new Map<string, EbaySearchItem>();
      const usedQueries: string[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      let total: number | null = null;
      let environment: "sandbox" | "production" = getMarketplaceConfig().ebay.environment;
      let resolvedMarketplaceId = marketplaceId ?? getMarketplaceConfig().ebay.marketplaceId;
      let selectedQuery = queries[0] ?? "watch";
      let cacheHits = 0;
      for (const query of queries) {
        if (byId.size >= candidateLimit) {
          break;
        }
        const remaining = Math.max(candidateLimit - byId.size, 1);
        const result = await this.searchEbayVisualQuery(query, remaining, marketplaceId, filters);
        usedQueries.push(query);
        selectedQuery = result.query;
        total = Math.max(total ?? 0, result.total ?? 0);
        environment = result.environment;
        resolvedMarketplaceId = result.marketplaceId;
        warnings.push(...result.warnings);
        if (result.error) {
          errors.push(result.error);
        }
        if (result.cacheHit) {
          cacheHits += 1;
        }
        for (const item of result.items) {
          byId.set(item.externalId, item);
        }
      }
      const query = selectedQuery;
      const queryNormalization: MarketplaceQueryNormalization = {
        query,
        source: "fallback",
        confidence: null,
        detectedBrand: filters.brand ?? null,
        detectedModel: filters.model ?? null,
        reasoning: "Built programmatically from user filters and image visual attributes."
      };
      const ebay: EbayListingsSearchResult = {
        items: Array.from(byId.values()).slice(0, candidateLimit),
        query,
        queryNormalization,
        environment,
        marketplaceId: resolvedMarketplaceId,
        total,
        attemptedQueries: usedQueries,
        warnings: uniqueTerms(warnings),
        ...(errors.length > 0 ? { error: uniqueTerms(errors).join(" ") } : {})
      };
      return { ebay, queries: usedQueries, cacheHits };
    });

    const [localResult, ebayResult] = await Promise.allSettled([localTask, ebayTask]);
    const local = localResult.status === "fulfilled" ? localResult.value : { items: [], queries, cacheHits: 0 };
    const ebay = ebayResult.status === "fulfilled"
      ? ebayResult.value
      : {
          ebay: {
            items: [],
            query: queries[0] ?? "watch",
            queryNormalization: {
              query: queries[0] ?? "watch",
              source: "fallback" as const,
              confidence: null,
              detectedBrand: filters.brand ?? null,
              detectedModel: filters.model ?? null,
              reasoning: "eBay search failed."
            },
            environment: getMarketplaceConfig().ebay.environment,
            marketplaceId: marketplaceId ?? getMarketplaceConfig().ebay.marketplaceId,
            total: null,
            attemptedQueries: queries,
            warnings: [],
            error: appErrorMessage(ebayResult.reason, "eBay search failed.")
          },
          queries,
          cacheHits: 0
        };
    return {
      local: local.items,
      ebay: ebay.ebay,
      localQueries: local.queries,
      ebayQueries: ebay.queries,
      localCacheHits: local.cacheHits,
      ebayCacheHits: ebay.cacheHits
    };
  }

  public async createSearch(actor: Actor, input: SearchInput) {
    return this.createSearchResult(actor, input, { inferProductDetails: true });
  }

  public async createProductSearch(actor: Actor, input: SearchInput) {
    return this.createSearchResult(actor, input, { inferProductDetails: false });
  }

  public async createEbayDirectSearch(input: SearchInput) {
    const timer = createImageSearchTimer("ebay-direct");
    const filters = searchFilters(input);
    const explicitText = (input.q ?? input.keyword ?? input.query ?? input.search)?.trim();
    const hasImage = Boolean(input.file || input.imageUrl);
    if (!hasImage && !explicitText && !hasFilters(filters)) {
      throw new ConflictError("Provide a keyword, filter, or an image file.");
    }

    try {
      let query: string;
      let ebayResult: EbayListingsSearchResult;
      let localItems: DirectSearchItem[] = [];
      let ebayDetailEnriched = 0;
      let ebayDetailEnrichmentFailed = 0;

      if (hasImage) {
        timer.measureSync("image-read", () => undefined);
        const optimizedInput = await timer.measure("sharp-resize", () => imagePreprocessInput(input));
        const imageBuffer = optimizedInput.file?.buffer ?? await timer.measure("candidate-image-fetch", async () => {
          if (!optimizedInput.imageUrl) {
            throw new ConflictError("Provide an image file or imageUrl.");
          }
          return this.fetchImageBuffer(optimizedInput.imageUrl);
        });
        const base64Image = imageBuffer.toString("base64");
        query = explicitText ? searchQueryFromParts(explicitText, filters.brand, filters.model, input.referenceNumber) : "image";
        const candidateImageLimit = input.candidateImageLimit ?? Math.min(30, Math.max(input.limit * 3, input.limit));
        const [ebaySettled, queryEmbeddingSettled, localCandidatesSettled] = await Promise.allSettled([
          timer.measure("marketplace-search", () =>
            this.searchEbayImageListings(base64Image, input.limit, input.marketplaceId, filters)
          ),
          timer.measure("query-image-embedding", () => this.createQueryVisualEmbedding(optimizedInput)),
          timer.measure("marketplace-search", () => this.searchLocalCandidateListings(Math.max(100, input.limit * 5), filters))
        ]);
        ebayResult = ebaySettled.status === "fulfilled"
          ? ebaySettled.value
          : {
              query: "image",
              queryNormalization: {
                query: "image",
                source: "fallback",
                confidence: null,
                detectedBrand: null,
                detectedModel: null,
                reasoning: appErrorMessage(ebaySettled.reason, "eBay image search failed.")
              },
              items: [],
              environment: getMarketplaceConfig().ebay.environment,
              marketplaceId: input.marketplaceId ?? getMarketplaceConfig().ebay.marketplaceId,
              total: null,
              attemptedQueries: ["search_by_image"],
              warnings: [],
              error: appErrorMessage(ebaySettled.reason, "eBay image search failed.")
            };
        if (queryEmbeddingSettled.status === "fulfilled" && localCandidatesSettled.status === "fulfilled") {
          localItems = await this.localImageDirectMatches(
            queryEmbeddingSettled.value,
            localCandidatesSettled.value,
            timer,
            input.limit,
            candidateImageLimit
          );
        }
      } else {
        query = searchQueryFromParts(explicitText, filters.brand, filters.model, input.referenceNumber);
        const searchPlan: EbaySearchPlan = {
          normalization: {
            query,
            source: "fallback",
            confidence: null,
            detectedBrand: filters.brand ?? null,
            detectedModel: filters.model ?? null,
            reasoning: "Direct user query sent to eBay without AI normalization."
          },
          queries: [query]
        };
        const [localResult, ebaySearchResult] = await Promise.all([
          timer.measure("marketplace-search", () => this.searchLocalListings(query, input.limit, filters)),
          timer.measure("marketplace-search", () =>
            this.searchEbayListings(query, input.limit, input.marketplaceId, searchPlan, filters)
          )
        ]);
        ebayResult = ebaySearchResult;
        localItems = rankedSearchItems(query, localResult, [], input.limit).map((item) => directSearchItem(item, "text"));
      }
      const ebayDetailResult = await timer.measure("marketplace-search", () =>
        this.enrichEbayListingsWithDetails(ebayResult.items, input.marketplaceId ?? ebayResult.marketplaceId, input.limit)
      );
      ebayResult = {
        ...ebayResult,
        items: ebayDetailResult.items
      };
      ebayDetailEnriched = ebayDetailResult.enrichedCount;
      ebayDetailEnrichmentFailed = ebayDetailResult.failedCount;
      const ebayItems = hasImage
        ? ebayResult.items
            .map((item, index) => directSearchItem(rankedEbayItem(item, [], index), "image"))
            .slice(0, input.limit)
        : rankedSearchItems(query, [], ebayResult.items, input.limit).map((item) => directSearchItem(item, "text"));
      const mergedItems = [...localItems, ...ebayItems]
        .sort((left, right) => right.matchScore - left.matchScore)
        .slice(0, input.limit);

      return {
        mode: hasImage ? "image" : "text",
        flow: hasImage
          ? "Image -> eBay search_by_image + internal visual match"
          : "User query -> eBay directly + internal products",
        query,
        imageAnalysis: null,
        results: {
          items: mergedItems,
          local: localItems,
          ebay: ebayItems,
          count: mergedItems.length
        },
        metadata: {
          provider: "ebay",
          internalProductsMerged: true,
          localCandidates: localItems.length,
          ebayCandidates: ebayItems.length,
          ebayDetailEnriched,
          ebayDetailEnrichmentFailed,
          textSearchDirectToEbay: !hasImage,
          imageSearchUsesOpenAiIdentification: false,
          imageSearchUsesEbayImageSearch: hasImage,
          marketplaceId: ebayResult.marketplaceId,
          environment: ebayResult.environment,
          total: ebayResult.total,
          attemptedQueries: ebayResult.attemptedQueries,
          warnings: ebayResult.warnings,
          queryNormalization: ebayResult.queryNormalization
        },
        warnings: ebayResult.warnings,
        ...(ebayResult.error ? { errors: { ebay: ebayResult.error } } : {})
      };
    } finally {
      timer.endAll();
    }
  }

  public async createVisualImageSearch(actor: Actor, input: SearchInput) {
    if (!input.file && !input.imageUrl) {
      const keywordResult = await this.createSearchResult(actor, input, { inferProductDetails: false });
      const items: VisualSearchMatch[] = keywordResult.results.items.map((item) => ({
        ...item,
        marketplace: item.source,
        originalUrl: item.sourceUrl,
        visualSimilarity: null,
        metadataSimilarity: item.similarityScore,
        matchScore: item.similarityScore,
        matchLevel: visualMatchLevel(item.similarityScore),
        matchedOn: item.matchReasons,
        confidence: item.similarityScore,
        confidenceBreakdown: {
          imageSimilarity: null,
          visualAttributes: 0,
          metadata: 0,
          text: item.similarityScore
        },
        candidateImageAnalysis: null
      }));
      return {
        searchId: keywordResult.searchId,
        query: keywordResult.query,
        generatedTitle: keywordResult.generatedTitle,
        image: null,
        quality: {
          passed: true,
          warnings: [],
          checks: {
            hasImage: false,
            acceptedMimeType: true,
            nonEmptyFile: null,
            containsWatch: null
          }
        },
        queryImageAnalysis: null,
        queryEmbeddingDimensions: 0,
        queryImageHash: null,
        pipeline: [
          "keyword_search",
          "search_marketplace_candidates",
          "multi_signal_ranking",
          "return_top_matches_with_confidence"
        ],
        results: {
          items,
          localCandidates: keywordResult.results.local.length,
          ebayCandidates: keywordResult.results.ebay.length
        },
        metadata: {
          ...keywordResult.metadata,
          visualDepth: "keyword",
          candidateLimit: input.limit,
          candidateImageLimit: 0,
          analyzedCandidateImages: 0,
          candidateImageEmbeddings: false,
          analysisCacheHit: false
        },
        warnings: keywordResult.warnings,
        ...("errors" in keywordResult ? { errors: keywordResult.errors } : {}),
        record: keywordResult.record
      };
    }

    const timer = createImageSearchTimer("visual");
    try {
      timer.measureSync("image-read", () => {
        return undefined;
      });

      const optimizedInput = await timer.measure("sharp-resize", () => imagePreprocessInput(input));
      const cachedAnalysis = await this.getCachedImageAnalysis({ ...optimizedInput, includeEmbedding: false });
      let imageUploadError: unknown;
      const imageUrlPromise = timer.measure("image-upload", () =>
        this.storeImageIfNeeded(actor.id, "visual-image-search", optimizedInput.file, optimizedInput.imageUrl).catch((error: unknown) => {
          imageUploadError = error;
          return undefined;
        })
      );
      const analysisPromise = cachedAnalysis.analysis
        ? Promise.resolve({ analysis: cachedAnalysis.analysis, cacheHit: true, ...(cachedAnalysis.imageHash ? { imageHash: cachedAnalysis.imageHash } : {}) })
        : timer.measure("openai", async () => {
            const analysis = await this.analyzeImage({ ...optimizedInput, includeEmbedding: false });
            await this.writeCachedImageAnalysis(cachedAnalysis.cacheKey, analysis);
            return { analysis, cacheHit: false, ...(cachedAnalysis.imageHash ? { imageHash: cachedAnalysis.imageHash } : {}) };
          });
      const queryEmbeddingPromise = timer.measure("query-image-embedding", () => this.createQueryVisualEmbedding(optimizedInput));
      const [analysisSettled, imageUrlSettled, queryEmbeddingSettled] = await Promise.allSettled([
        analysisPromise,
        imageUrlPromise,
        queryEmbeddingPromise
      ]);
      if (analysisSettled.status === "rejected") {
        throw analysisSettled.reason;
      }
      if (queryEmbeddingSettled.status === "rejected") {
        throw queryEmbeddingSettled.reason;
      }
      if (imageUrlSettled.status === "rejected") {
        throw imageUrlSettled.reason;
      }
      const analysisResult = analysisSettled.value;
      const analysis = analysisResult.analysis;
      const quality = imageQualityCheck(input, analysis);
      const queryEmbedding = queryEmbeddingSettled.value;
      const generatedTitle = generatedTitleFromAnalysis(analysis);
      const filters = searchFilters(input);
      const visualQueries = visualSearchQueries(input, analysis, filters);
      const query = (visualQueries[0] ?? searchQueryFromParts(input.q ?? input.keyword ?? input.query ?? input.search, filters.brand, filters.model)) || "watch";
      const visualDepth = input.visualDepth ?? "fast";
      const candidateLimit = visualDepth === "deep" ? 100 : 50;
      const candidateImageLimit = typeof input.candidateImageLimit === "number"
        ? Math.min(input.candidateImageLimit, visualDepth === "deep" ? 60 : 40)
        : visualDepth === "deep"
          ? 40
          : 30;
      const marketplaceResult = await this.searchVisualMarketplaceCandidates(
        visualQueries,
        candidateLimit,
        filters,
        input.marketplaceId,
        timer
      );
      const { local, ebay: ebayResult } = marketplaceResult;
      const imageUrl = imageUrlSettled.value;
      if (imageUploadError) {
        if (imageUploadError instanceof AppError) {
          throw imageUploadError;
        }
        throw new ExternalServiceError("Image upload failed.");
      }

      const candidatePool = rankedVisualCandidateItems(query, local, ebayResult.items, candidateLimit);
      const candidateEmbeddingResult = await this.createCandidateVisualEmbeddings(candidatePool, timer, candidateImageLimit);
      const rankedCandidates = timer.measureSync("visual-ranking", () =>
        candidatePool
          .map((item) => {
            const candidateEmbedding = candidateEmbeddingResult.embeddings.get(productKey(item));
            const visualSimilarity = candidateEmbedding
              ? embeddingSimilarityScore(queryEmbedding.embedding, candidateEmbedding.embedding)
              : null;
            const metadataScores = visualSignalScores(item, input, analysis);
            const metadataSimilarity = visualMetadataSimilarity(metadataScores);
            const matchScore = visualMatchScore(visualSimilarity, metadataScores);
            return {
              ...item,
              similarityScore: matchScore,
              matchReasons: uniqueTerms([...item.matchReasons, ...metadataScores.matchedOn]),
              visualSimilarity,
              metadataSimilarity,
              matchScore,
              matchLevel: visualMatchLevel(matchScore),
              matchedOn: metadataScores.matchedOn,
              confidenceBreakdown: {
                imageSimilarity: visualSimilarity,
                visualAttributes: boundedScore((metadataScores.dialFeatures + metadataScores.caseBezel + metadataScores.strap) / 3 * 100),
                metadata: metadataSimilarity,
                text: boundedScore(metadataScores.text * 100)
              }
            };
          })
          .sort((left, right) => right.matchScore - left.matchScore || (right.visualSimilarity ?? 0) - (left.visualSimilarity ?? 0))
          .slice(0, input.limit)
      );
      const comparableItems = rankedVisualCandidateItems(query, local, ebayResult.items, Math.max(candidateLimit, local.length + ebayResult.items.length));
      const listingVolumeAmount = Math.max(ebayResult.total ?? 0, ebayResult.items.length) + local.length;
      const productDetails = await enrichProductDetails(this.ai, query, rankedCandidates, comparableItems, listingVolumeAmount, {
        inferMissingDetails: false
      });
      const rankedByKey = new Map(rankedCandidates.map((item) => [productKey(item), item]));
      const matches: VisualSearchMatch[] = withoutSimilarProductLists(productDetails)
        .map((item): VisualSearchMatch => {
          const key = `${item.source}:${item.id}`;
          const rankedItem = rankedByKey.get(key) as (RankedSearchItem & {
            visualSimilarity: number | null;
            metadataSimilarity: number;
            matchScore: number;
            matchLevel: VisualMatchLevel;
            matchedOn: string[];
            confidenceBreakdown: VisualSearchMatch["confidenceBreakdown"];
          }) | undefined;
          const confidence = rankedItem?.matchScore ?? item.similarityScore;
          return {
            ...item,
            marketplace: item.source,
            originalUrl: item.sourceUrl,
            visualSimilarity: rankedItem?.visualSimilarity ?? null,
            metadataSimilarity: rankedItem?.metadataSimilarity ?? 0,
            matchScore: confidence,
            matchLevel: rankedItem?.matchLevel ?? visualMatchLevel(confidence),
            matchedOn: rankedItem?.matchedOn ?? [],
            confidence,
            confidenceBreakdown: rankedItem?.confidenceBreakdown ?? {
              imageSimilarity: null,
              visualAttributes: 0,
              metadata: 0,
              text: item.similarityScore
            },
            candidateImageAnalysis: null
          };
        })
        .sort((left, right) => right.matchScore - left.matchScore || (right.visualSimilarity ?? 0) - (left.visualSimilarity ?? 0))
        .slice(0, input.limit);

      const record = await GeneratedApiRecordModel.create({
        resource: "visual-image-search",
        ownerId: actor.id,
        scope: {},
        data: {
          query,
          generatedTitle,
          imageUrl,
          quality,
          queryImageAnalysis: compactCandidateImageAnalysis(analysis),
          queryEmbeddingDimensions: queryEmbedding.embedding.length,
          queryImageHash: queryEmbedding.imageHash ?? analysisResult.imageHash ?? null,
          analysisCacheHit: analysisResult.cacheHit,
          queryEmbeddingCacheHit: queryEmbedding.cacheHit,
          resultCounts: {
            local: local.length,
            ebay: ebayResult.items.length,
            returned: matches.length
          },
          filters,
          visualDepth,
          marketplaceQueries: {
            local: marketplaceResult.localQueries,
            ebay: marketplaceResult.ebayQueries
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
            action: "visual-image-search.created",
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
        quality,
        queryImageAnalysis: compactCandidateImageAnalysis(analysis),
        queryEmbeddingDimensions: queryEmbedding.embedding.length,
        queryImageHash: queryEmbedding.imageHash ?? analysisResult.imageHash ?? null,
        pipeline: [
          "image_quality_check",
          "extract_visual_attributes",
          "generate_image_embedding",
          "search_marketplace_candidates",
          "compare_candidate_images_and_metadata",
          "multi_signal_ranking",
          "return_top_matches_with_confidence"
        ],
        results: {
          items: matches,
          localCandidates: local.length,
          ebayCandidates: ebayResult.items.length
        },
        metadata: {
          filters,
          visualDepth,
          candidateLimit,
          candidateImageLimit,
          analyzedCandidateImages: candidateEmbeddingResult.analyzedCandidateImages,
          candidateImageEmbeddings: candidateImageLimit > 0,
          visualEmbeddingModel: queryEmbedding.model,
          analysisCacheHit: analysisResult.cacheHit,
          queryEmbeddingCacheHit: queryEmbedding.cacheHit,
          embeddingCacheHits: candidateEmbeddingResult.cacheHits,
          marketplaceSearchCacheHits: marketplaceResult.localCacheHits + marketplaceResult.ebayCacheHits,
          marketplaceCandidates: {
            local: local.length,
            ebay: ebayResult.items.length
          },
          returned: matches.length,
          weights: visualSearchWeights,
          ebay: {
            environment: ebayResult.environment,
            marketplaceId: ebayResult.marketplaceId,
            query: ebayResult.query,
            total: ebayResult.total,
            attemptedQueries: ebayResult.attemptedQueries,
            warnings: ebayResult.warnings
          }
        },
        warnings: [...quality.warnings, ...ebayResult.warnings],
        ...(ebayResult.error ? { errors: { ebay: ebayResult.error } } : {}),
        record: serializeRecord(record)
      };
    } finally {
      timer.endAll();
    }
  }

  private async createSearchResult(actor: Actor, input: SearchInput, options: { inferProductDetails: boolean }) {
    const timer = createImageSearchTimer("standard");
    const filters = searchFilters(input);
    const explicitText = (input.q ?? input.keyword ?? input.query ?? input.search)?.trim();
    const explicitQuery = searchQueryFromParts(explicitText, filters.brand, filters.model);
    const hasImage = Boolean(input.file || input.imageUrl);
    if (hasImage) {
      timer.measureSync("image-read", () => undefined);
    } else if (!explicitQuery && !hasFilters(filters)) {
      throw new ConflictError("Provide a keyword, filter, or an image file.");
    }
    const optimizedInput = hasImage
      ? await timer.measure("sharp-resize", () => imagePreprocessInput(input))
      : input;
    const cachedAnalysis = hasImage && !explicitQuery
      ? await this.getCachedImageAnalysis({ ...optimizedInput, includeEmbedding: false })
      : undefined;

    let imageUploadError: unknown;
    const imageUrlPromise = hasImage
      ? timer.measure("image-upload", () =>
          this.storeImageIfNeeded(actor.id, "image-search", optimizedInput.file, optimizedInput.imageUrl).catch((error: unknown) => {
            imageUploadError = error;
            return undefined;
          })
        )
      : Promise.resolve<string | undefined>(undefined);
    let analysisError: string | undefined;
    const analysis = hasImage && !explicitQuery
      ? cachedAnalysis?.analysis
        ? cachedAnalysis.analysis
        : await timer.measure("openai", async () => {
            try {
              const analysis = await this.analyzeImage({ ...optimizedInput, includeEmbedding: false });
              await this.writeCachedImageAnalysis(cachedAnalysis?.cacheKey, analysis);
              return analysis;
            } catch (error) {
              analysisError = appErrorMessage(error, "AI image analysis failed.");
              return undefined;
            }
          })
      : undefined;
    const generatedTitle = analysis ? generatedTitleFromAnalysis(analysis) : null;
    const filterOnlySearch = !explicitQuery && !generatedTitle && !hasImage && hasFilters(filters);
    const query = explicitQuery || generatedTitle || (hasImage && analysisError ? "watch" : hasFilters(filters) ? "watch" : "");
    if (!query) {
      throw new ConflictError("AI could not detect a searchable watch from the image.");
    }
    const ebaySearchPlan = analysis ? ebaySearchPlanFromAnalysis(analysis, query) : undefined;
    const prioritySignals = analysis ? imageSearchPriorityFromAnalysis(analysis) : undefined;

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

    const rankedItems = rankedSearchItems(query, local, ebayResult.items, input.limit, prioritySignals);
    const comparableItems = rankedSearchItems(query, local, ebayResult.items, Math.max(input.limit, local.length + ebayResult.items.length), prioritySignals);
    const listingVolumeAmount = Math.max(ebayResult.total ?? 0, ebayResult.items.length) + local.length;
    const productDetails = await enrichProductDetails(this.ai, query, rankedItems, comparableItems, listingVolumeAmount, {
      inferMissingDetails: options.inferProductDetails
    });
    const listProductDetails = withoutSimilarProductLists(productDetails);

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
    this.queueRecommendationBuild(actor, {
      searchId: record._id.toString(),
      query,
      filters,
      ...(input.marketplaceId ? { marketplaceId: input.marketplaceId } : {})
    });

    return {
      searchId: record._id.toString(),
      query,
      generatedTitle,
      image: imageUrl ?? null,
      analysis: analysis ?? null,
      results: {
        items: listProductDetails,
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

  private async searchLocalCandidateListings(limit: number, filters: ProductSearchFilters = {}): Promise<LocalSearchItem[]> {
    const records = await GeneratedApiRecordModel.find({
      resource: "listings",
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(Math.max(limit * 5, 200));

    return records
      .map((record): LocalSearchItem => localSearchItemFromRecord(record, []))
      .filter((item) => this.localItemMatchesFilters(item, filters))
      .slice(0, limit);
  }

  private async localImageDirectMatches(
    queryEmbedding: VisualEmbeddingResult,
    localCandidates: LocalSearchItem[],
    timer: ReturnType<typeof createImageSearchTimer>,
    limit: number,
    candidateImageLimit: number
  ): Promise<DirectSearchItem[]> {
    const rankedCandidates = localCandidates
      .map((item) => rankedLocalItem(item, []))
      .filter((item) => item.image)
      .slice(0, Math.max(candidateImageLimit, limit));
    const candidateEmbeddings = await this.createCandidateVisualEmbeddings(rankedCandidates, timer, candidateImageLimit);
    return rankedCandidates
      .flatMap((item): DirectSearchItem[] => {
        const visualSimilarity = candidateEmbeddings.embeddings.has(productKey(item))
          ? embeddingSimilarityScore(queryEmbedding.embedding, candidateEmbeddings.embeddings.get(productKey(item))!.embedding)
          : null;
        if (visualSimilarity === null || visualSimilarity < 55) {
          return [];
        }
        return [
          directSearchItem(
            {
              ...item,
              similarityScore: visualSimilarity,
              matchReasons: uniqueTerms([...item.matchReasons, "internal:image-match"])
            },
            "image",
            visualSimilarity
          )
        ];
      })
      .sort((left, right) => right.matchScore - left.matchScore)
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
  ): Promise<EbayListingsSearchResult> {
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

  private async searchEbayImageListings(
    base64Image: string,
    limit: number,
    marketplaceId: string | undefined,
    filters: ProductSearchFilters = {}
  ): Promise<EbayListingsSearchResult> {
    const config = getMarketplaceConfig().ebay;
    const resolvedMarketplaceId = marketplaceId ?? config.marketplaceId;
    try {
      const options: Parameters<EbayProvider["searchListingsByImageWithMetadata"]>[1] = { limit };
      if (marketplaceId) {
        options.marketplaceId = marketplaceId;
      }
      const result = await withTimeout(
        this.ebay.searchListingsByImageWithMetadata(base64Image, options),
        getAiConfig().ebaySearchTimeoutMs,
        "eBay image search timed out."
      );
      return {
        query: "image",
        queryNormalization: {
          query: "image",
          source: "fallback",
          confidence: null,
          detectedBrand: null,
          detectedModel: null,
          reasoning: "Sent base64 image directly to eBay Browse search_by_image."
        },
        items: result.items.map(ebayItem).filter((item) => this.ebayItemMatchesFilters(item, filters)),
        environment: config.environment,
        marketplaceId: resolvedMarketplaceId,
        total: result.total,
        attemptedQueries: ["search_by_image"],
        warnings: []
      };
    } catch (error) {
      return {
        query: "image",
        queryNormalization: {
          query: "image",
          source: "fallback",
          confidence: null,
          detectedBrand: null,
          detectedModel: null,
          reasoning: error instanceof AppError ? error.message : null
        },
        items: [],
        environment: config.environment,
        marketplaceId: resolvedMarketplaceId,
        total: null,
        attemptedQueries: ["search_by_image"],
        warnings: [],
        error: error instanceof AppError ? error.message : "eBay image search failed."
      };
    }
  }

  private async enrichEbayListingsWithDetails(
    items: EbaySearchItem[],
    marketplaceId: string | undefined,
    limit: number
  ): Promise<{ items: EbaySearchItem[]; enrichedCount: number; failedCount: number }> {
    const detailLimit = Math.min(limit, items.length);
    const detailOptions: Parameters<EbayProvider["getListingDetails"]>[1] = {};
    if (marketplaceId) {
      detailOptions.marketplaceId = marketplaceId;
    }
    const detailResults = await Promise.allSettled(
      items.slice(0, detailLimit).map(async (item) => ebayItem(await this.ebay.getListingDetails(item.externalId, detailOptions)))
    );
    const detailById = new Map<string, EbaySearchItem>();
    let failedCount = 0;
    for (const result of detailResults) {
      if (result.status === "fulfilled") {
        detailById.set(result.value.externalId, result.value);
      } else {
        failedCount += 1;
      }
    }
    const enrichedItems = items.map((item) => {
      const detail = detailById.get(item.externalId);
      if (!detail) {
        return item;
      }
      const enriched: EbaySearchItem = {
        ...item,
        ...detail,
        title: item.title,
        price: item.price,
        currency: item.currency,
        sourceUrl: item.sourceUrl,
        image: item.image ?? detail.image
      };
      if (item.description && !detail.description) {
        enriched.description = item.description;
      }
      return enriched;
    });
    return {
      items: enrichedItems,
      enrichedCount: detailById.size,
      failedCount
    };
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

  private queueRecommendationBuild(
    actor: Actor,
    input: {
      searchId: string;
      query: string;
      filters: ProductSearchFilters;
      marketplaceId?: string;
    }
  ): void {
    setImmediate(() => {
      void this.markRecommendationProcessing(actor, input)
        .then(() => this.buildRecommendations(actor, input))
        .catch((error: unknown) => {
          void this.markRecommendationFailed(actor, input, error).catch(() => undefined);
        });
    });
  }

  private async markRecommendationProcessing(
    actor: Actor,
    input: {
      searchId: string;
      query: string;
    }
  ): Promise<void> {
    await this.saveLatestRecommendationRecord(actor, "processing", {
      searchId: input.searchId,
      searchQuery: input.query,
      items: [],
      local: [],
      ebay: [],
      sourceCounts: {
        local: 0,
        ebay: 0
      },
      message: "Recommendations are being generated.",
      generatedAt: new Date().toISOString()
    }, "recommended-products.processing", {
      searchId: input.searchId,
      query: input.query
    });
  }

  private async markRecommendationFailed(
    actor: Actor,
    input: {
      searchId: string;
      query: string;
    },
    error: unknown
  ): Promise<void> {
    await this.saveLatestRecommendationRecord(actor, "failed", {
      searchId: input.searchId,
      searchQuery: input.query,
      items: [],
      local: [],
      ebay: [],
      sourceCounts: {
        local: 0,
        ebay: 0
      },
      error: appErrorMessage(error, "Recommendation generation failed."),
      generatedAt: new Date().toISOString()
    }, "recommended-products.failed", {
      searchId: input.searchId,
      query: input.query,
      error: appErrorMessage(error, "Recommendation generation failed.")
    });
  }

  private async buildRecommendations(
    actor: Actor,
    input: {
      searchId: string;
      query: string;
      filters: ProductSearchFilters;
      marketplaceId?: string;
    }
  ): Promise<void> {
    const recommendationQuery = await this.aiRecommendationQuery(input.query);
    const filters: ProductSearchFilters = {};
    if (input.filters.brand) {
      filters.brand = input.filters.brand;
    }
    if (input.filters.model) {
      filters.model = input.filters.model;
    }
    const [local, ebayResult] = await Promise.all([
      this.searchLocalListings(recommendationQuery.query, 8, filters),
      this.searchEbayListings(recommendationQuery.query, 8, input.marketplaceId, undefined, filters)
    ]);
    const rankedItems = rankedSearchItems(recommendationQuery.query, local, ebayResult.items, 10);
    const comparableItems = rankedSearchItems(recommendationQuery.query, local, ebayResult.items, Math.max(10, local.length + ebayResult.items.length));
    const listingVolumeAmount = Math.max(ebayResult.total ?? 0, ebayResult.items.length) + local.length;
    const items = withoutSimilarProductLists(
      await enrichProductDetails(this.ai, recommendationQuery.query, rankedItems, comparableItems, listingVolumeAmount)
    );
    const localItems = items.filter((item) => item.source === "local");
    const ebayItems = items.filter((item) => item.source === "ebay");
    await this.saveLatestRecommendationRecord(actor, "completed", {
      searchId: input.searchId,
      searchQuery: input.query,
      recommendationQuery: recommendationQuery.query,
      queryNormalization: recommendationQuery,
      items,
      local: localItems,
      ebay: ebayItems,
      sourceCounts: {
        local: localItems.length,
        ebay: ebayItems.length
      },
      warnings: ebayResult.warnings,
      generatedAt: new Date().toISOString()
    }, "recommended-products.generated", {
      searchId: input.searchId,
      query: recommendationQuery.query,
      local: local.length,
      ebay: ebayResult.items.length
    });
  }

  private async saveLatestRecommendationRecord(
    actor: Actor,
    status: "processing" | "completed" | "failed",
    data: Record<string, unknown>,
    action: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const existing = await GeneratedApiRecordModel.findOne({
      resource: "recommended-products",
      ownerId: actor.id,
      "scope.kind": "latest",
      deletedAt: null
    });
    if (existing) {
      existing.data = data;
      existing.status = status;
      existing.history.push({
        action,
        actorId: actor.id,
        actorType: actor.audience,
        at: new Date(),
        metadata
      });
      await existing.save();
      return;
    }
    await GeneratedApiRecordModel.create({
      resource: "recommended-products",
      ownerId: actor.id,
      scope: { kind: "latest" },
      data,
      status,
      history: [
        {
          action,
          actorId: actor.id,
          actorType: actor.audience,
          at: new Date(),
          metadata
        },
      ]
    });
  }

  private async aiRecommendationQuery(query: string): Promise<MarketplaceQueryNormalization> {
    try {
      const normalized = await withTimeout(
        this.ai.normalizeSearchQuery({ query: `${query} similar recommended watches` }),
        getAiConfig().queryNormalizationTimeoutMs,
        "AI recommendation query normalization timed out."
      );
      return {
        query: normalized.optimizedQuery,
        source: "ai",
        confidence: normalized.confidence,
        detectedBrand: normalized.detectedBrand ?? null,
        detectedModel: normalized.detectedModel ?? null,
        reasoning: normalized.reasoning ?? "Built recommendation search query from latest user search."
      };
    } catch (error) {
      return {
        query,
        source: "fallback",
        confidence: null,
        detectedBrand: null,
        detectedModel: null,
        reasoning: error instanceof AppError ? error.message : "Recommendation query used original search text."
      };
    }
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
