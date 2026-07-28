import amqp from "amqplib";
import { getRabbitMqConfig } from "../../config/rabbitmq.config.js";
import type { WatchboxLogger } from "../../common/utils/logger.js";

export type RabbitConnection = Awaited<ReturnType<typeof amqp.connect>>;

export const connectRabbitMq = async (logger: WatchboxLogger): Promise<RabbitConnection> => {
  const config = getRabbitMqConfig();
  const connection = await amqp.connect(config.url);
  connection.on("error", (error) => logger.error({ err: error }, "RabbitMQ connection error"));
  logger.info("RabbitMQ connected");
  return connection;
};

export const checkRabbitMqHealth = async (connection: RabbitConnection): Promise<boolean> => {
  const channel = await connection.createChannel();
  try {
    await channel.assertExchange(getRabbitMqConfig().domainExchange, "topic", { durable: true });
    return true;
  } finally {
    await channel.close();
  }
};
