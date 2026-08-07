import { ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { getMarketplaceConfig } from "../../../config/marketplace.config.js";
import { EbayProvider, type MarketplaceListing } from "../../../infrastructure/external/ebay/ebay-provider.js";
import { GeneratedApiRecordModel, type GeneratedApiRecordDocument } from "../../generated-api/generated-api.model.js";
import type { WatchAlertInput, WatchAlertListQuery } from "./watch-alerts.validation.js";

type AlertProduct = {
  source: "local" | "ebay";
  id: string;
  image: string;
  brand: string;
  model: string;
  referenceNumber: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  movement: string;
  productionYear: number | null;
  scope: string;
  region: string;
  sourceUrl: string;
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

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const numberValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalized = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const queryMatches = (data: Record<string, unknown>, query: string): boolean => {
  const haystack = [
    stringValue(data.title),
    stringValue(data.brand),
    stringValue(data.model),
    stringValue(data.referenceNumber),
    stringValue(data.description)
  ]
    .filter(Boolean)
    .join(" ");
  return normalized(haystack).includes(normalized(query));
};

const firstImage = (data: Record<string, unknown>): string => {
  if (typeof data.image === "string" && data.image.trim()) {
    return data.image.trim();
  }
  if (Array.isArray(data.images)) {
    for (const image of data.images) {
      if (typeof image === "object" && image !== null && !Array.isArray(image)) {
        const url = stringValue((image as Record<string, unknown>).url);
        if (url) {
          return url;
        }
      }
    }
  }
  return "not_available";
};

const regionFromData = (data: Record<string, unknown>): string =>
  [
    stringValue(data.region),
    stringValue(data.location),
    stringValue(data.country),
    stringValue(data.city)
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ") || "not_available";

const localProduct = (record: GeneratedApiRecordDocument): AlertProduct | null => {
  const price = numberValue(record.data.price);
  const title = stringValue(record.data.title);
  if (!title || price === null) {
    return null;
  }
  const id = record._id.toString();
  return {
    source: "local",
    id,
    image: firstImage(record.data),
    brand: stringValue(record.data.brand) ?? "Unknown",
    model: stringValue(record.data.model) ?? "not_available",
    referenceNumber: stringValue(record.data.referenceNumber) ?? "not_available",
    title,
    price,
    currency: stringValue(record.data.currency) ?? "USD",
    condition: stringValue(record.data.condition) ?? "not_available",
    movement: stringValue(record.data.movement) ?? "not_available",
    productionYear: numberValue(record.data.productionYear) ?? numberValue(record.data.year),
    scope: stringValue(record.data.scope) ?? stringValue(record.data.set) ?? "not_available",
    region: regionFromData(record.data),
    sourceUrl: `/api/v1/products/local/${id}/details`
  };
};

const ebayProduct = (item: MarketplaceListing): AlertProduct => ({
  source: "ebay",
  id: item.externalId,
  image: item.imageUrl ?? "not_available",
  brand: item.brand ?? item.title.split(/\s+/)[0] ?? "Unknown",
  model: item.model ?? "not_available",
  referenceNumber: item.referenceNumber ?? "not_available",
  title: item.title,
  price: item.price,
  currency: item.currency,
  condition: item.condition ?? "not_available",
  movement: item.movement ?? "not_available",
  productionYear: item.productionYear ?? null,
  scope: item.scope ?? "not_available",
  region: item.location ?? "not_available",
  sourceUrl: item.sourceUrl
});

const priceMap = (value: unknown): Record<string, number> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) => {
          const price = numberValue(raw);
          return price === null ? [] : [[key, price]];
        })
      )
    : {};

const seenIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const dropPercentage = (previousPrice: number, currentPrice: number): number =>
  Number((((previousPrice - currentPrice) / previousPrice) * 100).toFixed(2));

const publicExtra = (extra: Record<string, unknown>): Record<string, unknown> => {
  const { eventKey: _eventKey, ...output } = extra;
  return output;
};

export class WatchAlertsService {
  private readonly ebay = new EbayProvider();

