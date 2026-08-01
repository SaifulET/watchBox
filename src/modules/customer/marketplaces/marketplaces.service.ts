import { getMarketplaceConfig } from "../../../config/marketplace.config.js";
import { AppError, ExternalServiceError } from "../../../common/errors/app-error.js";
import { createAiProvider } from "../../../infrastructure/external/ai/ai-provider.js";
import { EbayProvider } from "../../../infrastructure/external/ebay/ebay-provider.js";
import type {
  MarketplaceListing,
  MarketplaceListingDetails
} from "../../../infrastructure/external/ebay/ebay-provider.js";
import type { EbayAnalyticsQuery, EbaySearchQuery } from "./marketplaces.validation.js";

type PriceStats = {
  currency: string | null;
  average: number | null;
  median: number | null;
  lowest: number | null;
  highest: number | null;
  sampleSize: number;
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

const average = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null;

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
        feedbackPercentage: item.sellerFeedbackPercentage ?? null
      }
    : null,
  buyingOptions: item.buyingOptions
});

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

  public async searchEbay(query: EbaySearchQuery) {
    const options: Parameters<EbayProvider["searchListings"]>[1] = {
      limit: query.limit
    };
    if (query.marketplaceId) {
      options.marketplaceId = query.marketplaceId;
    }
    const config = getMarketplaceConfig().ebay;
    const normalized = await this.normalizeMarketplaceQuery(query.q);
    const items = await this.ebay.searchListings(normalized.query, options);
    return {
      query: query.q,
      ebayQuery: normalized.query,
      queryNormalization: normalized,
      environment: config.environment,
      marketplaceId: query.marketplaceId ?? config.marketplaceId,
      count: items.length,
      items
    };
  }

  public async testEbayConnection(): Promise<{ connected: true }> {
    await this.ebay.checkConnectivity();
    return { connected: true };
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
}
