import type {
  Chrono24Analytics,
  Chrono24AnalyticsQuery,
  Chrono24MarketInsights,
  Chrono24Product
} from "./chrono24.types.js";
import type { Chrono24Repository } from "./chrono24.repository.js";

type Snapshot = {
  listingId: string;
  price: number;
  currency: string;
  capturedAt: Date;
};

const roundMoney = (value: number): number => Number(value.toFixed(2));
const roundPercentage = (value: number): number => Number(value.toFixed(2));

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

const changeFromSnapshots = (snapshots: Snapshot[], currentAverage: number, days: number): number | null => {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const baseline = snapshots.filter((snapshot) => snapshot.capturedAt.getTime() <= since);
  const fallback = snapshots.filter((snapshot) => snapshot.capturedAt.getTime() >= since);
  const prices = (baseline.length > 0 ? baseline : fallback).map((snapshot) => snapshot.price);
  const baselineAverage = average(prices);
  if (baselineAverage === null || baselineAverage <= 0 || currentAverage <= 0) {
    return null;
  }
  return roundPercentage(((currentAverage - baselineAverage) / baselineAverage) * 100);
};

const liquidityScore = (listingVolume: number, volatility: number | null): number | null => {
  if (listingVolume === 0) {
    return null;
  }
  const volumeScore = Math.min(listingVolume, 200) / 200;
  const volatilityPenalty = Math.min(volatility ?? 0.5, 1);
  return Math.round(Math.max(0, Math.min(100, (volumeScore * 0.8 + (1 - volatilityPenalty) * 0.2) * 100)));
};

const productPriceChange = (product: Chrono24Product, snapshots: Snapshot[]): number | null => {
  const productSnapshots = snapshots
    .filter((snapshot) => snapshot.listingId === product.id)
    .sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime());
  const first = productSnapshots[0];
  if (!first || first.price <= 0) {
    return null;
  }
  return roundPercentage(((product.price - first.price) / first.price) * 100);
};

const grouped = <TItem,>(items: TItem[], key: (item: TItem) => string): Map<string, TItem[]> => {
  const output = new Map<string, TItem[]>();
  for (const item of items) {
    const groupKey = key(item);
    if (!groupKey) {
      continue;
    }
    output.set(groupKey, [...(output.get(groupKey) ?? []), item]);
  }
  return output;
};

const averagePrice = (products: Chrono24Product[]): number =>
  roundMoney(average(products.map((product) => product.price).filter((price) => price > 0)) ?? 0);

export class Chrono24AnalyticsService {
  public constructor(private readonly repository: Chrono24Repository) {}

  public async analytics(query: Chrono24AnalyticsQuery): Promise<Chrono24Analytics> {
    const [products, snapshots] = await Promise.all([
      this.repository.analyticsListings(query),
      this.repository.snapshots(query, new Date(Date.now() - 370 * 24 * 60 * 60 * 1000))
    ]);
    const prices = products.map((product) => product.price).filter((price) => Number.isFinite(price) && price > 0);
    const avg = average(prices) ?? 0;
    const stdDev = standardDeviation(prices);
    const volatility = avg > 0 && stdDev !== null ? Number((stdDev / avg).toFixed(4)) : null;

    return {
      lowestAskingPrice: prices.length > 0 ? roundMoney(Math.min(...prices)) : 0,
      highestAskingPrice: prices.length > 0 ? roundMoney(Math.max(...prices)) : 0,
      averageAskingPrice: roundMoney(avg),
      medianAskingPrice: roundMoney(median(prices) ?? 0),
      listingVolume: products.length,
      priceChange30d: changeFromSnapshots(snapshots, avg, 30),
      priceChange90d: changeFromSnapshots(snapshots, avg, 90),
      priceChange1y: changeFromSnapshots(snapshots, avg, 365),
      volatility,
      liquidityScore: liquidityScore(products.length, volatility)
    };
  }

  public async marketInsights(): Promise<Chrono24MarketInsights> {
    const [products, mostSearched, snapshots] = await Promise.all([
      this.repository.latestProducts(1000),
      this.repository.mostSearched(10),
      this.repository.snapshots({})
    ]);
    const priced = products.filter((product) => product.price > 0).sort((left, right) => left.price - right.price);
    const changes = products
      .map((product) => ({ product, changePercentage: productPriceChange(product, snapshots) }))
      .filter((entry): entry is { product: Chrono24Product; changePercentage: number } =>
        typeof entry.changePercentage === "number"
      );
    const brandGroups = Array.from(grouped(products, (product) => product.brand).entries())
      .map(([brand, items]) => ({ brand, listingVolume: items.length, averageAskingPrice: averagePrice(items) }))
      .sort((left, right) => right.listingVolume - left.listingVolume || right.averageAskingPrice - left.averageAskingPrice)
      .slice(0, 10);
    const modelGroups = Array.from(grouped(products, (product) => `${product.brand}|||${product.model}`).entries())
      .map(([key, items]) => {
        const [brand = "", model = ""] = key.split("|||");
        return { brand, model, listingVolume: items.length, averageAskingPrice: averagePrice(items) };
      })
      .sort((left, right) => right.listingVolume - left.listingVolume || right.averageAskingPrice - left.averageAskingPrice)
      .slice(0, 10);

    return {
      lowestPricedProduct: priced[0] ?? null,
      highestPricedProduct: priced[priced.length - 1] ?? null,
      mostSearched,
      trendingProducts: products.slice(0, 10),
      biggestDrops: changes
        .filter((entry) => entry.changePercentage < 0)
        .sort((left, right) => left.changePercentage - right.changePercentage)
        .slice(0, 10),
      topGainers: changes
        .filter((entry) => entry.changePercentage > 0)
        .sort((left, right) => right.changePercentage - left.changePercentage)
        .slice(0, 10),
      trendingBrands: brandGroups,
      trendingModels: modelGroups
    };
  }
}
