import { randomUUID } from "node:crypto";
import { AppError, ConflictError, ExternalServiceError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { getMarketplaceConfig } from "../../../config/marketplace.config.js";
import { createAiProvider } from "../../../infrastructure/external/ai/ai-provider.js";
import type { ImageAnalysis, ImageAnalysisRequest } from "../../../infrastructure/external/ai/ai-provider.js";
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
  limit: number;
  marketplaceId?: string;
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
  description: string | null;
  image: string | null;
  status: string;
  score: number;
  createdAt: string;
  updatedAt: string;
};

type EbaySearchItem = Omit<MarketplaceListing, "imageUrl"> & {
  source: "ebay";
  image: string | null;
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
  image: string | null;
  sourceUrl: string | null;
  similarityScore: number;
  matchReasons: string[];
};

type InternalRankedSearchItem = RankedSearchItem & {
  rawScore: number;
};

const imageExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const aiAnalysisTimeoutMs = 45_000;
const aiQueryNormalizationTimeoutMs = 3_000;
const ebaySearchTimeoutMs = 8_000;

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

const numberValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    brand: null,
    model: null,
    referenceNumber: null,
    price: item.price,
    currency: item.currency,
    condition: item.condition ?? null,
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

const fallbackAnalysisTitleTerms = (analysis: ImageAnalysis): string[] =>
  Object.values(analysis.visualAttributes)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 3);

const generatedTitleFromAnalysis = (analysis: ImageAnalysis): string =>
  compactSearchPart(analysis.generatedTitle) ||
  searchQueryFromParts(analysis.probableBrand, analysis.probableModel, analysis.probableReferenceNumber) ||
  searchQueryFromParts(...fallbackAnalysisTitleTerms(analysis));

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
  if (item.condition) {
    output.condition = item.condition;
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

export class AiService {
  private readonly ai = createAiProvider();
  private readonly ebay = new EbayProvider();

  public async analyzeImage(input: AnalyzeInput): Promise<ImageAnalysis> {
    const request = this.toAnalysisRequest(input);
    try {
      return await withTimeout(
        this.ai.analyzeImage(request),
        aiAnalysisTimeoutMs,
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
    const explicitQuery = (input.q ?? input.keyword ?? input.query ?? input.search)?.trim();
    const hasImage = Boolean(input.file || input.imageUrl);
    if (!explicitQuery && !hasImage) {
      throw new ConflictError("Provide a keyword or an image file.");
    }

    let imageUploadError: unknown;
    const imageUrlPromise = hasImage
      ? this.storeImageIfNeeded(actor.id, "image-search", input.file, input.imageUrl).catch((error: unknown) => {
          imageUploadError = error;
          return undefined;
        })
      : Promise.resolve<string | undefined>(undefined);
    const analysis = hasImage && !explicitQuery
      ? await this.analyzeImage({ ...input, includeEmbedding: false })
      : undefined;
    const generatedTitle = analysis ? generatedTitleFromAnalysis(analysis) : null;
    const query = explicitQuery || generatedTitle || "";
    if (!query) {
      throw new ConflictError("AI could not detect a searchable watch from the image.");
    }
    const ebaySearchPlan = analysis ? ebaySearchPlanFromAnalysis(analysis, query) : undefined;

    const [local, ebayResult] = await Promise.all([
      this.searchLocalListings(query, input.limit),
      this.searchEbayListings(query, input.limit, input.marketplaceId, ebaySearchPlan)
    ]);
    const imageUrl = await imageUrlPromise;
    if (imageUploadError) {
      if (imageUploadError instanceof AppError) {
        throw imageUploadError;
      }
      throw new ExternalServiceError("Image upload failed.");
    }

    const record = await GeneratedApiRecordModel.create({
      resource: "image-search",
      ownerId: actor.id,
      scope: {},
      data: {
        query,
        generatedTitle,
        imageUrl,
        analysis: analysis ? compactAnalysisData(analysis) : null,
        resultCounts: {
          local: local.length,
          ebay: ebayResult.items.length
        },
        marketplaceQueries: {
          local: query,
          ebay: ebayResult.query
        },
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
        items: rankedSearchItems(query, local, ebayResult.items, input.limit),
        local,
        ebay: ebayResult.items
      },
      metadata: {
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
      errors: ebayResult.error ? { ebay: ebayResult.error } : {},
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

  private async searchLocalListings(query: string, limit: number): Promise<LocalSearchItem[]> {
    const terms = queryTerms(query);
    if (terms.length === 0) {
      return [];
    }

    const records = await GeneratedApiRecordModel.find({
      resource: "listings",
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(Math.max(limit * 5, 200));

    return records
      .map((record): LocalSearchItem => ({
        source: "local",
        id: record._id.toString(),
        title: stringValue(record.data.title),
        brand: stringValue(record.data.brand),
        model: stringValue(record.data.model),
        referenceNumber: stringValue(record.data.referenceNumber),
        price: numberValue(record.data.price),
        currency: stringValue(record.data.currency),
        condition: stringValue(record.data.condition),
        description: stringValue(record.data.description),
        image: firstListingImageUrl(record.data),
        status: record.status,
        score: localMatchScore(record.data, terms),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);
  }

  private async searchEbayListings(
    query: string,
    limit: number,
    marketplaceId: string | undefined,
    searchPlan?: EbaySearchPlan
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
    try {
      const options: Parameters<EbayProvider["searchListingsWithMetadata"]>[1] = { limit };
      if (marketplaceId) {
        options.marketplaceId = marketplaceId;
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
          ebaySearchTimeoutMs,
          "eBay search timed out."
        );
        total = result.total;
        items = result.items.map(ebayItem);
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

  private async normalizeMarketplaceQuery(query: string): Promise<MarketplaceQueryNormalization> {
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
