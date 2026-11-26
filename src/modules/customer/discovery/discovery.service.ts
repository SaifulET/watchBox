import mongoose from "mongoose";
import { GeneratedApiRecordModel, type GeneratedApiRecordDocument } from "../../generated-api/generated-api.model.js";

const DEFAULT_WATCH_BRANDS = [
  "Rolex",
  "Patek Philippe",
  "Audemars Piguet",
  "Omega",
  "Cartier",
  "Tudor",
  "IWC",
  "Vacheron Constantin",
  "Richard Mille",
  "Panerai",
  "Breitling",
  "Jaeger-LeCoultre",
  "TAG Heuer",
  "Grand Seiko",
  "Hublot"
];

const stringField = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const numberField = (value: unknown): number | undefined => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const serializeListingSummary = (record: GeneratedApiRecordDocument) => {
  const data = record.data ?? {};
  const photos = Array.isArray(data.photos)
    ? data.photos.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const price = numberField(data.price) ?? 0;
  return {
    id: record._id.toString(),
    _id: record._id.toString(),
    ownerId: record.ownerId ?? null,
    status: record.status ?? "active",
    brand: stringField(data.brand) ?? "",
    model: stringField(data.model) ?? "",
    title:
      stringField(data.title) ??
      [stringField(data.brand), stringField(data.model)].filter(Boolean).join(" "),
    referenceNumber: stringField(data.referenceNumber) ?? stringField(data.reference) ?? null,
    price,
    currency: stringField(data.currency) ?? "USD",
    condition: stringField(data.condition) ?? null,
    year: numberField(data.year) ?? null,
    location: stringField(data.location) ?? null,
    boxPapers: stringField(data.boxPapers) ?? null,
    photos,
    imageUrl: photos[0] ?? stringField(data.imageUrl) ?? null,
    createdAt: record.createdAt?.toISOString() ?? null
  };
};

const activeListingsFilter = () => ({
  resource: "listings",
  deletedAt: null,
  status: mongoose.trusted({ $nin: ["sold", "deleted", "archived", "rejected"] })
});

export class DiscoveryService {
  public async searchSuggestions(query: string, limit = 10) {
    const trimmed = query.trim();
    const safeLimit = Math.min(Math.max(limit, 1), 30);
    const listings = await GeneratedApiRecordModel.find(activeListingsFilter())
      .sort({ createdAt: -1 })
      .limit(200);

    const needle = trimmed.toLowerCase();
    const seen = new Set<string>();
    const suggestions: Array<{
      text: string;
      type: "brand" | "model" | "reference" | "listing";
      brand?: string;
      model?: string;
      referenceNumber?: string;
      listingId?: string;
    }> = [];

    const addSuggestion = (item: (typeof suggestions)[number]) => {
      const key = `${item.type}:${item.text.toLowerCase()}`;
      if (seen.has(key) || suggestions.length >= safeLimit) {
        return;
      }
      seen.add(key);
      suggestions.push(item);
    };

    for (const listing of listings) {
      const brand = stringField(listing.data?.brand);
      const model = stringField(listing.data?.model);
      const ref = stringField(listing.data?.referenceNumber) ?? stringField(listing.data?.reference);
      const title = stringField(listing.data?.title) ?? [brand, model].filter(Boolean).join(" ");

      if (brand && (!needle || brand.toLowerCase().includes(needle))) {
        addSuggestion({ text: brand, type: "brand", brand });
      }
      if (model && (!needle || `${brand ?? ""} ${model}`.toLowerCase().includes(needle))) {
        addSuggestion({
          text: brand ? `${brand} ${model}` : model,
          type: "model",
          ...(brand ? { brand } : {}),
          model
        });
      }
      if (ref && (!needle || ref.toLowerCase().includes(needle))) {
        addSuggestion({
          text: ref,
          type: "reference",
          ...(brand ? { brand } : {}),
          ...(model ? { model } : {}),
          referenceNumber: ref
        });
      }
      if (title && needle && title.toLowerCase().includes(needle)) {
        addSuggestion({
          text: title,
          type: "listing",
          ...(brand ? { brand } : {}),
          ...(model ? { model } : {}),
          listingId: listing._id.toString()
        });
      }
      if (suggestions.length >= safeLimit) {
        break;
      }
    }

    if (suggestions.length < safeLimit) {
      for (const brand of DEFAULT_WATCH_BRANDS) {
        if (!needle || brand.toLowerCase().includes(needle)) {
          addSuggestion({ text: brand, type: "brand", brand });
        }
        if (suggestions.length >= safeLimit) {
          break;
        }
      }
    }

    return {
      query: trimmed,
      suggestions
    };
  }

