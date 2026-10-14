import { createServer } from "node:http";
import { getEnv } from "./config/env.js";
import { createLogger } from "./common/utils/logger.js";
import { createApp } from "./app.js";
import { connectMongo, disconnectMongo } from "./infrastructure/database/mongo.js";
import { connectRabbitMq } from "./infrastructure/rabbitmq/connection.js";
import { connectRedis, createRedisClient } from "./infrastructure/redis/client.js";
import { SocketRealtimeService } from "./realtime/socket-realtime.service.js";

const bootstrap = async (): Promise<void> => {
  const env = getEnv();
  const logger = createLogger({ service: "api" });
  const redis = createRedisClient(logger);

  await connectMongo(logger);
  await connectRedis(redis, logger);
  const rabbitMq = await connectRabbitMq(logger);

  const realtime = new SocketRealtimeService(logger);
  const app = createApp({ logger, redis, rabbitMq, realtime });
  const server = createServer(app);
  realtime.attach(server);
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "WatchBox API listening");
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "Graceful shutdown started");
    realtime.disconnectAll();
    server.close(() => {
      void Promise.all([redis.quit(), rabbitMq.close(), disconnectMongo()]).then(() => {
        logger.info("Graceful shutdown complete");
      });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

void bootstrap();
