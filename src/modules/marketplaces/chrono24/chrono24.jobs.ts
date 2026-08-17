import type { Channel, ConsumeMessage } from "amqplib";
import { getRabbitMqConfig } from "../../../config/rabbitmq.config.js";
import type { JobPublisher } from "../../../common/services/job-publisher.js";
import type { WatchboxLogger } from "../../../common/utils/logger.js";
import type { RedisClient } from "../../../infrastructure/redis/client.js";
import { Chrono24Service } from "./chrono24.service.js";
import type { Chrono24JobType } from "./chrono24.types.js";

export const chrono24RefreshQueue = "watchbox.chrono24.listings.refresh";
export const chrono24SnapshotQueue = "watchbox.chrono24.snapshots.create";
export const chrono24AnalyticsQueue = "watchbox.chrono24.analytics.recalculate";
export const chrono24MarketInsightsQueue = "watchbox.chrono24.market-insights.recalculate";

export const chrono24RefreshJobType: Chrono24JobType = "chrono24.listings.refresh";
export const chrono24SnapshotJobType: Chrono24JobType = "chrono24.snapshots.create";
export const chrono24AnalyticsJobType: Chrono24JobType = "chrono24.analytics.recalculate";
export const chrono24MarketInsightsJobType: Chrono24JobType = "chrono24.market-insights.recalculate";

const queueByType: Record<Chrono24JobType, string> = {
  [chrono24RefreshJobType]: chrono24RefreshQueue,
  [chrono24SnapshotJobType]: chrono24SnapshotQueue,
  [chrono24AnalyticsJobType]: chrono24AnalyticsQueue,
  [chrono24MarketInsightsJobType]: chrono24MarketInsightsQueue
};

type Chrono24JobMessage = {
  type: Chrono24JobType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

const parseMessage = (message: ConsumeMessage): Chrono24JobMessage => {
  const parsed = JSON.parse(message.content.toString()) as {
    type?: unknown;
    idempotencyKey?: unknown;
    payload?: unknown;
  };
  if (
    parsed.type !== chrono24RefreshJobType &&
    parsed.type !== chrono24SnapshotJobType &&
    parsed.type !== chrono24AnalyticsJobType &&
    parsed.type !== chrono24MarketInsightsJobType
  ) {
    throw new Error("Invalid Chrono24 job type.");
  }
  return {
    type: parsed.type,
    idempotencyKey: typeof parsed.idempotencyKey === "string" ? parsed.idempotencyKey : `${parsed.type}:${Date.now()}`,
    payload: typeof parsed.payload === "object" && parsed.payload !== null && !Array.isArray(parsed.payload)
      ? parsed.payload as Record<string, unknown>
      : {}
  };
};

const executeJob = async (
  service: Chrono24Service,
  job: Chrono24JobMessage,
  logger: WatchboxLogger
): Promise<void> => {
  if (job.type === chrono24RefreshJobType) {
    const result = await service.refreshDefaultListings();
    logger.info(result, "Chrono24 listing refresh completed");
    return;
  }
  if (job.type === chrono24SnapshotJobType) {
    const result = await service.createSnapshotsFromCurrentListings();
    logger.info(result, "Chrono24 price snapshots completed");
    return;
  }
  if (job.type === chrono24AnalyticsJobType) {
    const result = await service.analytics({});
    logger.info(result, "Chrono24 analytics recalculation completed");
    return;
  }
  const result = await service.marketInsights();
  logger.info({
    lowestPricedProduct: result.lowestPricedProduct?.id ?? null,
    highestPricedProduct: result.highestPricedProduct?.id ?? null
  }, "Chrono24 market-insight recalculation completed");
};

export const registerChrono24Consumers = async (
  channel: Channel,
  redis: RedisClient | undefined,
  logger: WatchboxLogger
): Promise<void> => {
  const config = getRabbitMqConfig();
  const service = new Chrono24Service(redis);

  await Promise.all(
    Object.entries(queueByType).map(async ([type, queue]) => {
      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: config.deadLetterExchange
      });
      await channel.bindQueue(queue, config.jobExchange, type);
    })
  );
  await channel.prefetch(1);
  for (const queue of Object.values(queueByType)) {
    await channel.consume(
      queue,
      (message) => {
        if (!message) {
          return;
        }
        void (async () => {
          try {
            const job = parseMessage(message);
            await executeJob(service, job, logger);
            channel.ack(message);
          } catch (error: unknown) {
            logger.error({ err: error }, "Chrono24 job failed");
            channel.nack(message, false, false);
          }
        })();
      },
      { noAck: false }
    );
  }
};

export const publishChrono24MaintenanceJobs = async (publisher: JobPublisher): Promise<void> => {
  const now = new Date();
  for (const type of [chrono24RefreshJobType, chrono24SnapshotJobType, chrono24AnalyticsJobType, chrono24MarketInsightsJobType]) {
    await publisher.publish({
      type,
      idempotencyKey: `${type}:${now.toISOString().slice(0, 10)}`,
      payload: { scheduledAt: now.toISOString() },
      queue: {
        name: queueByType[type],
        deadLetter: true,
        routingKey: type
      }
    });
  }
};