  public async popularSearches(limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 30);
    const [searchRecords, listings] = await Promise.all([
      GeneratedApiRecordModel.find({
        resource: mongoose.trusted({ $in: ["saved-searches", "search-history"] }),
        deletedAt: null
      })
        .sort({ createdAt: -1 })
        .limit(300),
      GeneratedApiRecordModel.find(activeListingsFilter()).sort({ createdAt: -1 }).limit(200)
    ]);

    const counts = new Map<string, { query: string; count: number; brand?: string }>();
    const increment = (rawQuery: string, brand?: string) => {
      const normalized = rawQuery.trim();
      if (!normalized) {
        return;
      }
      const key = normalized.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { query: normalized, count: 1, ...(brand ? { brand } : {}) });
      }
    };

    for (const record of searchRecords) {
      const q =
        stringField(record.data?.query) ??
        stringField(record.data?.q) ??
        stringField(record.data?.name) ??
        [stringField(record.data?.brand), stringField(record.data?.model)].filter(Boolean).join(" ");
      if (q) {
        increment(q, stringField(record.data?.brand));
      }
    }

    for (const listing of listings) {
      const brand = stringField(listing.data?.brand);
      const model = stringField(listing.data?.model);
      const label = [brand, model].filter(Boolean).join(" ");
      if (label) {
        increment(label, brand);
      }
    }

    const items = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, safeLimit);

    if (items.length < safeLimit) {
      const existingKeys = new Set(items.map((item) => item.query.toLowerCase()));
      for (const brand of DEFAULT_WATCH_BRANDS) {
        if (!existingKeys.has(brand.toLowerCase())) {
          items.push({ query: brand, count: 0, brand });
          if (items.length >= safeLimit) {
            break;
          }
        }
      }
    }

    return { items };
  }

  public async recentSearches(userId: string, limit = 15) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const records = await GeneratedApiRecordModel.find({
      resource: mongoose.trusted({ $in: ["search-history", "saved-searches"] }),
      ownerId: userId,
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .limit(safeLimit * 2);

    const seen = new Set<string>();
    const items: Array<{
      id: string;
      query: string;
      brand?: string;
      model?: string;
      createdAt: string | null;
    }> = [];

    for (const record of records) {
      const query =
        stringField(record.data?.query) ??
        stringField(record.data?.q) ??
        stringField(record.data?.name) ??
        [stringField(record.data?.brand), stringField(record.data?.model)].filter(Boolean).join(" ");
      if (!query) {
        continue;
      }
      const key = query.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const brand = stringField(record.data?.brand);
      const model = stringField(record.data?.model);
      items.push({
        id: record._id.toString(),
        query,
        ...(brand ? { brand } : {}),
        ...(model ? { model } : {}),
        createdAt: record.createdAt?.toISOString() ?? null
      });
      if (items.length >= safeLimit) {
        break;
      }
    }

    return { items };
  }

  public async recordRecentSearch(userId: string, query: string, brand?: string, model?: string) {
    const trimmed = query.trim();
    const record = await GeneratedApiRecordModel.create({
      resource: "search-history",
      ownerId: userId,
      scope: { kind: "recent" },
      status: "active",
      data: {
        query: trimmed,
        ...(brand ? { brand } : {}),
        ...(model ? { model } : {})
      }
    });
    return {
      id: record._id.toString(),
      query: trimmed,
      createdAt: record.createdAt?.toISOString() ?? new Date().toISOString()
    };
  }

  public async clearRecentSearches(userId: string) {
    const result = await GeneratedApiRecordModel.updateMany(
      {
        resource: "search-history",
        ownerId: userId,
        deletedAt: null
      },
      {
        $set: { deletedAt: new Date(), status: "deleted" }
      }
    );
    return {
      cleared: true,
      deletedCount: result.modifiedCount ?? 0
    };
  }

  public async searchFacets() {
    const listings = await GeneratedApiRecordModel.find(activeListingsFilter()).limit(500);
    const brands = new Map<string, number>();
    const conditions = new Map<string, number>();
    const years = new Map<number, number>();
    const locations = new Map<string, number>();
    const boxPapers = new Map<string, number>();
    const prices: number[] = [];

    const bump = <K>(map: Map<K, number>, key: K) => {
      map.set(key, (map.get(key) ?? 0) + 1);
    };

    for (const listing of listings) {
      const brand = stringField(listing.data?.brand);
      const condition = stringField(listing.data?.condition);
      const year = numberField(listing.data?.year);
      const location = stringField(listing.data?.location);
      const bp = stringField(listing.data?.boxPapers);
      const price = numberField(listing.data?.price);

      if (brand) bump(brands, brand);
      if (condition) bump(conditions, condition);
      if (year && year >= 1900 && year <= 2100) bump(years, year);
      if (location) bump(locations, location);
      if (bp) bump(boxPapers, bp);
      if (price !== undefined && price > 0) prices.push(price);
    }

    const toFacetList = <K>(map: Map<K, number>) =>
      [...map.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const avgPrice = prices.length
      ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
      : 0;

    return {
      totalListings: listings.length,
      brands: toFacetList(brands),
      conditions: toFacetList(conditions),
      years: toFacetList(years).sort((a, b) => Number(b.value) - Number(a.value)),
      locations: toFacetList(locations),
      boxPapers: toFacetList(boxPapers),
      priceRange: {
        min: minPrice,
        max: maxPrice,
        average: avgPrice,
        currency: "USD"
      }
    };
  }

  public async listBrands(search?: string) {
    const listings = await GeneratedApiRecordModel.find(activeListingsFilter()).limit(1000);
    const stats = new Map<string, { name: string; listingCount: number; totalPrice: number; pricedCount: number }>();

    for (const defaultBrand of DEFAULT_WATCH_BRANDS) {
      stats.set(defaultBrand.toLowerCase(), {
        name: defaultBrand,
        listingCount: 0,
        totalPrice: 0,
        pricedCount: 0
      });
    }

    for (const listing of listings) {
      const brand = stringField(listing.data?.brand);
      if (!brand) continue;
      const key = brand.toLowerCase();
      const entry = stats.get(key) ?? {
        name: brand,
        listingCount: 0,
        totalPrice: 0,
        pricedCount: 0
      };
      entry.listingCount += 1;
      const price = numberField(listing.data?.price);
      if (price !== undefined && price > 0) {
        entry.totalPrice += price;
        entry.pricedCount += 1;
      }
      stats.set(key, entry);
    }

    const needle = search?.trim().toLowerCase();
    const items = [...stats.values()]
      .filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
      .sort((a, b) => b.listingCount - a.listingCount || a.name.localeCompare(b.name))
      .map((entry) => ({
        id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: entry.name,
        slug: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        listingCount: entry.listingCount,
        averagePrice: entry.pricedCount ? Math.round(entry.totalPrice / entry.pricedCount) : null,
        currency: "USD"
      }));

    return {
      total: items.length,
      items
    };
  }

  public async listWatchModels(brandFilter?: string, search?: string) {
    const listings = await GeneratedApiRecordModel.find(activeListingsFilter()).limit(1000);
    const brandNeedle = brandFilter?.trim().toLowerCase();
    const searchNeedle = search?.trim().toLowerCase();

    const groups = new Map<
      string,
      {
        brand: string;
        model: string;
        listingCount: number;
        prices: number[];
        references: Set<string>;
        sampleImageUrl: string | null;
      }
    >();

    for (const listing of listings) {
      const brand = stringField(listing.data?.brand);
      const model = stringField(listing.data?.model);
      if (!model) continue;
      if (brandNeedle && (brand ?? "").toLowerCase() !== brandNeedle) continue;
      if (searchNeedle && !`${brand ?? ""} ${model}`.toLowerCase().includes(searchNeedle)) continue;

      const key = `${(brand ?? "").toLowerCase()}::${model.toLowerCase()}`;
      const existing = groups.get(key) ?? {
        brand: brand ?? "Unknown",
        model,
        listingCount: 0,
        prices: [],
        references: new Set<string>(),
        sampleImageUrl: null
      };
      existing.listingCount += 1;
      const price = numberField(listing.data?.price);
      if (price !== undefined && price > 0) {
        existing.prices.push(price);
      }
      const ref = stringField(listing.data?.referenceNumber) ?? stringField(listing.data?.reference);
      if (ref) {
        existing.references.add(ref);
      }
      if (!existing.sampleImageUrl) {
        const photos = Array.isArray(listing.data?.photos) ? listing.data.photos : [];
        const firstPhoto = photos.find((p): p is string => typeof p === "string" && p.trim().length > 0);
        existing.sampleImageUrl = firstPhoto ?? stringField(listing.data?.imageUrl) ?? null;
      }
      groups.set(key, existing);
    }

    const items = [...groups.values()]
      .sort((a, b) => b.listingCount - a.listingCount || a.model.localeCompare(b.model))
      .map((entry) => ({
        id: `${entry.brand}-${entry.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        brand: entry.brand,
        model: entry.model,
        listingCount: entry.listingCount,
        averagePrice: entry.prices.length
          ? Math.round(entry.prices.reduce((sum, p) => sum + p, 0) / entry.prices.length)
          : null,
        minPrice: entry.prices.length ? Math.min(...entry.prices) : null,
        maxPrice: entry.prices.length ? Math.max(...entry.prices) : null,
        references: [...entry.references].slice(0, 10),
        imageUrl: entry.sampleImageUrl
      }));

    return {
      total: items.length,
      items
    };
  }

  public async trendingRecommendations(limit = 12) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const listings = await GeneratedApiRecordModel.find(activeListingsFilter())
      .sort({ createdAt: -1 })
      .limit(safeLimit);
    return {
      items: listings.map(serializeListingSummary)
    };
  }

  public async forYouRecommendations(userId?: string, limit = 12) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const preferredBrands = new Set<string>();

    if (userId) {
      const userSignals = await GeneratedApiRecordModel.find({
        resource: mongoose.trusted({ $in: ["saved-watches", "saved-searches", "search-history"] }),
        ownerId: userId,
        deletedAt: null
      })
        .sort({ createdAt: -1 })
        .limit(50);

      for (const signal of userSignals) {
        const brand = stringField(signal.data?.brand);
        if (brand) {
          preferredBrands.add(brand.toLowerCase());
        }
      }
    }

    const listings = await GeneratedApiRecordModel.find(activeListingsFilter())
      .sort({ createdAt: -1 })
      .limit(120);

    const ranked = listings
      .filter((listing) => !userId || listing.ownerId !== userId)
      .sort((a, b) => {
        const aPreferred = preferredBrands.has((stringField(a.data?.brand) ?? "").toLowerCase()) ? 1 : 0;
        const bPreferred = preferredBrands.has((stringField(b.data?.brand) ?? "").toLowerCase()) ? 1 : 0;
        if (aPreferred !== bPreferred) {
          return bPreferred - aPreferred;
        }
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      })
      .slice(0, safeLimit);

    return {
      personalized: preferredBrands.size > 0,
      preferredBrands: [...preferredBrands],
      items: ranked.map(serializeListingSummary)
    };
  }

  public async homeRecommendations(userId?: string, limit = 8) {
    const [trending, forYou, brands] = await Promise.all([
      this.trendingRecommendations(limit),
      this.forYouRecommendations(userId, limit),
      this.listBrands()
    ]);

    return {
      featured: trending.items.slice(0, 4),
      trending: trending.items,
      forYou: forYou.items,
      popularBrands: brands.items.slice(0, 10)
    };
  }

  public async marketInsights(filters: { brand?: string; model?: string; reference?: string }) {
    const [activeListings, soldCount] = await Promise.all([
      GeneratedApiRecordModel.find(activeListingsFilter()).sort({ createdAt: -1 }).limit(1000),
      GeneratedApiRecordModel.countDocuments({
        resource: "listings",
        status: "sold",
        deletedAt: null
      })
    ]);

    const brandNeedle = filters.brand?.trim().toLowerCase();
    const modelNeedle = filters.model?.trim().toLowerCase();
    const refNeedle = filters.reference?.trim().toLowerCase();

    const filtered = activeListings.filter((listing) => {
      const brand = (stringField(listing.data?.brand) ?? "").toLowerCase();
      const model = (stringField(listing.data?.model) ?? "").toLowerCase();
      const ref = (
        stringField(listing.data?.referenceNumber) ??
        stringField(listing.data?.reference) ??
        ""
      ).toLowerCase();
      if (brandNeedle && !brand.includes(brandNeedle)) return false;
      if (modelNeedle && !model.includes(modelNeedle)) return false;
      if (refNeedle && !ref.includes(refNeedle)) return false;
      return true;
    });

    const prices = filtered
      .map((listing) => numberField(listing.data?.price))
      .filter((price): price is number => price !== undefined && price > 0)
      .sort((a, b) => a - b);

    const averagePrice = prices.length
      ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
      : 0;
    const medianPrice = prices.length
      ? prices.length % 2 === 1
        ? prices[Math.floor(prices.length / 2)]!
        : Math.round((prices[prices.length / 2 - 1]! + prices[prices.length / 2]!) / 2)
      : 0;
    const minPrice = prices.length ? prices[0]! : 0;
    const maxPrice = prices.length ? prices[prices.length - 1]! : 0;

    const brandBuckets = new Map<string, { brand: string; count: number; totalPrice: number; pricedCount: number }>();
    const conditionBuckets = new Map<string, number>();

    for (const listing of filtered) {
      const brand = stringField(listing.data?.brand) ?? "Other";
      const price = numberField(listing.data?.price);
      const condition = stringField(listing.data?.condition) ?? "Unspecified";

      const bucket = brandBuckets.get(brand) ?? {
        brand,
        count: 0,
        totalPrice: 0,
        pricedCount: 0
      };
      bucket.count += 1;
      if (price !== undefined && price > 0) {
        bucket.totalPrice += price;
        bucket.pricedCount += 1;
      }
      brandBuckets.set(brand, bucket);
      conditionBuckets.set(condition, (conditionBuckets.get(condition) ?? 0) + 1);
    }

    return {
      filters: {
        brand: filters.brand ?? null,
        model: filters.model ?? null,
        reference: filters.reference ?? null
      },
      summary: {
        totalListings: filtered.length,
        soldListings: soldCount,
        averagePrice,
        medianPrice,
        minPrice,
        maxPrice,
        currency: "USD"
      },
      byBrand: [...brandBuckets.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
        .map((item) => ({
          brand: item.brand,
          listingCount: item.count,
          averagePrice: item.pricedCount ? Math.round(item.totalPrice / item.pricedCount) : 0
        })),
      byCondition: [...conditionBuckets.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([condition, count]) => ({ condition, count })),
      generatedAt: new Date().toISOString()
    };
  }
}
