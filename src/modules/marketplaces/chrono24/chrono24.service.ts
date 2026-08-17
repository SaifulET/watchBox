import { ExternalServiceError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import type { RedisClient } from "../../../infrastructure/redis/client.js";
import { createAiProvider, type ImageAnalysis } from "../../../infrastructure/external/ai/ai-provider.js";
import { EbayProvider, type MarketplaceListing } from "../../../infrastructure/external/ebay/ebay-provider.js";
import { GeneratedApiRecordModel } from "../../generated-api/generated-api.model.js";
import { Chrono24AnalyticsService } from "./chrono24.analytics.js";
import { Chrono24Repository } from "./chrono24.repository.js";
import { Chrono24ScrapingService } from "./chrono24.scraper.js";
import { similarChrono24Products } from "./chrono24.similarity.js";
import type {
  Chrono24AnalyticsQuery,
  Chrono24LocationSearchInput,
  Chrono24MarketInsights,
  Chrono24PostSearchInput,
  Chrono24Product,
  Chrono24SearchQuery,
  Chrono24SearchResult
} from "./chrono24.types.js";

const ttl = {
  search: 15 * 60,
  product: 6 * 60 * 60,
  analytics: 30 * 60,
  marketInsights: 30 * 60
};

const parserUnavailableWarnings = [
  "Skipped an invalid JSON-LD script block.",
  "No JSON-LD structured data was found in the Chrono24 HTML."
];

type CachedValue<T> = {
  value: T;
  cachedAt: string;
};

type RecommendationItem = {
  source: "chrono24" | "ebay" | "watchbox";
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
  score: number;
  reasons: string[];
};

const cacheKey = (namespace: string, input: unknown): string =>
  `chrono24:v2:${namespace}:${Buffer.from(JSON.stringify(input)).toString("base64url")}`;

const getCached = async <T>(redis: RedisClient | undefined, key: string): Promise<T | null> => {
  if (!redis) {
    return null;
  }
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as CachedValue<T>;
  return parsed.value;
};

const setCached = async <T>(redis: RedisClient | undefined, key: string, value: T, seconds: number): Promise<void> => {
  if (!redis) {
    return;
  }
  await redis.set(key, JSON.stringify({ value, cachedAt: new Date().toISOString() }), "EX", seconds);
};

const hasParserUnavailableWarning = (warnings: string[]): boolean =>
  parserUnavailableWarnings.some((warning) => warnings.includes(warning));

const shouldBypassCachedSearchResult = (result: Chrono24SearchResult): boolean =>
  result.count === 0 && result.items.length === 0 && hasParserUnavailableWarning(result.warnings);

const shouldCacheSearchResult = (result: Chrono24SearchResult): boolean =>
  result.count > 0 || !hasParserUnavailableWarning(result.warnings);

const normalizeWatchSearchText = (value: string | undefined): string | undefined => {
  const normalized = value
    ?.trim()
    .replace(/\s+/g, " ")
    .replace(/\bsubmarine\b/gi, "Submariner")
    .replace(/\bspeed master\b/gi, "Speedmaster")
    .replace(/\bdate just\b/gi, "Datejust")
    .replace(/\bgmt master\b/gi, "GMT-Master");
  return normalized || undefined;
};

const canonicalSearchQuery = (query: Chrono24SearchQuery): Chrono24SearchQuery => ({
  ...query,
  q: normalizeWatchSearchText(query.q),
  brand: normalizeWatchSearchText(query.brand),
  model: normalizeWatchSearchText(query.model),
  reference: query.reference?.trim() || undefined
});

const haversineKm = (left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }): number => {
  const earthRadiusKm = 6371;
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRadians(right.latitude - left.latitude);
  const dLon = toRadians(right.longitude - left.longitude);
  const lat1 = toRadians(left.latitude);
  const lat2 = toRadians(right.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const productQuery = (product: Chrono24Product): string =>
  [product.brand, product.model, product.reference].filter((value) => value.trim()).join(" ") || product.title;

const textScore = (target: Chrono24Product, candidate: {
  title: string | null;
  brand?: string | null;
  model?: string | null;
  reference?: string | null;
  condition?: string | null;
  price?: number | null;
}): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];
  const same = (left: string | null | undefined, right: string | null | undefined): boolean =>
    Boolean(left?.trim() && right?.trim() && left.trim().toLowerCase() === right.trim().toLowerCase());
  if (same(candidate.reference, target.reference)) {
    score += 40;
    reasons.push("same reference");
  }
  if (same(candidate.model, target.model)) {
    score += 24;
    reasons.push("same model");
  }
  if (same(candidate.brand, target.brand)) {
    score += 18;
    reasons.push("same brand");
  }
  if (same(candidate.condition, target.condition)) {
    score += 8;
    reasons.push("same condition");
  }
  if (candidate.price && target.price > 0) {
    const delta = Math.abs(candidate.price - target.price) / Math.max(candidate.price, target.price);
    if (delta <= 0.2) {
      score += 10;
      reasons.push("similar price");
    }
  }
  if (score === 0 && candidate.title?.toLowerCase().includes(target.brand.toLowerCase())) {
    score += 6;
    reasons.push("title match");
  }
  return { score, reasons };
};

