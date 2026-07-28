import { createHash } from "node:crypto";
import { ConflictError, ResourceNotFoundError } from "../../common/errors/app-error.js";
import type { DomainEventPublisher } from "../../common/services/domain-event-publisher.js";
import type { JobPublisher } from "../../common/services/job-publisher.js";
import type { RedisClient } from "../../infrastructure/redis/client.js";
import { GeneratedApiRepository } from "./generated-api.repository.js";
import type { GeneratedApiRecordDocument } from "./generated-api.model.js";

type Actor = {
  id?: string;
  audience?: string;
};

export type GeneratedEndpointDefinition = {
  method: string;
  fullPath: string;
  localPath: string;
  resource: string;
  action: string;
  auth: "public" | "customer" | "admin";
  permission?: string;
  ownerScoped: boolean;
  job: boolean;
  cache: boolean;
};

export type GeneratedListResult = {
  items: Array<ReturnType<typeof serializeRecord>>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type GeneratedApiDependencies = {
  repository?: GeneratedApiRepository;
  redis?: RedisClient;
  events: DomainEventPublisher;
  jobs: JobPublisher;
};

type ListQuery = {
  page?: unknown;
  limit?: unknown;
  [key: string]: unknown;
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

const parsePositiveInteger = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const cacheKey = (definition: GeneratedEndpointDefinition, query: ListQuery, actor: Actor): string =>
  `api-cache:${createHash("sha256")
    .update(JSON.stringify({ path: definition.fullPath, query, actorId: actor.id ?? null }))
    .digest("hex")}`;

export class GeneratedApiService {
  private readonly repository: GeneratedApiRepository;

  public constructor(private readonly dependencies: GeneratedApiDependencies) {
    this.repository = dependencies.repository ?? new GeneratedApiRepository();
  }

  public async list(definition: GeneratedEndpointDefinition, query: ListQuery, actor: Actor) {
    const ownerId = this.ownerId(definition, actor);
    const page = parsePositiveInteger(query.page, 1, 10_000);
    const limit = parsePositiveInteger(query.limit, 20, 100);
    const key = cacheKey(definition, query, actor);

    if (definition.cache) {
      const cached = await this.dependencies.redis?.get(key);
      if (cached) {
        return JSON.parse(cached) as GeneratedListResult;
      }
    }

    const listOptions: {
      resource: string;
      ownerId?: string;
      query: ListQuery;
      page: number;
      limit: number;
    } = {
      resource: definition.resource,
      query,
      page,
      limit
    };
    if (ownerId) {
      listOptions.ownerId = ownerId;
    }
    const { records, total } = await this.repository.list(listOptions);
    const response: GeneratedListResult = {
      items: records.map(serializeRecord),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
    if (definition.cache) {
      await this.dependencies.redis?.set(key, JSON.stringify(response), "EX", 60);
    }
    return response;
  }

  public async get(definition: GeneratedEndpointDefinition, params: Record<string, string>, actor: Actor) {
    const ownerId = this.ownerId(definition, actor);
    const identifier = this.primaryIdentifier(params);
    if (identifier) {
      const record = await this.repository.findByIdentifier(definition.resource, identifier, ownerId);
      if (!record) {
        throw new ResourceNotFoundError(`${definition.resource} record not found.`);
      }
      return serializeRecord(record);
    }

    const record = await this.repository.findByScope(definition.resource, params, ownerId);
    if (!record) {
      throw new ResourceNotFoundError(`${definition.resource} record not found.`);
    }
    return serializeRecord(record);
  }

  public async create(
    definition: GeneratedEndpointDefinition,
    params: Record<string, string>,
    body: Record<string, unknown>,
    actor: Actor
  ) {
    const ownerId = this.ownerId(definition, actor);
    const createInput: {
      resource: string;
      ownerId?: string;
      scope: Record<string, string>;
      data: Record<string, unknown>;
      status?: string;
      historyAction: string;
      actorId?: string;
      actorType?: string;
    } = {
      resource: definition.resource,
      scope: params,
      data: body,
      historyAction: definition.action
    };
    if (ownerId) {
      createInput.ownerId = ownerId;
    }
    if (actor.id) {
      createInput.actorId = actor.id;
    }
    if (actor.audience) {
      createInput.actorType = actor.audience;
    }
    const record = await this.repository.create(createInput);
    await this.afterMutation(definition, record._id.toString(), actor, body);
    return serializeRecord(record);
  }

  public async update(
    definition: GeneratedEndpointDefinition,
    params: Record<string, string>,
    body: Record<string, unknown>,
    actor: Actor
  ) {
    const record = await this.requireTarget(definition, params, actor);
    const updated = await this.repository.update(
      record,
      body,
      definition.action,
      actor.id,
      actor.audience
    );
    await this.afterMutation(definition, updated._id.toString(), actor, body);
    return serializeRecord(updated);
  }

  public async remove(definition: GeneratedEndpointDefinition, params: Record<string, string>, actor: Actor) {
    const record = await this.requireTarget(definition, params, actor);
    await this.repository.softDelete(record, definition.action, actor.id, actor.audience);
    await this.afterMutation(definition, record._id.toString(), actor, {});
    return { deleted: true };
  }

  public async action(
    definition: GeneratedEndpointDefinition,
    params: Record<string, string>,
    body: Record<string, unknown>,
    actor: Actor
  ) {
    const target = await this.findOrCreateActionTarget(definition, params, body, actor);
    const status = this.statusFromAction(definition.action);
    const updated = await this.repository.setStatus(
      target,
      status,
      definition.action,
      actor.id,
      actor.audience
    );
    await this.afterMutation(definition, updated._id.toString(), actor, {
      ...body,
      status
    });
    return {
      accepted: true,
      action: definition.action,
      record: serializeRecord(updated)
    };
  }

  private async findOrCreateActionTarget(
    definition: GeneratedEndpointDefinition,
    params: Record<string, string>,
    body: Record<string, unknown>,
    actor: Actor
  ): Promise<GeneratedApiRecordDocument> {
    const ownerId = this.ownerId(definition, actor);
    const identifier = this.primaryIdentifier(params);
    const existing = identifier
      ? await this.repository.findByIdentifier(definition.resource, identifier, ownerId)
      : await this.repository.findByScope(definition.resource, params, ownerId);

    if (existing) {
      return existing;
    }

    if (identifier && definition.method !== "POST") {
      throw new ResourceNotFoundError(`${definition.resource} record not found.`);
    }

    const createInput: {
      resource: string;
      ownerId?: string;
      scope: Record<string, string>;
      data: Record<string, unknown>;
      status?: string;
      historyAction: string;
      actorId?: string;
      actorType?: string;
    } = {
      resource: definition.resource,
      scope: params,
      data: body,
      status: "pending",
      historyAction: `${definition.action}.created-target`
    };
    if (ownerId) {
      createInput.ownerId = ownerId;
    }
    if (actor.id) {
      createInput.actorId = actor.id;
    }
    if (actor.audience) {
      createInput.actorType = actor.audience;
    }
    return this.repository.create(createInput);
  }

  private async requireTarget(
    definition: GeneratedEndpointDefinition,
    params: Record<string, string>,
    actor: Actor
  ): Promise<GeneratedApiRecordDocument> {
    const ownerId = this.ownerId(definition, actor);
    const identifier = this.primaryIdentifier(params);
    if (!identifier) {
      const record = await this.repository.findByScope(definition.resource, params, ownerId);
      if (record) {
        return record;
      }
      throw new ConflictError("This endpoint requires a target resource identifier.");
    }
    const record = await this.repository.findByIdentifier(definition.resource, identifier, ownerId);
    if (!record) {
      throw new ResourceNotFoundError(`${definition.resource} record not found.`);
    }
    return record;
  }

  private ownerId(definition: GeneratedEndpointDefinition, actor: Actor): string | undefined {
    if (definition.ownerScoped) {
      return actor.id;
    }
    return undefined;
  }

  private primaryIdentifier(params: Record<string, string>): string | undefined {
    const idEntry = Object.entries(params).find(([key]) => key.toLowerCase().endsWith("id"));
    return idEntry?.[1];
  }

  private statusFromAction(action: string): string {
    const terminal = action.split(".").at(-1) ?? action;
    const statusMap: Record<string, string> = {
      submit: "pending",
      publish: "active",
      pause: "paused",
      resume: "active",
      archive: "archived",
      "mark-sold": "sold",
      reserve: "reserved",
      unreserve: "active",
      cancel: "cancelled",
      close: "closed",
      activate: "active",
      deactivate: "inactive",
      enable: "enabled",
      disable: "disabled",
      suspend: "suspended",
      unsuspend: "active",
      restore: "active",
      dismiss: "dismissed",
      resolve: "resolved"
    };
    return statusMap[terminal] ?? "accepted";
  }

  private async afterMutation(
    definition: GeneratedEndpointDefinition,
    aggregateId: string,
    actor: Actor,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.dependencies.redis?.del(`resource:${definition.resource}`);
    await this.dependencies.events.publish({
      type: definition.action,
      aggregateId,
      payload: {
        ...payload,
        actorId: actor.id ?? null,
        actorType: actor.audience ?? null
      }
    });

    if (definition.job) {
      await this.dependencies.jobs.publish({
        type: definition.action,
        idempotencyKey: `${definition.action}:${aggregateId}`,
        payload: {
          ...payload,
          aggregateId,
          actorId: actor.id ?? null
        }
      });
    }
  }
}
