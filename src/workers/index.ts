import amqp from "amqplib";
import mongoose from "mongoose";
import { getDatabaseConfig } from "../config/database.config.js";
import { getRabbitMqConfig } from "../config/rabbitmq.config.js";
import { createLogger } from "../common/utils/logger.js";
import { createRedisClient } from "../infrastructure/redis/client.js";
import { bulkEmailCampaignQueue } from "../modules/admin/bulk-email/bulk-email.service.js";
import { WatchAlertsService } from "../modules/customer/watch-alerts/watch-alerts.service.js";
import { workerQueues } from "./consumers/queue-catalogue.js";
import { registerBulkEmailCampaignConsumer } from "./jobs/bulk-email-campaign.consumer.js";

const alertCheckIntervalMs = 20 * 60 * 1000;

export const bootstrapWorker = async (): Promise<{ stop: () => Promise<void> }> => {
  const logger = createLogger({ service: "worker" });
  const database = getDatabaseConfig();
  const rabbitConfig = getRabbitMqConfig();
  const redis = createRedisClient(logger);

  await mongoose.connect(database.uri, { dbName: database.databaseName, autoIndex: true });
  await redis.connect();
  const rabbit = await amqp.connect(rabbitConfig.url);
  const channel = await rabbit.createChannel();

  await channel.assertExchange(rabbitConfig.domainExchange, "topic", { durable: true });
  await channel.assertExchange(rabbitConfig.jobExchange, "topic", { durable: true });
  await channel.assertExchange(rabbitConfig.deadLetterExchange, "topic", { durable: true });
  await Promise.all(
    workerQueues
      .filter((queue) => queue !== bulkEmailCampaignQueue)
      .map((queue) => channel.assertQueue(queue, { durable: true }))
  );
  await registerBulkEmailCampaignConsumer(channel, rabbit, logger);

  logger.info({ queues: workerQueues.length }, "WatchBox worker started");
  const alerts = new WatchAlertsService();
  const runAlertCheck = (): void => {
    void alerts
      .checkAllActiveAlerts()
      .then((result) => {
        logger.info(result, "Watch alert check completed");
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "Watch alert check failed");
      });
  };
  const alertInterval = setInterval(runAlertCheck, alertCheckIntervalMs);
  runAlertCheck();

  return {
    stop: async () => {
      clearInterval(alertInterval);
      await channel.close();
      await rabbit.close();
      await redis.quit();
      await mongoose.disconnect();
      logger.info("WatchBox worker stopped");
    }
  };
};
