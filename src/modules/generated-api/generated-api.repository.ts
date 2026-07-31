import { Types, type FilterQuery, type UpdateQuery } from "mongoose";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecord,
  type GeneratedApiRecordDocument
} from "./generated-api.model.js";

type ListOptions = {
  resource: string;
  ownerId?: string;
  query: Record<string, unknown>;
  page: number;
  limit: number;
};

type CreateInput = {
  resource: string;
  ownerId?: string;
  scope: Record<string, string>;
  data: Record<string, unknown>;
  status?: string;
  historyAction: string;
  actorId?: string;
  actorType?: string;
};

const isObjectId = (value: string): boolean => Types.ObjectId.isValid(value);

const cleanQueryValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const baseFilter = (resource: string, ownerId?: string): FilterQuery<GeneratedApiRecord> => {
  const filter: FilterQuery<GeneratedApiRecord> = {
    resource,
    deletedAt: null
  };
  if (ownerId) {
    filter.ownerId = ownerId;
  }
  return filter;
};

export class GeneratedApiRepository {
  public async list(options: ListOptions): Promise<{
    records: GeneratedApiRecordDocument[];
    total: number;
  }> {
    const filter = baseFilter(options.resource, options.ownerId);
    for (const [key, value] of Object.entries(options.query)) {
      if (["page", "limit", "sort"].includes(key)) {
        continue;
      }
      filter[`data.${key}`] = cleanQueryValue(value);
    }

    const [records, total] = await Promise.all([
      GeneratedApiRecordModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((options.page - 1) * options.limit)
        .limit(options.limit),
      GeneratedApiRecordModel.countDocuments(filter)
    ]);
    return { records, total };
  }

  public create(input: CreateInput): Promise<GeneratedApiRecordDocument> {
    const history: GeneratedApiRecord["history"][number] = {
      action: input.historyAction,
      at: new Date(),
      metadata: input.data
    };
    if (input.actorId) {
      history.actorId = input.actorId;
    }
    if (input.actorType) {
      history.actorType = input.actorType;
    }

    const payload: Omit<GeneratedApiRecord, "createdAt" | "updatedAt"> = {
      resource: input.resource,
      scope: input.scope,
      data: input.data,
      status: input.status ?? "active",
      history: [history]
    };
    if (input.ownerId) {
      payload.ownerId = input.ownerId;
    }
    return GeneratedApiRecordModel.create(payload);
  }

  public findByIdentifier(
    resource: string,
    identifier: string,
    ownerId?: string
  ): Promise<GeneratedApiRecordDocument | null> {
    const filter = baseFilter(resource, ownerId);
    if (isObjectId(identifier)) {
      filter._id = identifier;
    } else {
      filter.$or = [{ "scope.identifier": identifier }, { "data.slug": identifier }, { "data.key": identifier }];
    }
    return GeneratedApiRecordModel.findOne(filter);
  }

  public findByScope(
    resource: string,
    scope: Record<string, string>,
    ownerId?: string
  ): Promise<GeneratedApiRecordDocument | null> {
    const filter = baseFilter(resource, ownerId);
    for (const [key, value] of Object.entries(scope)) {
      filter[`scope.${key}`] = value;
    }
    return GeneratedApiRecordModel.findOne(filter);
  }

  public async update(
    record: GeneratedApiRecordDocument,
    data: Record<string, unknown>,
    action: string,
    actorId?: string,
    actorType?: string
  ): Promise<GeneratedApiRecordDocument> {
    const history: GeneratedApiRecord["history"][number] = {
      action,
      at: new Date(),
      metadata: data
    };
    if (actorId) {
      history.actorId = actorId;
    }
    if (actorType) {
      history.actorType = actorType;
    }

    const update: UpdateQuery<GeneratedApiRecord> = {
      $set: {
        data: {
          ...record.data,
          ...data
        }
      },
      $push: { history }
    };

    const updated = await GeneratedApiRecordModel.findByIdAndUpdate(record._id, update, { new: true });
    return updated ?? record;
  }

  public async setStatus(
    record: GeneratedApiRecordDocument,
    status: string,
    action: string,
    actorId?: string,
    actorType?: string
  ): Promise<GeneratedApiRecordDocument> {
    const history: GeneratedApiRecord["history"][number] = {
      action,
      at: new Date(),
      metadata: { status }
    };
    if (actorId) {
      history.actorId = actorId;
    }
    if (actorType) {
      history.actorType = actorType;
    }
    const updated = await GeneratedApiRecordModel.findByIdAndUpdate(
      record._id,
      { $set: { status }, $push: { history } },
      { new: true }
    );
    return updated ?? record;
  }

  public async updateDataAndStatus(
    record: GeneratedApiRecordDocument,
    data: Record<string, unknown>,
    status: string,
    action: string,
    actorId?: string,
    actorType?: string
  ): Promise<GeneratedApiRecordDocument> {
    const history: GeneratedApiRecord["history"][number] = {
      action,
      at: new Date(),
      metadata: data
    };
    if (actorId) {
      history.actorId = actorId;
    }
    if (actorType) {
      history.actorType = actorType;
    }

    const updated = await GeneratedApiRecordModel.findByIdAndUpdate(
      record._id,
      {
        $set: {
          data: {
            ...record.data,
            ...data
          },
          status
        },
        $push: { history }
      },
      { new: true }
    );
    return updated ?? record;
  }

  public async softDelete(
    record: GeneratedApiRecordDocument,
    action: string,
    actorId?: string,
    actorType?: string
  ): Promise<void> {
    const history: GeneratedApiRecord["history"][number] = {
      action,
      at: new Date(),
      metadata: {}
    };
    if (actorId) {
      history.actorId = actorId;
    }
    if (actorType) {
      history.actorType = actorType;
    }
    await GeneratedApiRecordModel.updateOne(
      { _id: record._id },
      {
        $set: { deletedAt: new Date(), status: "deleted" },
        $push: { history }
      }
    );
  }
}