const ebayRecommendation = (target: Chrono24Product, item: MarketplaceListing): RecommendationItem => {
  const score = textScore(target, {
    title: item.title,
    brand: item.brand ?? null,
    model: item.model ?? null,
    reference: item.referenceNumber ?? null,
    condition: item.condition ?? null,
    price: item.price
  });
  return {
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
    url: item.sourceUrl,
    score: score.score,
    reasons: score.reasons
  };
};

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const numberValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const fileToDataUrl = (file: Express.Multer.File): string =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

const compactSearchPart = (value: string | null | undefined): string | null => {
  const compacted = value?.trim().replace(/\s+/g, " ");
  return compacted ? compacted : null;
};

const searchQueryFromAnalysis = (analysis: ImageAnalysis): string =>
  [
    compactSearchPart(analysis.probableBrand),
    compactSearchPart(analysis.probableModel),
    compactSearchPart(analysis.probableReferenceNumber),
    compactSearchPart(analysis.generatedTitle)
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

export class Chrono24Service {
  private readonly repository: Chrono24Repository;
  private readonly scraper: Chrono24ScrapingService;
  private readonly analyticsService: Chrono24AnalyticsService;
  private readonly ebay = new EbayProvider();
  private readonly ai = createAiProvider();

  public constructor(private readonly redis?: RedisClient) {
    this.repository = new Chrono24Repository();
    this.scraper = new Chrono24ScrapingService();
    this.analyticsService = new Chrono24AnalyticsService(this.repository);
  }

  public async search(query: Chrono24SearchQuery): Promise<Chrono24SearchResult> {
    query = canonicalSearchQuery(query);
    const key = cacheKey("search", query);
    const cached = await getCached<Chrono24SearchResult>(this.redis, key);
    if (!query.refresh && cached && !shouldBypassCachedSearchResult(cached)) {
      return { ...cached, cached: true };
    }

    await this.repository.recordSearch(query);
    if (!query.refresh) {
      const stored = await this.repository.searchStored(query);
      if (stored.items.length > 0) {
        const result: Chrono24SearchResult = {
          query,
          total: stored.total,
          count: stored.items.length,
          page: query.page,
          limit: query.limit,
          aggregateOffer: null,
          items: stored.items,
          cached: false,
          warnings: ["Returned stored Chrono24 listings for a fast response. Scheduled jobs refresh marketplace data every 24 hours; use refresh=true to force a live scrape."]
        };
        await setCached(this.redis, key, result, ttl.search);
        this.refreshSearchInBackground(query, key);
        return result;
      }
    }

    const warnings: string[] = cached ? ["Ignored stale empty Chrono24 search cache and refreshed live data."] : [];
    try {
      const parsed = await this.scraper.fetchSearchPage(query);
      warnings.push(...parsed.warnings);
      const products = parsed.products.slice(0, query.limit);
      await this.repository.upsertListings(products);
      const result: Chrono24SearchResult = {
        query,
        total: parsed.aggregateOffer?.offerCount ?? products.length,
        count: products.length,
        page: query.page,
        limit: query.limit,
        aggregateOffer: parsed.aggregateOffer,
        items: products,
        cached: false,
        warnings
      };
      if (shouldCacheSearchResult(result)) {
        await setCached(this.redis, key, result, ttl.search);
      }
      return result;
    } catch (error) {
      const stored = await this.repository.searchStored(query);
      if (stored.items.length > 0) {
        const result: Chrono24SearchResult = {
          query,
          total: stored.total,
          count: stored.items.length,
          page: query.page,
          limit: query.limit,
          aggregateOffer: null,
          items: stored.items,
          cached: false,
          warnings: [
            error instanceof Error ? `Live Chrono24 scrape failed; returned stored listings. ${error.message}` : "Live Chrono24 scrape failed; returned stored listings."
          ]
        };
        await setCached(this.redis, key, result, ttl.search);
        return result;
      }
      throw error;
    }
  }

  public async searchFromBody(input: Chrono24PostSearchInput, file?: Express.Multer.File) {
    const imageAnalysis = await this.analyzeSearchImage(input, file);
    const imageQuery = imageAnalysis ? searchQueryFromAnalysis(imageAnalysis) : "";
    const query: Chrono24SearchQuery = {
      page: input.page,
      limit: input.limit,
      refresh: input.refresh
    };
    query.q = input.q ?? (imageQuery || "watch");
    query.brand = input.brand ?? imageAnalysis?.probableBrand;
    query.model = input.model ?? imageAnalysis?.probableModel;
    query.reference = input.reference ?? imageAnalysis?.probableReferenceNumber;
    query.minPrice = input.minPrice;
    query.maxPrice = input.maxPrice;
    query.condition = input.condition;
    query.year = input.year;
    query.country = input.country;
    query.sort = input.sort;
    const searchResult = await this.search(query);
    const location =
      typeof input.latitude === "number" && typeof input.longitude === "number"
        ? await this.searchByLocation({
            latitude: input.latitude,
            longitude: input.longitude,
            radiusKm: input.radiusKm ?? 10,
            q: query.q,
            brand: query.brand,
            model: query.model,
            reference: query.reference
          })
        : null;
    const itemDetails = input.includeItemDetails
      ? await this.searchItemDetails(input.productId, searchResult.items[0])
      : null;
    const marketDetails = input.includeMarketDetails
      ? await this.analytics({
          brand: query.brand,
          model: query.model,
          reference: query.reference
        })
      : null;

    return {
      ...searchResult,
      resolvedInput: {
        source: imageAnalysis && !input.q ? "image" : "text",
        keyword: query.q ?? null,
        location:
          typeof input.latitude === "number" && typeof input.longitude === "number"
            ? {
                latitude: input.latitude,
                longitude: input.longitude,
                radiusKm: input.radiusKm ?? 10
              }
            : null
      },
      imageAnalysis: imageAnalysis
        ? {
            containsWatch: imageAnalysis.containsWatch,
            generatedTitle: imageAnalysis.generatedTitle ?? null,
            probableBrand: imageAnalysis.probableBrand ?? null,
            probableModel: imageAnalysis.probableModel ?? null,
            probableReferenceNumber: imageAnalysis.probableReferenceNumber ?? null,
            visualAttributes: imageAnalysis.visualAttributes,
            modelVersion: imageAnalysis.modelVersion
          }
        : null,
      locationResults: location,
      itemDetails,
      marketDetails
    };
  }

  private async analyzeSearchImage(
    input: Chrono24PostSearchInput,
    file: Express.Multer.File | undefined
  ): Promise<ImageAnalysis | null> {
    if (!file && !input.imageUrl) {
      return null;
    }
    return this.ai.analyzeImage({
      imageUrl: input.imageUrl ?? file?.originalname ?? "uploaded-chrono24-search-image",
      ...(file ? { imageDataUrl: fileToDataUrl(file) } : {}),
      ...(input.modelVersion ? { modelVersion: input.modelVersion } : {}),
      includeEmbedding: false
    });
  }

  private async searchItemDetails(productId: string | undefined, fallback: Chrono24Product | undefined) {
    if (!productId) {
      return fallback ?? null;
    }
    const stored = await this.repository.findByListingId(productId);
    return stored ?? fallback ?? null;
  }

  private refreshSearchInBackground(query: Chrono24SearchQuery, key: string): void {
    setImmediate(() => {
      void (async () => {
        const liveQuery: Chrono24SearchQuery = { ...query, refresh: false };
        const parsed = await this.scraper.fetchSearchPage(liveQuery);
        const products = parsed.products.slice(0, liveQuery.limit);
        if (products.length === 0) {
          return;
        }
        await this.repository.upsertListings(products);
        await setCached(this.redis, key, {
          query: liveQuery,
          total: parsed.aggregateOffer?.offerCount ?? products.length,
          count: products.length,
          page: liveQuery.page,
          limit: liveQuery.limit,
          aggregateOffer: parsed.aggregateOffer,
          items: products,
          cached: false,
          warnings: parsed.warnings
        }, ttl.search);
      })().catch(() => undefined);
    });
  }

  public async productDetails(id: string): Promise<Chrono24Product & { cached: boolean; warnings: string[] }> {
    const key = cacheKey("product", id);
    const cached = await getCached<Chrono24Product & { cached: boolean; warnings: string[] }>(this.redis, key);
    if (cached) {
      return { ...cached, cached: true };
    }

    const stored = await this.repository.findByListingId(id);
    try {
      const parsed = await this.scraper.fetchProductPage(stored?.url ?? id);
      const product = parsed.product;
      if (!product) {
        throw new ResourceNotFoundError("Chrono24 product was not found in the public page structured data.");
      }
      await this.repository.upsertListings([product]);
      const result = { ...product, cached: false, warnings: parsed.warnings };
      await setCached(this.redis, key, result, ttl.product);
      return result;
    } catch (error) {
      if (stored) {
        return {
          ...stored,
          cached: false,
          warnings: [
            error instanceof Error ? `Live Chrono24 detail scrape failed; returned stored product. ${error.message}` : "Live Chrono24 detail scrape failed; returned stored product."
          ]
        };
      }
      if (error instanceof ResourceNotFoundError || error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ResourceNotFoundError("Chrono24 product was not found.");
    }
  }

  public async similarProducts(id: string, limit = 12) {
    const target = await this.repository.findByListingId(id);
    if (!target) {
      throw new ResourceNotFoundError("Chrono24 product was not found.");
    }
    const candidates = await this.repository.analyticsListings({
      brand: target.brand,
      model: target.model || undefined,
      reference: target.reference || undefined
    });
    return {
      product: target,
      items: similarChrono24Products(target, candidates, limit)
    };
  }

  public async recommendations(id: string): Promise<{
    product: Chrono24Product;
    items: RecommendationItem[];
    chrono24: RecommendationItem[];
    ebay: RecommendationItem[];
    watchbox: RecommendationItem[];
    warnings: string[];
  }> {
    const target = await this.repository.findByListingId(id);
    if (!target) {
      throw new ResourceNotFoundError("Chrono24 product was not found.");
    }
    const warnings: string[] = [];
    const chrono24 = similarChrono24Products(
      target,
      await this.repository.analyticsListings({ brand: target.brand, model: target.model || undefined }),
      8
    ).map((item): RecommendationItem => ({
      source: "chrono24",
      id: item.id,
      title: item.title,
      brand: item.brand,
      model: item.model,
      reference: item.reference,
      price: item.price,
      currency: item.currency,
      condition: item.condition,
      image: item.image,
      url: item.url,
      score: item.similarityScore,
      reasons: item.matchReasons
    }));

    const [ebay, watchbox] = await Promise.all([
      this.ebayRecommendations(target).catch((error: unknown) => {
        warnings.push(error instanceof Error ? `Skipped eBay recommendations: ${error.message}` : "Skipped eBay recommendations.");
        return [];
      }),
      this.watchboxRecommendations(target)
    ]);
    const items = [...chrono24, ...ebay, ...watchbox]
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 20);
    return { product: target, items, chrono24, ebay, watchbox, warnings };
  }

  public async analytics(query: Chrono24AnalyticsQuery) {
    const key = cacheKey("analytics", query);
    const cached = await getCached<Awaited<ReturnType<Chrono24AnalyticsService["analytics"]>>>(this.redis, key);
    if (cached) {
      return cached;
    }
    const analytics = await this.analyticsService.analytics(query);
    await setCached(this.redis, key, analytics, ttl.analytics);
    return analytics;
  }

  public async marketInsights(): Promise<Chrono24MarketInsights> {
    const key = "chrono24:market-insights";
    const cached = await getCached<Chrono24MarketInsights>(this.redis, key);
    if (cached) {
      return cached;
    }
    const insights = await this.analyticsService.marketInsights();
    await setCached(this.redis, key, insights, ttl.marketInsights);
    return insights;
  }

  public async searchByLocation(input: Chrono24LocationSearchInput) {
    const products = await this.repository.preciseLocationProducts(input);
    const center = { latitude: input.latitude, longitude: input.longitude };
    const items = products
      .map((product) => {
        const latitude = product.location?.latitude;
        const longitude = product.location?.longitude;
        if (typeof latitude !== "number" || typeof longitude !== "number") {
          return null;
        }
        const distanceKm = haversineKm(center, { latitude, longitude });
        return distanceKm <= input.radiusKm ? { ...product, distanceKm: Number(distanceKm.toFixed(2)) } : null;
      })
      .filter((product): product is Chrono24Product & { distanceKm: number } => Boolean(product))
      .sort((left, right) => left.distanceKm - right.distanceKm);
    return {
      count: items.length,
      items,
      warnings: items.length === 0
        ? ["No sufficiently precise Chrono24 listing coordinates are available within the requested radius. Country-only locations were not treated as distance matches."]
        : []
    };
  }

  public async refreshDefaultListings(): Promise<{ refreshed: number; warnings: string[] }> {
    const result = await this.search({ q: "luxury watch", page: 1, limit: 50 });
    return { refreshed: result.count, warnings: result.warnings };
  }

  public async createSnapshotsFromCurrentListings(): Promise<{ snapshotCount: number }> {
    const products = await this.repository.latestProducts(1000);
    await this.repository.saveSnapshots(products);
    return { snapshotCount: products.length };
  }

  private async ebayRecommendations(target: Chrono24Product): Promise<RecommendationItem[]> {
    const result = await this.ebay.searchListings(productQuery(target), { limit: 10 });
    return result.map((item) => ebayRecommendation(target, item));
  }

  private async watchboxRecommendations(target: Chrono24Product): Promise<RecommendationItem[]> {
    const records = await GeneratedApiRecordModel.find({
      resource: "listings",
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();
    return records
      .map((record): RecommendationItem => {
        const data = record.data;
        const score = textScore(target, {
          title: stringValue(data.title),
          brand: stringValue(data.brand),
          model: stringValue(data.model),
          reference: stringValue(data.referenceNumber) ?? stringValue(data.reference),
          condition: stringValue(data.condition),
          price: numberValue(data.price)
        });
        return {
          source: "watchbox",
          id: record._id.toString(),
          title: stringValue(data.title) ?? "WatchBox listing",
          brand: stringValue(data.brand),
          model: stringValue(data.model),
          reference: stringValue(data.referenceNumber) ?? stringValue(data.reference),
          price: numberValue(data.price),
          currency: stringValue(data.currency),
          condition: stringValue(data.condition),
          image: stringValue(data.image),
          url: `/api/v1/listings/${record._id.toString()}`,
          score: score.score,
          reasons: score.reasons
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
  }
}
