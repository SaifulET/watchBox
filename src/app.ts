import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { getEnv } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./common/errors/error-handler.js";
import { requestContextMiddleware } from "./common/middleware/request-context.js";
import { createSecurityMiddleware } from "./common/middleware/security.js";
import { createLogger, type WatchboxLogger } from "./common/utils/logger.js";
import { registerSwagger } from "./docs/swagger.js";
import type { RabbitConnection } from "./infrastructure/rabbitmq/connection.js";
import type { RedisClient } from "./infrastructure/redis/client.js";
import { registerRoutes, type RouteDependencies } from "./routes/index.js";

export type AppDependencies = {
  logger: WatchboxLogger;
  redis?: RedisClient;
  rabbitMq?: RabbitConnection;
};

export const createApp = (overrides: Partial<AppDependencies> = {}): Express => {
  const env = getEnv();
  const logger = overrides.logger ?? createLogger({ service: "api" });
  const app = express();

  app.disable("x-powered-by");
  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }
  app.use(
    pinoHttp({
      logger,
      autoLogging: false,
      genReqId: (req) => req.headers["x-request-id"]?.toString() ?? randomUUID()
    })
  );
  app.use(requestContextMiddleware);
  app.use(createSecurityMiddleware(env));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  const routeDependencies: RouteDependencies = {};
  if (overrides.redis) {
    routeDependencies.redis = overrides.redis;
  }
  if (overrides.rabbitMq) {
    routeDependencies.rabbitMq = overrides.rabbitMq;
  }

  registerRoutes(app, routeDependencies);
  registerSwagger(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
