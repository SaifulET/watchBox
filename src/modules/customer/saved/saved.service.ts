import { ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { GeneratedApiRecordModel } from "../../generated-api/generated-api.model.js";
import type { GeneratedApiRecordDocument } from "../../generated-api/generated-api.model.js";
import type {
  RecommendationsQuery,
  SavedListQuery,
  SavedProductInput,
  SavedSearchInput
} from "./saved.validation.js";

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

export class SavedService {
  public async saveProduct(userId: string, input: SavedProductInput) {
    const productId = input.id ?? input.productId ?? "";
    const scope = {
      source: input.source,
      productId,
      listName: input.listName
    };
    const data = {
      ...input,
      id: productId,
      productId,
      savedAt: new Date().toISOString()
    };
    const existing = await GeneratedApiRecordModel.findOne({
      resource: "saved-products",
      ownerId: userId,
      "scope.source": scope.source,
      "scope.productId": scope.productId,
      "scope.listName": scope.listName,
      deletedAt: null
    });
    if (existing) {
      existing.data = { ...existing.data, ...data };
      existing.status = "active";
      existing.history.push({
        action: "saved-products.updated",
        actorId: userId,
        actorType: "customer",
        at: new Date(),
        metadata: data
      });
      await existing.save();
      return serializeRecord(existing);
    }
    const record = await GeneratedApiRecordModel.create({
      resource: "saved-products",
      ownerId: userId,
      scope,
      data,
      status: "active",
      history: [
        {
          action: "saved-products.created",
          actorId: userId,
          actorType: "customer",
          at: new Date(),
          metadata: data
        }
      ]
    });
    return serializeRecord(record);
  }

  public async savedProducts(userId: string, query: SavedListQuery) {
    const records = await GeneratedApiRecordModel.find({
      resource: "saved-products",
      ownerId: userId,
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(query.limit);
    return records.map(serializeRecord);
  }

  public async saveSearch(userId: string, input: SavedSearchInput) {
    const searchRecord = input.searchId
      ? await GeneratedApiRecordModel.findOne({
          _id: input.searchId,
          resource: "image-search",
          ownerId: userId,
          deletedAt: null
        })
      : null;
    if (input.searchId && !searchRecord) {
      throw new ResourceNotFoundError("Search not found.");
    }
    const query = input.query ?? (typeof searchRecord?.data.query === "string" ? searchRecord.data.query : undefined);
    if (!query) {
      throw new ResourceNotFoundError("Search query not found.");
    }
    const filters =
      input.filters ??
      (typeof searchRecord?.data.filters === "object" && searchRecord.data.filters !== null && !Array.isArray(searchRecord.data.filters)
        ? (searchRecord.data.filters as Record<string, unknown>)
        : {});
    const scope = {
      searchKey: input.searchId ?? query.toLowerCase(),
      query
    };
    const data = {
      searchId: input.searchId ?? null,
      query,
      filters,
      name: input.name ?? query,
      savedAt: new Date().toISOString()
    };
    const existing = await GeneratedApiRecordModel.findOne({
      resource: "saved-searches",
      ownerId: userId,
      "scope.searchKey": scope.searchKey,
      deletedAt: null
    });
    if (existing) {
      existing.data = { ...existing.data, ...data };
      existing.status = "active";
      existing.history.push({
        action: "saved-searches.updated",
        actorId: userId,
        actorType: "customer",
        at: new Date(),
        metadata: data
      });
      await existing.save();
      return serializeRecord(existing);
    }
    const record = await GeneratedApiRecordModel.create({
      resource: "saved-searches",
      ownerId: userId,
      scope,
      data,
      status: "active",
      history: [
        {
          action: "saved-searches.created",
          actorId: userId,
          actorType: "customer",
          at: new Date(),
          metadata: data
        }
      ]
    });
    return serializeRecord(record);
  }

  public async savedSearches(userId: string, query: SavedListQuery) {
    const records = await GeneratedApiRecordModel.find({
      resource: "saved-searches",
      ownerId: userId,
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(query.limit);
    return records.map(serializeRecord);
  }

  public async recommendedProducts(userId: string, _query: RecommendationsQuery) {
    const record = await GeneratedApiRecordModel.findOne({
      resource: "recommended-products",
      ownerId: userId,
      "scope.kind": "latest",
      deletedAt: null
    }).sort({ updatedAt: -1 });
    return record
      ? {
          id: record._id.toString(),
          status: record.status,
          updatedAt: record.updatedAt.toISOString(),
          ...record.data
        }
      : {
          status: "pending",
          items: [],
          local: [],
          ebay: [],
          sourceCounts: {
            local: 0,
            ebay: 0
          },
          message: "Recommendations will appear after your next product search."
        };
  }
}