  public async create(userId: string, input: WatchAlertInput) {
    const data = {
      ...input,
      lastSeenProductIds: [],
      priceByProductId: {},
      createdAt: new Date().toISOString()
    };
    const record = await GeneratedApiRecordModel.create({
      resource: "watch-alerts",
      ownerId: userId,
      scope: {},
      data,
      status: "active",
      history: [
        {
          action: "watch-alerts.created",
          actorId: userId,
          actorType: "customer",
          at: new Date(),
          metadata: data
        }
      ]
    });
    return serializeRecord(record);
  }

  public async list(userId: string, query: WatchAlertListQuery) {
    const records = await GeneratedApiRecordModel.find({
      resource: "watch-alerts",
      ownerId: userId,
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(query.limit);
    return records.map(serializeRecord);
  }

  public async events(userId: string, query: WatchAlertListQuery) {
    const records = await GeneratedApiRecordModel.find({
      resource: "watch-alert-events",
      ownerId: userId,
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .limit(query.limit);
    return records.map(serializeRecord);
  }

  public async delete(userId: string, alertId: string) {
    const alert = await GeneratedApiRecordModel.findOne({
      _id: alertId,
      resource: "watch-alerts",
      ownerId: userId,
      deletedAt: null
    });
    if (!alert) {
      throw new ResourceNotFoundError("Watch alert not found.");
    }
    alert.status = "deleted";
    alert.deletedAt = new Date();
    alert.history.push({
      action: "watch-alerts.deleted",
      actorId: userId,
      actorType: "customer",
      at: new Date(),
      metadata: { alertId }
    });
    await alert.save();
    return {
      id: alert._id.toString(),
      deleted: true
    };
  }

  public async checkAllActiveAlerts(): Promise<{ checked: number; eventsCreated: number }> {
    const alerts = await GeneratedApiRecordModel.find({
      resource: "watch-alerts",
      status: "active",
      deletedAt: null
    }).limit(200);
    let eventsCreated = 0;
    for (const alert of alerts) {
      eventsCreated += await this.checkAlert(alert);
    }
    return { checked: alerts.length, eventsCreated };
  }

  public async checkUserAlerts(userId: string): Promise<{ checked: number; eventsCreated: number }> {
    const alerts = await GeneratedApiRecordModel.find({
      resource: "watch-alerts",
      ownerId: userId,
      status: "active",
      deletedAt: null
    }).limit(100);
    let eventsCreated = 0;
    for (const alert of alerts) {
      eventsCreated += await this.checkAlert(alert);
    }
    return { checked: alerts.length, eventsCreated };
  }

  private async checkAlert(alert: GeneratedApiRecordDocument): Promise<number> {
    const query = stringValue(alert.data.query) ?? "";
    const source = stringValue(alert.data.source) ?? "all";
    const marketplaceId = stringValue(alert.data.marketplaceId) ?? getMarketplaceConfig().ebay.marketplaceId;
    const eventTypes = Array.isArray(alert.data.eventTypes)
      ? alert.data.eventTypes.filter((item): item is string => typeof item === "string")
      : ["price_drop", "new_watch", "search_update"];
    const minDropPercentage = numberValue(alert.data.minDropPercentage) ?? 5;
    const maxPrice = numberValue(alert.data.maxPrice);
    const products = (await this.alertProducts(query, source, marketplaceId)).filter((product) =>
      maxPrice === null ? true : product.price <= maxPrice
    );
    const previousIds = seenIds(alert.data.lastSeenProductIds);
    const previousPrices = priceMap(alert.data.priceByProductId);
    const currentIds = products.map((product) => `${product.source}:${product.id}`);
    let created = 0;

    if (eventTypes.includes("new_watch")) {
      for (const product of products) {
        const key = `${product.source}:${product.id}`;
        if (!previousIds.includes(key)) {
          created += await this.createEvent(alert, "new_watch", product, { eventKey: `new:${key}` });
        }
      }
    }

    if (eventTypes.includes("price_drop")) {
      for (const product of products) {
        const key = `${product.source}:${product.id}`;
        const previousPrice = previousPrices[key];
        if (previousPrice && product.price < previousPrice) {
          const percentage = dropPercentage(previousPrice, product.price);
          if (percentage >= minDropPercentage) {
            created += await this.createEvent(alert, "price_drop", product, {
              eventKey: `drop:${key}:${product.price}`,
              previousPrice,
              currentPrice: product.price,
              dropPercentage: percentage
            });
          }
        }
      }
    }

    if (eventTypes.includes("search_update")) {
      const previousHash = stringValue(alert.data.lastResultHash);
      const currentHash = currentIds.sort().join("|");
      if (previousHash && previousHash !== currentHash) {
        created += await this.createEvent(alert, "search_update", products[0], {
          eventKey: `search:${currentHash}`,
          resultCount: products.length
        });
      }
    }

    alert.data = {
      ...alert.data,
      lastSeenProductIds: currentIds,
      priceByProductId: Object.fromEntries(products.map((product) => [`${product.source}:${product.id}`, product.price])),
      lastResultHash: currentIds.sort().join("|"),
      lastResultCount: products.length,
      lastCheckedAt: new Date().toISOString()
    };
    alert.history.push({
      action: "watch-alerts.checked",
      actorType: "system",
      at: new Date(),
      metadata: { created, resultCount: products.length }
    });
    await alert.save();
    return created;
  }

  private async alertProducts(query: string, source: string, marketplaceId: string): Promise<AlertProduct[]> {
    const [local, ebay] = await Promise.all([
      source === "ebay" ? Promise.resolve<AlertProduct[]>([]) : this.localProducts(query),
      source === "local" ? Promise.resolve<AlertProduct[]>([]) : this.ebayProducts(query, marketplaceId)
    ]);
    return [...local, ...ebay];
  }

  private async localProducts(query: string): Promise<AlertProduct[]> {
    const records = await GeneratedApiRecordModel.find({
      resource: "listings",
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(200);
    return records
      .filter((record) => queryMatches(record.data, query))
      .flatMap((record) => {
        const product = localProduct(record);
        return product ? [product] : [];
      })
      .slice(0, 20);
  }

  private async ebayProducts(query: string, marketplaceId: string): Promise<AlertProduct[]> {
    try {
      const result = await this.ebay.searchListingsWithMetadata(query, {
        limit: 20,
        marketplaceId
      });
      return result.items.map(ebayProduct);
    } catch {
      return [];
    }
  }

  private async createEvent(
    alert: GeneratedApiRecordDocument,
    type: string,
    product: AlertProduct | undefined,
    extra: Record<string, unknown>
  ): Promise<number> {
    if (!product) {
      return 0;
    }
    const eventKey = stringValue(extra.eventKey) ?? `${type}:${product.source}:${product.id}`;
    const existing = await GeneratedApiRecordModel.findOne({
      resource: "watch-alert-events",
      ownerId: alert.ownerId,
      "scope.alertId": alert._id.toString(),
      "scope.eventKey": eventKey,
      deletedAt: null
    }).select("_id");
    if (existing) {
      return 0;
    }
    const triggeredAt = new Date().toISOString();
    const alertInfo = {
      id: alert._id.toString(),
      name: stringValue(alert.data.name) ?? stringValue(alert.data.query) ?? "Watch alert",
      query: stringValue(alert.data.query) ?? "",
      type,
      source: stringValue(alert.data.source) ?? "all",
      triggeredAt,
      ...publicExtra(extra)
    };
    await GeneratedApiRecordModel.create({
      resource: "watch-alert-events",
      ownerId: alert.ownerId,
      scope: {
        alertId: alert._id.toString(),
        eventKey
      },
      data: {
        alertId: alert._id.toString(),
        type,
        query: alert.data.query,
        alert: alertInfo,
        product,
        productDetails: product,
        ...extra,
        triggeredAt
      },
      status: "unread",
      history: [
        {
          action: "watch-alert-events.created",
          actorId: alert.ownerId,
          actorType: "system",
          at: new Date(),
          metadata: { type, productId: product.id }
        }
      ]
    });
    return 1;
  }
}
