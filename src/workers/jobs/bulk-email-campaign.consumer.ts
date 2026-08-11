import type { Channel, ConsumeMessage } from "amqplib";
import { getRabbitMqConfig } from "../../config/rabbitmq.config.js";
import { DomainEventPublisher } from "../../common/services/domain-event-publisher.js";
import type { WatchboxLogger } from "../../common/utils/logger.js";
import { NodemailerEmailProvider } from "../../infrastructure/external/email/email-provider.js";
import type { RabbitConnection } from "../../infrastructure/rabbitmq/connection.js";
import {
  bulkEmailCampaignQueue,
  bulkEmailCampaignSendJobType,
  BulkEmailService
} from "../../modules/admin/bulk-email/bulk-email.service.js";

type BulkEmailCampaignJobPayload = {
  actorId: string;
  campaignId: string;
};

const parseJobPayload = (message: ConsumeMessage): BulkEmailCampaignJobPayload => {
  const parsed = JSON.parse(message.content.toString()) as {
    type?: unknown;
    payload?: Record<string, unknown>;
  };
  const actorId = parsed.payload?.actorId;
  const campaignId = parsed.payload?.campaignId;

  if (
    parsed.type !== bulkEmailCampaignSendJobType ||
    typeof actorId !== "string" ||
    typeof campaignId !== "string"
  ) {
    throw new Error("Invalid bulk email campaign job payload.");
  }

  return { actorId, campaignId };
};

export const registerBulkEmailCampaignConsumer = async (
  channel: Channel,
  rabbit: RabbitConnection,
  logger: WatchboxLogger
): Promise<void> => {
  const config = getRabbitMqConfig();
  const service = new BulkEmailService({
    events: new DomainEventPublisher(rabbit),
    email: new NodemailerEmailProvider()
  });

  await channel.assertQueue(bulkEmailCampaignQueue, {
    durable: true,
    deadLetterExchange: config.deadLetterExchange
  });
  await channel.bindQueue(bulkEmailCampaignQueue, config.jobExchange, bulkEmailCampaignSendJobType);
  await channel.prefetch(1);
  await channel.consume(
    bulkEmailCampaignQueue,
    (message) => {
      if (!message) {
        return;
      }

      void (async () => {
        try {
          const payload = parseJobPayload(message);
          await service.processQueuedCampaign(payload.actorId, payload.campaignId);
          channel.ack(message);
          logger.info({ campaignId: payload.campaignId }, "Bulk email campaign job completed");
        } catch (error: unknown) {
          logger.error({ err: error }, "Bulk email campaign job failed");
          channel.nack(message, false, false);
        }
      })();
    },
    { noAck: false }
  );

  void service
    .recoverQueuedCampaigns()
    .then((result) => {
      if (result.recoveredCount > 0) {
        logger.info(result, "Recovered queued bulk email campaigns");
      }
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "Queued bulk email campaign recovery failed");
    });
};
