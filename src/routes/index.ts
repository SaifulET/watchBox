import type { Express } from "express";
import { getEnv } from "../config/env.js";
import { createAdminRouter } from "./admin.routes.js";
import { createCustomerRouter } from "./customer.routes.js";
import { createHealthRouter, type HealthRouteDependencies } from "./health.routes.js";
import { createInternalRouter } from "./internal.routes.js";

export const registerRoutes = (app: Express, dependencies: HealthRouteDependencies = {}): void => {
  const env = getEnv();
  app.use("/health", createHealthRouter(dependencies));
  app.use(env.API_PREFIX, createCustomerRouter());
  app.use(`${env.API_PREFIX}/admin`, createAdminRouter());
  app.use("/internal", createInternalRouter());
};
