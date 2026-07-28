import { Redis } from "ioredis";
import { getRedisConfig } from "../../config/redis.config.js";
import type { WatchboxLogger } from "../../common/utils/logger.js";

export type RedisClient = Redis;

export const createRedisClient = (logger: WatchboxLogger): RedisClient => {
  const client = new Redis(getRedisConfig().url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3
  });
  client.on("error", (error) => logger.error({ err: error }, "Redis client error"));
  return client;
};

export const connectRedis = async (client: RedisClient, logger: WatchboxLogger): Promise<void> => {
  await client.connect();
  logger.info("Redis connected");
};

export const checkRedisHealth = async (client: RedisClient): Promise<boolean> => {
  return (await client.ping()) === "PONG";
};
