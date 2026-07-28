import amqp from "amqplib";
import mongoose from "mongoose";
import { getDatabaseConfig } from "../config/database.config.js";
import { getRabbitMqConfig } from "../config/rabbitmq.config.js";
import { createLogger } from "../common/utils/logger.js";
import { createRedisClient } from "../infrastructure/redis/client.js";
import { workerQueues } from "./consumers/queue-catalogue.js";

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
  await Promise.all(workerQueues.map((queue) => channel.assertQueue(queue, { durable: true })));

  logger.info({ queues: workerQueues.length }, "WatchBox worker started");

  return {
    stop: async () => {
      await channel.close();
      await rabbit.close();
      await redis.quit();
      await mongoose.disconnect();
      logger.info("WatchBox worker stopped");
    }
  };
};
