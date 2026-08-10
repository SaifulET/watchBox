import type { Express } from "express";
import { getEnv } from "../config/env.js";
import type { RabbitConnection } from "../infrastructure/rabbitmq/connection.js";
import type { RedisClient } from "../infrastructure/redis/client.js";
import { createAdminRouter } from "./admin.routes.js";
import { createCustomerRouter } from "./customer.routes.js";
import { createHealthRouter, type HealthRouteDependencies } from "./health.routes.js";
import { createInternalRouter } from "./internal.routes.js";

export type RouteDependencies = HealthRouteDependencies & {
  redis?: RedisClient;
  rabbitMq?: RabbitConnection;
};

export const registerRoutes = (app: Express, dependencies: RouteDependencies = {}): void => {
  const env = getEnv();
  app.use("/health", createHealthRouter(dependencies));
  app.use(`${env.API_PREFIX}/admin`, createAdminRouter(dependencies));
  app.use(env.API_PREFIX, createCustomerRouter(dependencies));
  app.use("/internal", createInternalRouter());
};
